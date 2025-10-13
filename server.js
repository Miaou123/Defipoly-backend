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
const PROPERTIES = [
  // Set 0 - Brown
  { id: 0, setId: 0, price: 1000000000000, yieldBps: 100 },      // Mediterranean
  { id: 1, setId: 0, price: 1200000000000, yieldBps: 100 },      // Baltic
  // Set 1 - Light Blue
  { id: 2, setId: 1, price: 2500000000000, yieldBps: 120 },      // Oriental
  { id: 3, setId: 1, price: 2500000000000, yieldBps: 120 },      // Vermont
  { id: 4, setId: 1, price: 3000000000000, yieldBps: 120 },      // Connecticut
  // Set 2 - Pink
  { id: 5, setId: 2, price: 3500000000000, yieldBps: 140 },      // St. Charles
  { id: 6, setId: 2, price: 3500000000000, yieldBps: 140 },      // States
  { id: 7, setId: 2, price: 4000000000000, yieldBps: 140 },      // Virginia
  // Set 3 - Orange
  { id: 8, setId: 3, price: 4500000000000, yieldBps: 160 },      // St. James
  { id: 9, setId: 3, price: 4500000000000, yieldBps: 160 },      // Tennessee
  { id: 10, setId: 3, price: 5000000000000, yieldBps: 160 },     // New York
  // Set 4 - Red
  { id: 11, setId: 4, price: 5500000000000, yieldBps: 180 },     // Kentucky
  { id: 12, setId: 4, price: 5500000000000, yieldBps: 180 },     // Indiana
  { id: 13, setId: 4, price: 6000000000000, yieldBps: 180 },     // Illinois
  // Set 5 - Yellow
  { id: 14, setId: 5, price: 6500000000000, yieldBps: 200 },     // Atlantic
  { id: 15, setId: 5, price: 6500000000000, yieldBps: 200 },     // Ventnor
  { id: 16, setId: 5, price: 7000000000000, yieldBps: 200 },     // Marvin Gardens
  // Set 6 - Green
  { id: 17, setId: 6, price: 7500000000000, yieldBps: 220 },     // Pacific
  { id: 18, setId: 6, price: 7500000000000, yieldBps: 220 },     // North Carolina
  { id: 19, setId: 6, price: 8000000000000, yieldBps: 220 },     // Pennsylvania
  // Set 7 - Dark Blue
  { id: 20, setId: 7, price: 10000000000000, yieldBps: 250 },    // Park Place
  { id: 21, setId: 7, price: 12000000000000, yieldBps: 250 },    // Boardwalk
];

const SET_BONUS_BPS = 4000;

