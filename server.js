// ============================================
// FILE: profile-api/server.js
// Simple Express API for storing profiles
// ============================================

const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const nacl = require('tweetnacl');
const bs58 = require('bs58');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Allow larger payloads for images

// Initialize SQLite database
const db = new sqlite3.Database('./profiles.db', (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('✅ Connected to SQLite database');
    initDatabase();
  }
});

// Create tables
function initDatabase() {
  db.run(`
    CREATE TABLE IF NOT EXISTS profiles (
      wallet_address TEXT PRIMARY KEY,
      username TEXT,
      profile_picture TEXT,
      updated_at INTEGER
    )
  `, (err) => {
    if (err) {
      console.error('Error creating table:', err);
    } else {
      console.log('✅ Database tables ready');
    }
  });
}

// Verify signature (optional but recommended)
function verifySignature(wallet, message, signature) {
  try {
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = bs58.decode(signature);
    const publicKeyBytes = bs58.decode(wallet);
    
    return nacl.sign.detached.verify(
      messageBytes,
      signatureBytes,
      publicKeyBytes
    );
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

// ============================================
// API ENDPOINTS
// ============================================

// Get profile by wallet address
app.get('/api/profile/:wallet', (req, res) => {
  const { wallet } = req.params;
  
  db.get(
    'SELECT * FROM profiles WHERE wallet_address = ?',
    [wallet],
    (err, row) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!row) {
        return res.status(404).json({ error: 'Profile not found' });
      }
      
      res.json({
        walletAddress: row.wallet_address,
        username: row.username,
        profilePicture: row.profile_picture,
        updatedAt: row.updated_at,
      });
    }
  );
});

// Get multiple profiles (for leaderboard)
app.post('/api/profiles/batch', (req, res) => {
  const { wallets } = req.body;
  
  if (!Array.isArray(wallets) || wallets.length === 0) {
    return res.status(400).json({ error: 'Invalid wallet array' });
  }
  
  // Limit to 100 wallets per request
  const limitedWallets = wallets.slice(0, 100);
  const placeholders = limitedWallets.map(() => '?').join(',');
  
  db.all(
    `SELECT * FROM profiles WHERE wallet_address IN (${placeholders})`,
    limitedWallets,
    (err, rows) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      const profiles = {};
      rows.forEach(row => {
        profiles[row.wallet_address] = {
          username: row.username,
          profilePicture: row.profile_picture,
          updatedAt: row.updated_at,
        };
      });
      
      res.json({ profiles });
    }
  );
});

// Update profile (username and/or picture)
app.post('/api/profile', (req, res) => {
  const { wallet, username, profilePicture, signature, message } = req.body;
  
  if (!wallet) {
    return res.status(400).json({ error: 'Wallet address required' });
  }
  
  // Optional: Verify signature for security
  // Uncomment if you want to enforce signature verification
  /*
  if (signature && message) {
    if (!verifySignature(wallet, message, signature)) {
      return res.status(403).json({ error: 'Invalid signature' });
    }
  }
  */
  
  // Validate username
  if (username && (username.length > 20 || username.length < 1)) {
    return res.status(400).json({ error: 'Username must be 1-20 characters' });
  }
  
  // Validate profile picture size (base64 encoded)
  if (profilePicture) {
    const sizeInBytes = Buffer.byteLength(profilePicture, 'utf8');
    const sizeInMB = sizeInBytes / (1024 * 1024);
    
    if (sizeInMB > 5) {
      return res.status(400).json({ error: 'Profile picture too large (max 5MB)' });
    }
  }
  
  const updatedAt = Date.now();
  
  // Upsert profile
  db.run(
    `INSERT INTO profiles (wallet_address, username, profile_picture, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(wallet_address) DO UPDATE SET
       username = COALESCE(?, username),
       profile_picture = COALESCE(?, profile_picture),
       updated_at = ?`,
    [wallet, username, profilePicture, updatedAt, username, profilePicture, updatedAt],
    function(err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Failed to save profile' });
      }
      
      res.json({
        success: true,
        walletAddress: wallet,
        username: username,
        updatedAt: updatedAt,
      });
    }
  );
});

// Delete profile picture
app.delete('/api/profile/:wallet/picture', (req, res) => {
  const { wallet } = req.params;
  
  db.run(
    'UPDATE profiles SET profile_picture = NULL, updated_at = ? WHERE wallet_address = ?',
    [Date.now(), wallet],
    function(err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Failed to delete picture' });
      }
      
      res.json({ success: true });
    }
  );
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Get stats
app.get('/api/stats', (req, res) => {
  db.get('SELECT COUNT(*) as total FROM profiles', (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    db.get('SELECT COUNT(*) as withPictures FROM profiles WHERE profile_picture IS NOT NULL', (err2, row2) => {
      if (err2) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      res.json({
        totalProfiles: row.total,
        profilesWithPictures: row2.withPictures,
      });
    });
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Profile API running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing database...');
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err);
    } else {
      console.log('✅ Database closed');
    }
    process.exit(0);
  });
});
