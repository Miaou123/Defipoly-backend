// ============================================
// FILE: server.js
// Enhanced backend with game actions storage
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
app.use(express.json({ limit: '10mb' }));

// Initialize SQLite database
const db = new sqlite3.Database('./defipoly.db', (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('✅ Connected to SQLite database');
    initDatabase();
  }
});

// Create tables
function initDatabase() {
  // Profiles table (existing)
  db.run(`
    CREATE TABLE IF NOT EXISTS profiles (
      wallet_address TEXT PRIMARY KEY,
      username TEXT,
      profile_picture TEXT,
      updated_at INTEGER
    )
  `, (err) => {
    if (err) console.error('Error creating profiles table:', err);
    else console.log('✅ Profiles table ready');
  });

  // Game actions table (NEW)
  db.run(`
    CREATE TABLE IF NOT EXISTS game_actions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tx_signature TEXT UNIQUE NOT NULL,
      action_type TEXT NOT NULL,
      player_address TEXT NOT NULL,
      property_id INTEGER,
      target_address TEXT,
      amount INTEGER,
      slots INTEGER,
      success BOOLEAN,
      metadata TEXT,
      block_time INTEGER NOT NULL,
      created_at INTEGER DEFAULT (strftime('%s', 'now'))
    )
  `, (err) => {
    if (err) console.error('Error creating game_actions table:', err);
    else console.log('✅ Game actions table ready');
  });

  // Create indexes for fast queries
  db.run(`CREATE INDEX IF NOT EXISTS idx_actions_player ON game_actions(player_address, block_time DESC)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_actions_type ON game_actions(action_type, block_time DESC)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_actions_property ON game_actions(property_id, block_time DESC)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_actions_time ON game_actions(block_time DESC)`);
  
  // Player stats cache table (NEW - for performance)
  db.run(`
    CREATE TABLE IF NOT EXISTS player_stats (
      wallet_address TEXT PRIMARY KEY,
      total_actions INTEGER DEFAULT 0,
      properties_bought INTEGER DEFAULT 0,
      properties_sold INTEGER DEFAULT 0,
      successful_steals INTEGER DEFAULT 0,
      failed_steals INTEGER DEFAULT 0,
      rewards_claimed INTEGER DEFAULT 0,
      shields_activated INTEGER DEFAULT 0,
      total_spent INTEGER DEFAULT 0,
      total_earned INTEGER DEFAULT 0,
      last_action_time INTEGER,
      updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    )
  `, (err) => {
    if (err) console.error('Error creating player_stats table:', err);
    else console.log('✅ Player stats table ready');
  });
}

// ============================================
// PROFILE ENDPOINTS (EXISTING)
// ============================================

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

app.post('/api/profile', (req, res) => {
  const { wallet, username, profilePicture } = req.body;
  
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
});

app.post('/api/profiles/batch', (req, res) => {
  const { wallets } = req.body;
  
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
});

// ============================================
// GAME ACTIONS ENDPOINTS (NEW)
// ============================================

// Store a game action
app.post('/api/actions', (req, res) => {
  const {
    txSignature,
    actionType,
    playerAddress,
    propertyId,
    targetAddress,
    amount,
    slots,
    success,
    metadata,
    blockTime
  } = req.body;

  if (!txSignature || !actionType || !playerAddress || !blockTime) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const metadataJson = metadata ? JSON.stringify(metadata) : null;

  db.run(
    `INSERT INTO game_actions 
     (tx_signature, action_type, player_address, property_id, target_address, 
      amount, slots, success, metadata, block_time)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tx_signature) DO NOTHING`,
    [txSignature, actionType, playerAddress, propertyId, targetAddress, 
     amount, slots, success, metadataJson, blockTime],
    function(err) {
      if (err) {
        console.error('Error storing action:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      // Update player stats asynchronously
      updatePlayerStats(playerAddress, actionType, amount);

      res.json({ success: true, id: this.lastID });
    }
  );
});

// Batch store actions (for bulk imports)
app.post('/api/actions/batch', (req, res) => {
  const { actions } = req.body;

  if (!Array.isArray(actions) || actions.length === 0) {
    return res.status(400).json({ error: 'Invalid actions array' });
  }

  const stmt = db.prepare(`
    INSERT INTO game_actions 
    (tx_signature, action_type, player_address, property_id, target_address, 
     amount, slots, success, metadata, block_time)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(tx_signature) DO NOTHING
  `);

  let inserted = 0;
  actions.forEach(action => {
    const metadata = action.metadata ? JSON.stringify(action.metadata) : null;
    stmt.run([
      action.txSignature,
      action.actionType,
      action.playerAddress,
      action.propertyId || null,
      action.targetAddress || null,
      action.amount || null,
      action.slots || null,
      action.success !== undefined ? action.success : null,
      metadata,
      action.blockTime
    ], function(err) {
      if (!err && this.changes > 0) {
        inserted++;
        updatePlayerStats(action.playerAddress, action.actionType, action.amount);
      }
    });
  });

  stmt.finalize((err) => {
    if (err) {
      console.error('Error in batch insert:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json({ success: true, inserted });
  });
});

// Get player's actions history
app.get('/api/actions/player/:wallet', (req, res) => {
  const { wallet } = req.params;
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const offset = parseInt(req.query.offset) || 0;

  db.all(
    `SELECT * FROM game_actions 
     WHERE player_address = ? OR target_address = ?
     ORDER BY block_time DESC 
     LIMIT ? OFFSET ?`,
    [wallet, wallet, limit, offset],
    (err, rows) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      const actions = rows.map(row => ({
        id: row.id,
        txSignature: row.tx_signature,
        actionType: row.action_type,
        playerAddress: row.player_address,
        propertyId: row.property_id,
        targetAddress: row.target_address,
        amount: row.amount,
        slots: row.slots,
        success: row.success,
        metadata: row.metadata ? JSON.parse(row.metadata) : null,
        blockTime: row.block_time,
        createdAt: row.created_at
      }));
      
      res.json({ actions, count: actions.length });
    }
  );
});

// Get recent actions (for live feed)
app.get('/api/actions/recent', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);

  db.all(
    `SELECT * FROM game_actions 
     ORDER BY block_time DESC 
     LIMIT ?`,
    [limit],
    (err, rows) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      const actions = rows.map(row => ({
        id: row.id,
        txSignature: row.tx_signature,
        actionType: row.action_type,
        playerAddress: row.player_address,
        propertyId: row.property_id,
        targetAddress: row.target_address,
        amount: row.amount,
        slots: row.slots,
        success: row.success,
        metadata: row.metadata ? JSON.parse(row.metadata) : null,
        blockTime: row.block_time
      }));
      
      res.json({ actions });
    }
  );
});

