// ============================================
// FILE: server.js
// Defipoly Backend - Fully Updated for Current Program
// ============================================

const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ============================================
// GAME CONSTANTS (Match your Solana program)
// ============================================

// Property set mappings - MUST match your frontend PROPERTIES constant
const PROPERTY_SETS = {
  0: [0, 1],           // Brown: Mediterranean Avenue, Baltic Avenue
  1: [2, 3, 4],        // Light Blue: Oriental Avenue, Vermont Avenue, Connecticut Avenue
  2: [5, 6, 7],        // Pink: St. Charles Place, States Avenue, Virginia Avenue
  3: [8, 9, 10],       // Orange: St. James Place, Tennessee Avenue, New York Avenue
  4: [11, 12, 13],     // Red: Kentucky Avenue, Indiana Avenue, Illinois Avenue
  5: [14, 15, 16],     // Yellow: Atlantic Avenue, Ventnor Avenue, Marvin Gardens
  6: [17, 18, 19],     // Green: Pacific Avenue, North Carolina Avenue, Pennsylvania Avenue
  7: [20, 21]          // Dark Blue: Park Place, Boardwalk
};

// Cooldown duration: 24 hours in seconds
const COOLDOWN_DURATION = 86400;

// Initialize SQLite database
const db = new sqlite3.Database('./defipoly.db', (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('✅ Connected to SQLite database');
    initDatabase();
  }
});

// ============================================
// DATABASE INITIALIZATION
// ============================================

function initDatabase() {
  // Profiles table
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

  // Game actions table - Enhanced for current program
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

  // Create optimized indexes
  db.run(`CREATE INDEX IF NOT EXISTS idx_actions_player_time ON game_actions(player_address, block_time DESC)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_actions_type_time ON game_actions(action_type, block_time DESC)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_actions_property_time ON game_actions(property_id, block_time DESC)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_actions_player_type_property ON game_actions(player_address, action_type, property_id)`);
  
  // Player stats table
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
// PROFILE ENDPOINTS
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
// GAME ACTIONS ENDPOINTS
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
      if (this.changes > 0) {
        updatePlayerStats(playerAddress, actionType, amount);
      }

      res.json({ success: true, id: this.lastID });
    }
  );
});

