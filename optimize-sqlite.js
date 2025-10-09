// ============================================
// FILE: optimize-sqlite.js
// Run this to optimize SQLite for production use
// ============================================

const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

const DB_PATH = './defipoly.db';

function optimizeDatabase() {
  console.log('🔧 Starting SQLite optimization...\n');

  const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
      console.error('❌ Error opening database:', err);
      process.exit(1);
    }
  });

  // Configuration options
  const optimizations = [
    // WAL mode for better concurrency (CRITICAL)
    {
      name: 'WAL Mode',
      query: 'PRAGMA journal_mode = WAL',
      description: 'Write-Ahead Logging for concurrent reads/writes'
    },
    
    // Synchronous mode (balanced safety/performance)
    {
      name: 'Synchronous Normal',
      query: 'PRAGMA synchronous = NORMAL',
      description: 'Balance between safety and speed'
    },
    
    // Cache size (increase for better performance)
    {
      name: 'Cache Size',
      query: 'PRAGMA cache_size = -64000', // 64MB cache
      description: 'In-memory cache for faster queries'
    },
    
    // Temp store in memory
    {
      name: 'Temp Store',
      query: 'PRAGMA temp_store = MEMORY',
      description: 'Store temporary tables in memory'
    },
    
    // Memory-mapped I/O
    {
      name: 'MMAP Size',
      query: 'PRAGMA mmap_size = 268435456', // 256MB
      description: 'Memory-mapped I/O for large databases'
    },
    
    // Page size (optimal for modern systems)
    {
      name: 'Page Size',
      query: 'PRAGMA page_size = 4096',
      description: 'Optimal page size for modern systems'
    },
    
    // Foreign keys enforcement (good practice)
    {
      name: 'Foreign Keys',
      query: 'PRAGMA foreign_keys = ON',
      description: 'Enable foreign key constraints'
    },
    
    // Auto vacuum incremental
    {
      name: 'Auto Vacuum',
      query: 'PRAGMA auto_vacuum = INCREMENTAL',
      description: 'Prevent database bloat'
    }
  ];

  // Apply each optimization
  let completed = 0;
  optimizations.forEach((opt, index) => {
    db.run(opt.query, (err) => {
      if (err) {
        console.error(`❌ ${opt.name} failed:`, err.message);
      } else {
        console.log(`✅ ${opt.name}: ${opt.description}`);
      }
      
      completed++;
      if (completed === optimizations.length) {
        runDiagnostics(db);
      }
    });
  });
}

function runDiagnostics(db) {
  console.log('\n📊 Running diagnostics...\n');

  // Check database size
  db.get('SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()', 
    (err, row) => {
      if (!err) {
        const sizeMB = (row.size / 1024 / 1024).toFixed(2);
        console.log(`📁 Database size: ${sizeMB} MB`);
      }
    }
  );

  // Count records
  db.get('SELECT COUNT(*) as count FROM game_actions', (err, row) => {
    if (!err) {
      console.log(`📝 Game actions: ${row.count.toLocaleString()}`);
    }
  });

  db.get('SELECT COUNT(*) as count FROM profiles', (err, row) => {
    if (!err) {
      console.log(`👤 Profiles: ${row.count.toLocaleString()}`);
    }
  });

  db.get('SELECT COUNT(*) as count FROM player_stats', (err, row) => {
    if (!err) {
      console.log(`📈 Player stats: ${row.count.toLocaleString()}`);
    }
  });

  // Check indexes
  db.all("SELECT name FROM sqlite_master WHERE type='index'", (err, rows) => {
    if (!err) {
      console.log(`\n🔍 Indexes (${rows.length}):`);
      rows.forEach(row => console.log(`   - ${row.name}`));
    }
  });

  // Performance test
  console.log('\n⚡ Running performance test...');
  const startTime = Date.now();
  
  db.all('SELECT * FROM game_actions ORDER BY block_time DESC LIMIT 100', (err, rows) => {
    const duration = Date.now() - startTime;
    if (!err) {
      console.log(`   Query time: ${duration}ms (fetched ${rows.length} rows)`);
      console.log(`   ${duration < 50 ? '🟢 Excellent' : duration < 100 ? '🟡 Good' : '🔴 Needs optimization'}`);
    }

    // Run vacuum
    console.log('\n🧹 Running VACUUM to reclaim space...');
    db.run('VACUUM', (err) => {
      if (err) {
        console.error('❌ VACUUM failed:', err);
      } else {
        console.log('✅ VACUUM complete');
      }

      // Check final stats
      db.get('PRAGMA journal_mode', (err, row) => {
        if (!err) {
          console.log(`\n✅ Journal mode: ${Object.values(row)[0]}`);
        }
      });

      db.get('PRAGMA synchronous', (err, row) => {
        if (!err) {
          const syncMode = Object.values(row)[0];
          const modes = ['OFF', 'NORMAL', 'FULL', 'EXTRA'];
          console.log(`✅ Synchronous: ${modes[syncMode] || syncMode}`);
        }
      });

      // Create .walrc file for persistent settings
      createWalrcFile();

      console.log('\n🎉 Optimization complete!\n');
      
      db.close();
    });
  });
}