// Get player stats
app.get('/api/stats/:wallet', (req, res) => {
  const { wallet } = req.params;

  db.get(
    'SELECT * FROM player_stats WHERE wallet_address = ?',
    [wallet],
    (err, row) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!row) {
        return res.json({
          walletAddress: wallet,
          totalActions: 0,
          propertiesBought: 0,
          propertiesSold: 0,
          successfulSteals: 0,
          failedSteals: 0,
          rewardsClaimed: 0,
          shieldsActivated: 0,
          totalSpent: 0,
          totalEarned: 0
        });
      }
      
      res.json({
        walletAddress: row.wallet_address,
        totalActions: row.total_actions,
        propertiesBought: row.properties_bought,
        propertiesSold: row.properties_sold,
        successfulSteals: row.successful_steals,
        failedSteals: row.failed_steals,
        rewardsClaimed: row.rewards_claimed,
        shieldsActivated: row.shields_activated,
        totalSpent: row.total_spent,
        totalEarned: row.total_earned,
        lastActionTime: row.last_action_time,
        updatedAt: row.updated_at
      });
    }
  );
});

// Leaderboard endpoint
app.get('/api/leaderboard', (req, res) => {
  const type = req.query.type || 'actions'; // actions, steals, bought
  const limit = Math.min(parseInt(req.query.limit) || 10, 100);

  let orderBy;
  switch(type) {
    case 'steals':
      orderBy = 'successful_steals DESC';
      break;
    case 'bought':
      orderBy = 'properties_bought DESC';
      break;
    default:
      orderBy = 'total_actions DESC';
  }

  db.all(
    `SELECT * FROM player_stats 
     WHERE total_actions > 0
     ORDER BY ${orderBy}
     LIMIT ?`,
    [limit],
    (err, rows) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      const leaderboard = rows.map(row => ({
        walletAddress: row.wallet_address,
        totalActions: row.total_actions,
        propertiesBought: row.properties_bought,
        successfulSteals: row.successful_steals,
        failedSteals: row.failed_steals,
        rewardsClaimed: row.rewards_claimed
      }));
      
      res.json({ leaderboard });
    }
  );
});

// Helper function to update player stats
function updatePlayerStats(playerAddress, actionType, amount) {
  db.run(
    `INSERT INTO player_stats (wallet_address, total_actions, last_action_time)
     VALUES (?, 1, ?)
     ON CONFLICT(wallet_address) DO UPDATE SET
       total_actions = total_actions + 1,
       last_action_time = ?,
       updated_at = strftime('%s', 'now')`,
    [playerAddress, Date.now(), Date.now()],
    (err) => {
      if (err) console.error('Error updating player stats:', err);
    }
  );

  // Update specific stats based on action type
  let updateField = null;
  let spentEarned = null;

  switch(actionType) {
    case 'buy':
      updateField = 'properties_bought = properties_bought + 1';
      spentEarned = amount ? `total_spent = total_spent + ${amount}` : null;
      break;
    case 'sell':
      updateField = 'properties_sold = properties_sold + 1';
      spentEarned = amount ? `total_earned = total_earned + ${amount}` : null;
      break;
    case 'steal_success':
      updateField = 'successful_steals = successful_steals + 1';
      break;
    case 'steal_failed':
      updateField = 'failed_steals = failed_steals + 1';
      break;
    case 'claim':
      updateField = 'rewards_claimed = rewards_claimed + 1';
      spentEarned = amount ? `total_earned = total_earned + ${amount}` : null;
      break;
    case 'shield':
      updateField = 'shields_activated = shields_activated + 1';
      spentEarned = amount ? `total_spent = total_spent + ${amount}` : null;
      break;
  }

  if (updateField) {
    const updateSql = spentEarned 
      ? `UPDATE player_stats SET ${updateField}, ${spentEarned} WHERE wallet_address = ?`
      : `UPDATE player_stats SET ${updateField} WHERE wallet_address = ?`;
    
    db.run(updateSql, [playerAddress], (err) => {
      if (err) console.error('Error updating specific stats:', err);
    });
  }
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
  console.log(`🚀 Defipoly API running on port ${PORT}`);
  console.log(`📊 Database: SQLite (defipoly.db)`);
  console.log(`✅ Profile storage enabled`);
  console.log(`✅ Game actions storage enabled`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) console.error(err);
    console.log('Database connection closed');
    process.exit(0);
  });
});