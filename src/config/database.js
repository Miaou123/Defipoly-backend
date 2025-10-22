const sqlite3 = require('sqlite3').verbose();

let db = null;

function initDatabase() {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database('./defipoly.db', (err) => {
      if (err) {
        console.error('Error opening database:', err);
        reject(err);
      } else {
        console.log('✅ Connected to SQLite database');
        createTables()
          .then(() => resolve(db))
          .catch(reject);
      }
    });
  });
}

function createTables() {
  return new Promise((resolve, reject) => {
    let completed = 0;
    const totalTables = 4;
    let hasError = false;

    const checkCompletion = () => {
      completed++;
      if (completed === totalTables && !hasError) {
        // Create indexes after all tables are created
        createIndexes()
          .then(() => resolve())
          .catch(reject);
      }
    };

    // Profiles table
    db.run(`
      CREATE TABLE IF NOT EXISTS profiles (
        wallet_address TEXT PRIMARY KEY,
        username TEXT,
        profile_picture TEXT,
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `, (err) => {
      if (err) {
        console.error('Error creating profiles table:', err);
        hasError = true;
        return reject(err);
      }
      console.log('✅ Profiles table ready');
      checkCompletion();
    });

    // Property ownership table
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
      if (err) {
        console.error('Error creating property_ownership table:', err);
        hasError = true;
        return reject(err);
      }
      console.log('✅ Property ownership table ready');
      checkCompletion();
    });

    // Game actions table
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
      if (err) {
        console.error('Error creating game_actions table:', err);
        hasError = true;
        return reject(err);
      }
      console.log('✅ Game actions table ready');
      checkCompletion();
    });

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
      if (err) {
        console.error('Error creating player_stats table:', err);
        hasError = true;
        return reject(err);
      }
      console.log('✅ Player stats table ready');
      checkCompletion();
    });
  });
}

function createIndexes() {
  return new Promise((resolve) => {
    // Create optimized indexes
    db.run(`CREATE INDEX IF NOT EXISTS idx_actions_player_time ON game_actions(player_address, block_time DESC)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_actions_type_time ON game_actions(action_type, block_time DESC)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_actions_property_time ON game_actions(property_id, block_time DESC)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_actions_player_type_property ON game_actions(player_address, action_type, property_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_ownership_wallet ON property_ownership(wallet_address)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_ownership_property ON property_ownership(property_id)`);
    db.run(`ALTER TABLE player_stats ADD COLUMN total_slots_owned INTEGER DEFAULT 0`, () => {});
    db.run(`ALTER TABLE player_stats ADD COLUMN daily_income INTEGER DEFAULT 0`, () => {});
    db.run(`ALTER TABLE property_ownership ADD COLUMN slots_shielded INTEGER DEFAULT 0`, () => {});
    db.run(`ALTER TABLE property_ownership ADD COLUMN shield_expiry INTEGER DEFAULT 0`, () => {});


    console.log('✅ Database indexes created');
    resolve();
  });
}

function getDatabase() {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

function closeDatabase() {
  return new Promise((resolve) => {
    if (db) {
      db.close((err) => {
        if (err) console.error('Error closing database:', err);
        else console.log('✅ Database connection closed');
        resolve();
      });
    } else {
      resolve();
    }
  });
}

module.exports = {
  initDatabase,
  getDatabase,
  closeDatabase
};