// Batch store actions
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
  const actionType = req.query.type; // Optional filter

  let query = `SELECT * FROM game_actions 
     WHERE (player_address = ? OR target_address = ?)`;
  
  const params = [wallet, wallet];
  
  if (actionType) {
    query += ` AND action_type = ?`;
    params.push(actionType);
  }
  
  query += ` ORDER BY block_time DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  db.all(query, params, (err, rows) => {
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
  });
});

// Get recent actions (for live feed)
app.get('/api/actions/recent', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const actionType = req.query.type; // Optional filter

  let query = `SELECT * FROM game_actions`;
  const params = [];
  
  if (actionType) {
    query += ` WHERE action_type = ?`;
    params.push(actionType);
  }
  
  query += ` ORDER BY block_time DESC LIMIT ?`;
  params.push(limit);

  db.all(query, params, (err, rows) => {
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
  });
});

// Get actions for a specific property
app.get('/api/actions/property/:propertyId', (req, res) => {
  const { propertyId } = req.params;
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);

  db.all(
    `SELECT * FROM game_actions 
     WHERE property_id = ?
     ORDER BY block_time DESC 
     LIMIT ?`,
    [propertyId, limit],
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
      
      res.json({ actions, count: actions.length });
    }
  );
});

// ============================================
// COOLDOWN SYSTEM (NEW)
// ============================================

// Get cooldown status for a player's set
app.get('/api/cooldown/:wallet/:setId', (req, res) => {
  const { wallet, setId } = req.params;
  const setIdNum = parseInt(setId);

  // Validate setId
  if (isNaN(setIdNum) || setIdNum < 0 || setIdNum > 7) {
    return res.status(400).json({ error: 'Invalid setId (must be 0-7)' });
  }

  const propertiesInSet = PROPERTY_SETS[setIdNum];
  if (!propertiesInSet) {
    return res.status(400).json({ error: 'Invalid set' });
  }

  const placeholders = propertiesInSet.map(() => '?').join(',');

  // Get the most recent 'buy' action for any property in this set
  db.get(
    `SELECT property_id, block_time, tx_signature
     FROM game_actions
     WHERE player_address = ?
       AND action_type = 'buy'
       AND property_id IN (${placeholders})
     ORDER BY block_time DESC
     LIMIT 1`,
    [wallet, ...propertiesInSet],
    (err, row) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      // No purchases in this set yet
      if (!row) {
        return res.json({
          isOnCooldown: false,
          cooldownRemaining: 0,
          lastPurchaseTimestamp: 0,
          lastPurchasedPropertyId: null,
          cooldownDuration: COOLDOWN_DURATION,
          affectedPropertyIds: propertiesInSet,
          setId: setIdNum
        });
      }

      const now = Math.floor(Date.now() / 1000);
      const elapsed = now - row.block_time;
      const remaining = Math.max(0, COOLDOWN_DURATION - elapsed);

      res.json({
        isOnCooldown: remaining > 0,
        cooldownRemaining: remaining,
        lastPurchaseTimestamp: row.block_time,
        lastPurchasedPropertyId: row.property_id,
        cooldownDuration: COOLDOWN_DURATION,
        affectedPropertyIds: propertiesInSet,
        setId: setIdNum
      });
    }
  );
});

// Get all active cooldowns for a player
app.get('/api/cooldown/:wallet', (req, res) => {
  const { wallet } = req.params;

  const cooldowns = [];
  let completed = 0;

  // Check each set
  Object.keys(PROPERTY_SETS).forEach((setId) => {
    const propertiesInSet = PROPERTY_SETS[setId];
    const placeholders = propertiesInSet.map(() => '?').join(',');

    db.get(
      `SELECT property_id, block_time
       FROM game_actions
       WHERE player_address = ?
         AND action_type = 'buy'
         AND property_id IN (${placeholders})
       ORDER BY block_time DESC
       LIMIT 1`,
      [wallet, ...propertiesInSet],
      (err, row) => {
        if (err) {
          console.error('Database error:', err);
          return;
        }

        if (row) {
          const now = Math.floor(Date.now() / 1000);
          const elapsed = now - row.block_time;
          const remaining = Math.max(0, COOLDOWN_DURATION - elapsed);

          if (remaining > 0) {
            cooldowns.push({
              setId: parseInt(setId),
              isOnCooldown: true,
              cooldownRemaining: remaining,
              lastPurchaseTimestamp: row.block_time,
              lastPurchasedPropertyId: row.property_id,
              affectedPropertyIds: propertiesInSet
            });
          }
        }

        completed++;
        if (completed === Object.keys(PROPERTY_SETS).length) {
          res.json({ cooldowns, activeCooldowns: cooldowns.length });
        }
      }
    );
  });
});

// ============================================
// PLAYER STATS ENDPOINTS
// ============================================

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
  const type = req.query.type || 'actions';
  const limit = Math.min(parseInt(req.query.limit) || 10, 100);

  let orderBy;
  switch(type) {
    case 'steals':
      orderBy = 'successful_steals DESC';
      break;
    case 'bought':
      orderBy = 'properties_bought DESC';
      break;
    case 'earned':
      orderBy = 'total_earned DESC';
      break;
    case 'spent':
      orderBy = 'total_spent DESC';
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
        rewardsClaimed: row.rewards_claimed,
        totalSpent: row.total_spent,
        totalEarned: row.total_earned
      }));
      
      res.json({ leaderboard });
    }
  );
});

// ============================================
// HELPER FUNCTIONS
// ============================================

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

// ============================================
// HEALTH & UTILITY ENDPOINTS
// ============================================

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: Date.now(),
    version: '2.0.0',
    features: ['profiles', 'actions', 'cooldowns', 'stats', 'leaderboard']
  });
});

// Get game constants (useful for frontend)
app.get('/api/game/constants', (req, res) => {
  res.json({
    propertySets: PROPERTY_SETS,
    cooldownDuration: COOLDOWN_DURATION,
    totalProperties: 22,
    totalSets: 8
  });
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
  console.log(`🚀 Defipoly API v2.0 running on port ${PORT}`);
  console.log(`📊 Database: SQLite (defipoly.db)`);
  console.log(`✅ Profile storage enabled`);
  console.log(`✅ Game actions tracking enabled`);
  console.log(`✅ Cooldown system enabled`);
  console.log(`✅ Player stats & leaderboard enabled`);
  console.log(`\n📡 Available endpoints:`);
  console.log(`   GET  /health`);
  console.log(`   GET  /api/game/constants`);
  console.log(`   GET  /api/cooldown/:wallet/:setId`);
  console.log(`   GET  /api/cooldown/:wallet`);
  console.log(`   GET  /api/stats/:wallet`);
  console.log(`   GET  /api/leaderboard`);
  console.log(`   GET  /api/actions/recent`);
  console.log(`   GET  /api/actions/player/:wallet`);
  console.log(`   GET  /api/actions/property/:propertyId`);
  console.log(`   POST /api/actions`);
  console.log(`   POST /api/actions/batch`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) console.error(err);
    console.log('\n✅ Database connection closed');
    process.exit(0);
  });
});