// Cooldown duration: 12 hours in seconds
const COOLDOWN_DURATION = 43200;

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
    CREATE TABLE IF NOT EXISTS property_ownership (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wallet_address TEXT NOT NULL,
      property_id INTEGER NOT NULL,
      slots_owned INTEGER DEFAULT 0,
      last_updated INTEGER DEFAULT (strftime('%s', 'now')),
      UNIQUE(wallet_address, property_id)
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

    // Property ownership tracking
    db.run(`
    CREATE TABLE IF NOT EXISTS property_ownership (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wallet_address TEXT NOT NULL,
      property_id INTEGER NOT NULL,
      slots_owned INTEGER DEFAULT 0,
      last_updated INTEGER DEFAULT (strftime('%s', 'now')),
      UNIQUE(wallet_address, property_id)
    )
  `, (err) => {
    if (err) console.error('Error creating property_ownership table:', err);
    else console.log('✅ Property ownership table ready');
  });

  db.run(`CREATE INDEX IF NOT EXISTS idx_ownership_wallet ON property_ownership(wallet_address)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_ownership_property ON property_ownership(property_id)`);
  
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
      total_slots_owned INTEGER DEFAULT 0,
      daily_income INTEGER DEFAULT 0,
      last_action_time INTEGER,
      updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    )
  `, (err) => {
    if (err) console.error('Error creating player_stats table:', err);
    else console.log('✅ Player stats table ready');
  });

  // Add columns if they don't exist
  db.run(`ALTER TABLE player_stats ADD COLUMN total_slots_owned INTEGER DEFAULT 0`, () => {});
  db.run(`ALTER TABLE player_stats ADD COLUMN daily_income INTEGER DEFAULT 0`, () => {});
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
    blockTime,
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

      if (this.changes > 0) {
        updatePlayerStats(playerAddress, actionType, amount, slots, propertyId);
        
        if (actionType === 'steal_success' && targetAddress && slots && propertyId !== undefined) {
          updateTargetOnSteal(targetAddress, propertyId, slots);
        }
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
          totalEarned: 0,
          totalSlotsOwned: 0
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
        totalSlotsOwned: row.total_slots_owned,
        lastActionTime: row.last_action_time,
        updatedAt: row.updated_at
      });
    }
  );
});

// ============================================
// LEADERBOARD ENDPOINT - BY DAILY INCOME ONLY
// ============================================

app.get('/api/leaderboard', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 10, 100);

  db.all(
    `SELECT * FROM player_stats 
     WHERE total_actions > 0 AND daily_income > 0
     ORDER BY daily_income DESC
     LIMIT ?`,
    [limit],
    (err, rows) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      const leaderboard = rows.map(row => ({
        walletAddress: row.wallet_address,
        dailyIncome: row.daily_income,
        totalSlotsOwned: row.total_slots_owned,
        propertiesBought: row.properties_bought,
        totalEarned: row.total_earned,
      }));
      
      res.json({ leaderboard });
    }
  );
});

// ============================================
// DAILY INCOME CALCULATION
// ============================================

/**
 * Calculate a player's actual daily income with set bonuses
 */
function calculateDailyIncome(walletAddress, callback) {
  // Get all properties owned by this player
  db.all(
    `SELECT property_id, slots_owned FROM property_ownership 
     WHERE wallet_address = ? AND slots_owned > 0`,
    [walletAddress],
    (err, ownerships) => {
      if (err || !ownerships || ownerships.length === 0) {
        return callback(0);
      }

      // Group by set
      const setData = {};
      for (let i = 0; i < 8; i++) {
        setData[i] = { properties: [], totalSlots: 0, minSlots: Infinity };
      }

      // Process each ownership
      ownerships.forEach(own => {
        const property = PROPERTIES.find(p => p.id === own.property_id);
        if (!property) return;

        const setId = property.setId;
        setData[setId].properties.push({
          propertyId: own.property_id,
          slots: own.slots_owned,
          dailyIncomePerSlot: (property.price * property.yieldBps) / 10000
        });
        setData[setId].totalSlots += own.slots_owned;
        setData[setId].minSlots = Math.min(setData[setId].minSlots, own.slots_owned);
      });

      // Calculate total daily income
      let totalDailyIncome = 0;

      Object.keys(setData).forEach(setId => {
        const set = setData[setId];
        if (set.properties.length === 0) return;

        const requiredProperties = getPropertiesInSet(parseInt(setId));
        const hasCompleteSet = set.properties.length >= requiredProperties;

        set.properties.forEach(prop => {
          const baseDailyIncome = prop.dailyIncomePerSlot * prop.slots;

          if (hasCompleteSet && set.minSlots > 0) {
            // Split into bonus and non-bonus slots
            const bonusSlots = Math.min(prop.slots, set.minSlots);
            const baseSlots = prop.slots - bonusSlots;

            // Base slots get normal income
            const baseIncome = baseSlots * prop.dailyIncomePerSlot;

            // Bonus slots get 40% extra
            const bonusIncome = bonusSlots * prop.dailyIncomePerSlot * (10000 + SET_BONUS_BPS) / 10000;

            totalDailyIncome += baseIncome + bonusIncome;
          } else {
            // No set bonus
            totalDailyIncome += baseDailyIncome;
          }
        });
      });

      callback(Math.floor(totalDailyIncome));
    }
  );
}

/**
 * Update property ownership and recalculate daily income
 */
function updatePropertyOwnership(walletAddress, propertyId, slotsDelta, callback) {
  db.run(
    `INSERT INTO property_ownership (wallet_address, property_id, slots_owned, last_updated)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(wallet_address, property_id) 
     DO UPDATE SET 
       slots_owned = slots_owned + ?,
       last_updated = ?`,
    [walletAddress, propertyId, slotsDelta, Date.now(), slotsDelta, Date.now()],
    (err) => {
      if (err) {
        console.error('Error updating property ownership:', err);
        if (callback) callback(err);
        return;
      }

      // Recalculate and update daily income
      calculateDailyIncome(walletAddress, (dailyIncome) => {
        db.run(
          `UPDATE player_stats SET daily_income = ? WHERE wallet_address = ?`,
          [dailyIncome, walletAddress],
          (err) => {
            if (err) console.error('Error updating daily income:', err);
            if (callback) callback(null, dailyIncome);
          }
        );
      });
    }
  );
}


// ============================================
// HELPER FUNCTIONS
// ============================================

function updatePlayerStats(playerAddress, actionType, amount, slots, propertyId) {
  // Insert or increment total actions
  db.run(
    `INSERT INTO player_stats (wallet_address, total_actions, last_action_time)
     VALUES (?, 1, ?)
     ON CONFLICT(wallet_address) 
     DO UPDATE SET 
       total_actions = total_actions + 1,
       last_action_time = ?,
       updated_at = strftime('%s', 'now')`,
    [playerAddress, Date.now(), Date.now()]
  );

  let updateField = null;
  let spentEarned = null;

  switch (actionType) {
    case 'buy':
      updateField = 'properties_bought = properties_bought + 1';
      if (slots) {
        updateField += `, total_slots_owned = total_slots_owned + ${slots}`;
      }
      spentEarned = amount ? `total_spent = total_spent + ${amount}` : null;

      // Update property ownership and daily income
      if (propertyId !== undefined && slots) {
        updatePropertyOwnership(playerAddress, propertyId, slots);
      }
      break;

    case 'sell':
      updateField = 'properties_sold = properties_sold + 1';
      if (slots) {
        updateField += `, total_slots_owned = total_slots_owned - ${slots}`;
      }
      spentEarned = amount ? `total_earned = total_earned + ${amount}` : null;

      // Update property ownership and daily income
      if (propertyId !== undefined && slots) {
        updatePropertyOwnership(playerAddress, propertyId, -slots);
      }
      break;

    case 'steal_success':
      updateField = 'successful_steals = successful_steals + 1';
      if (slots) {
        updateField += `, total_slots_owned = total_slots_owned + ${slots}`;
      }
      spentEarned = amount ? `total_spent = total_spent + ${amount}` : null;

      // Update property ownership and daily income
      if (propertyId !== undefined && slots) {
        updatePropertyOwnership(playerAddress, propertyId, slots);
      }
      break;

    case 'steal_failed':
      updateField = 'failed_steals = failed_steals + 1';
      spentEarned = amount ? `total_spent = total_spent + ${amount}` : null;
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
    
    db.run(updateSql, [playerAddress]);
  }
}

/**
 * Update target player when they lose slots from steal
 */
function updateTargetOnSteal(targetAddress, propertyId, slots) {
  if (propertyId !== undefined && slots) {
    updatePropertyOwnership(targetAddress, propertyId, -slots);
  }
  
  db.run(
    `UPDATE player_stats 
     SET total_slots_owned = total_slots_owned - ?
     WHERE wallet_address = ?`,
    [slots, targetAddress]
  );
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
// GET PLAYER OWNERSHIP DETAILS
// ============================================

app.get('/api/ownership/:wallet', (req, res) => {
  const { wallet } = req.params;

  db.all(
    `SELECT property_id, slots_owned FROM property_ownership 
     WHERE wallet_address = ? AND slots_owned > 0`,
    [wallet],
    (err, rows) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      res.json({ ownerships: rows });
    }
  );
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