function createWalrcFile() {
  const walrc = `# SQLite optimization settings
# These are applied automatically when database opens

PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA cache_size = -64000;
PRAGMA temp_store = MEMORY;
PRAGMA mmap_size = 268435456;
PRAGMA foreign_keys = ON;
PRAGMA auto_vacuum = INCREMENTAL;
`;

  fs.writeFileSync('.sqliterc', walrc);
  console.log('📄 Created .sqliterc file with persistent settings');
}

// Backup function
function createBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const backupPath = `./backups/defipoly-${timestamp}.db`;

  // Create backups directory
  if (!fs.existsSync('./backups')) {
    fs.mkdirSync('./backups');
  }

  console.log(`\n💾 Creating backup: ${backupPath}`);

  const db = new sqlite3.Database(DB_PATH);
  db.run(`VACUUM INTO '${backupPath}'`, (err) => {
    if (err) {
      console.error('❌ Backup failed:', err);
    } else {
      console.log('✅ Backup created successfully');
      
      // Check backup size
      const stats = fs.statSync(backupPath);
      const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
      console.log(`📁 Backup size: ${sizeMB} MB`);
    }
    db.close();
  });
}

// Monitoring function
function checkHealth() {
  const db = new sqlite3.Database(DB_PATH);

  console.log('🏥 Database Health Check\n');

  // Check for integrity
  db.get('PRAGMA integrity_check', (err, row) => {
    if (!err) {
      const status = Object.values(row)[0];
      console.log(`Integrity: ${status === 'ok' ? '✅ OK' : '❌ ' + status}`);
    }
  });

  // Check WAL size
  const walPath = DB_PATH + '-wal';
  if (fs.existsSync(walPath)) {
    const walStats = fs.statSync(walPath);
    const walSizeMB = (walStats.size / 1024 / 1024).toFixed(2);
    console.log(`WAL size: ${walSizeMB} MB ${walSizeMB > 100 ? '⚠️  Consider checkpoint' : '✅'}`);
  }

  // Check database size
  const dbStats = fs.statSync(DB_PATH);
  const dbSizeMB = (dbStats.size / 1024 / 1024).toFixed(2);
  console.log(`Database size: ${dbSizeMB} MB`);

  // Actions per day (last 7 days)
  db.all(`
    SELECT DATE(block_time, 'unixepoch') as date, COUNT(*) as count
    FROM game_actions
    WHERE block_time > strftime('%s', 'now', '-7 days')
    GROUP BY date
    ORDER BY date DESC
  `, (err, rows) => {
    if (!err && rows.length > 0) {
      console.log('\nActions per day (last 7 days):');
      rows.forEach(row => {
        console.log(`  ${row.date}: ${row.count.toLocaleString()}`);
      });

      const avgDaily = rows.reduce((sum, r) => sum + r.count, 0) / rows.length;
      console.log(`\nAverage: ${Math.round(avgDaily).toLocaleString()} actions/day`);
      
      // Scaling recommendation
      if (avgDaily > 100000) {
        console.log('⚠️  Consider migrating to MongoDB (high volume)');
      } else if (avgDaily > 50000) {
        console.log('🟡 Monitor performance closely');
      } else {
        console.log('✅ Volume is healthy for SQLite');
      }
    }
    
    db.close();
  });
}

// CLI
const command = process.argv[2];

switch (command) {
  case 'optimize':
    optimizeDatabase();
    break;
  case 'backup':
    createBackup();
    break;
  case 'health':
    checkHealth();
    break;
  default:
    console.log(`
🔧 SQLite Optimization Tool

Usage:
  node optimize-sqlite.js optimize   - Optimize database settings
  node optimize-sqlite.js backup     - Create backup
  node optimize-sqlite.js health     - Check database health

Examples:
  npm run db:optimize
  npm run db:backup
  npm run db:health
    `);
}
