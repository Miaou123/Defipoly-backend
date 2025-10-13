const { getDatabase } = require('../config/database');

const getProfile = (req, res) => {
  const { wallet } = req.params;
  const db = getDatabase();
  
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
};

const updateProfile = (req, res) => {
  const { wallet, username, profilePicture } = req.body;
  const db = getDatabase();
  
  if (!wallet) {
    return res.status(400).json({ error: 'Wallet address required' });
  }
  
  const updatedAt = Date.now();
  
  db.run(
    `INSERT INTO profiles (wallet_address, username, profile_picture, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(wallet_address) 
     DO UPDATE SET 
       username = COALESCE(?, username),
       profile_picture = COALESCE(?, profile_picture),
       updated_at = ?`,
    [wallet, username, profilePicture, updatedAt, username, profilePicture, updatedAt],
    (err) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({ success: true });
    }
  );
};

const getProfilesBatch = (req, res) => {
  const { wallets } = req.body;
  const db = getDatabase();
  
  if (!Array.isArray(wallets) || wallets.length === 0) {
    return res.status(400).json({ error: 'Invalid wallet array' });
  }
  
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
};

module.exports = {
  getProfile,
  updateProfile,
  getProfilesBatch
};