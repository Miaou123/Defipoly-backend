// ============================================
// FILE: recalculate-stats.js
// Migration script to fix incorrect player stats
// Run this ONCE after fixing webhookController.js
// ============================================

const { initDatabase, getDatabase, closeDatabase } = require('../config/database');
const { calculateDailyIncome } = require('../services/incomeCalculator');

async function recalculateAllStats() {
  // Initialize database first!
  console.log('📦 Initializing database...');
  await initDatabase();
  console.log('✅ Database initialized\n');
  
  const db = getDatabase();
  
  console.log('🔄 Recalculating all player stats from scratch...\n');

  // Step 1: Clear property_ownership table
  console.log('1️⃣  Clearing property_ownership table...');
  await new Promise((resolve, reject) => {
    db.run('DELETE FROM property_ownership', (err) => {
      if (err) reject(err);
      else {
        console.log('   ✅ Cleared property_ownership\n');
        resolve();
      }
    });
  });

  // Step 2: Reset player_stats calculated fields
  console.log('2️⃣  Resetting player_stats...');
  await new Promise((resolve, reject) => {
    db.run(`
      UPDATE player_stats 
      SET total_slots_owned = 0,
          daily_income = 0,
          properties_bought = 0,
          properties_sold = 0,
          successful_steals = 0,
          failed_steals = 0
    `, (err) => {
      if (err) reject(err);
      else {
        console.log('   ✅ Reset player_stats\n');
        resolve();
      }
    });
  });

  // Step 3: Get all transactions ordered by time
  console.log('3️⃣  Fetching all transactions...');
  const transactions = await new Promise((resolve, reject) => {
    db.all(`
      SELECT * FROM game_actions 
      ORDER BY block_time ASC
    `, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
  
  console.log(`   ✅ Found ${transactions.length} transactions\n`);

  // Step 4: Replay all transactions
  console.log('4️⃣  Replaying transactions...');
  
  for (let i = 0; i < transactions.length; i++) {
    const tx = transactions[i];
    const actionType = tx.action_type;
    const playerAddress = tx.player_address;
    const propertyId = tx.property_id;
    const slots = tx.slots || 0;
    const targetAddress = tx.target_address;

    if (i % 10 === 0) {
      console.log(`   Progress: ${i}/${transactions.length} transactions...`);
    }

    // Update property_ownership based on action
    if (actionType === 'buy' && slots > 0 && propertyId !== null) {
      await updatePropertyOwnership(db, playerAddress, propertyId, slots);
    } else if (actionType === 'sell' && slots > 0 && propertyId !== null) {
      await updatePropertyOwnership(db, playerAddress, propertyId, -slots);
    } else if (actionType === 'steal_success' && slots > 0 && propertyId !== null) {
      // Attacker gains slots
      await updatePropertyOwnership(db, playerAddress, propertyId, slots);
      // Target loses slots
      if (targetAddress) {
        await updatePropertyOwnership(db, targetAddress, propertyId, -slots);
      }
    }

    // Update player_stats counters
    await updatePlayerCounter(db, playerAddress, actionType);
  }

  console.log(`   ✅ Replayed all ${transactions.length} transactions\n`);

  // Step 5: Recalculate daily income for all players
  console.log('5️⃣  Recalculating daily income for all players...');
  
  const players = await new Promise((resolve, reject) => {
    db.all('SELECT DISTINCT wallet_address FROM player_stats', (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });

  for (const player of players) {
    await new Promise((resolve) => {
      calculateDailyIncome(player.wallet_address, (dailyIncome) => {
        db.run(
          'UPDATE player_stats SET daily_income = ? WHERE wallet_address = ?',
          [dailyIncome, player.wallet_address],
          () => resolve()
        );
      });
    });
  }

  console.log(`   ✅ Recalculated daily income for ${players.length} players\n`);

  // Step 6: Update total_slots_owned from property_ownership
  console.log('6️⃣  Updating total_slots_owned...');
  
  await new Promise((resolve, reject) => {
    db.run(`
      UPDATE player_stats
      SET total_slots_owned = (
        SELECT COALESCE(SUM(slots_owned), 0)
        FROM property_ownership
        WHERE property_ownership.wallet_address = player_stats.wallet_address
      )
    `, (err) => {
      if (err) reject(err);
      else {
        console.log('   ✅ Updated total_slots_owned\n');
        resolve();
      }
    });
  });

  // Step 7: Show results
  console.log('📊 Final Results:\n');
  
  const stats = await new Promise((resolve, reject) => {
    db.all(`
      SELECT 
        wallet_address,
        total_slots_owned,
        daily_income,
        properties_bought,
        properties_sold,
        successful_steals
      FROM player_stats
      WHERE total_actions > 0
      ORDER BY daily_income DESC
      LIMIT 10
    `, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });

  console.log('Top 10 Players by Daily Income:');
  stats.forEach((stat, i) => {
    const address = `${stat.wallet_address.slice(0, 4)}...${stat.wallet_address.slice(-4)}`;
    const income = (stat.daily_income / 1e9).toFixed(2);
    console.log(`   ${i + 1}. ${address}: ${income} DEFI/day, ${stat.total_slots_owned} slots`);
  });

  console.log('\n✅ Migration complete!\n');
}

// Helper function to update property ownership
async function updatePropertyOwnership(db, walletAddress, propertyId, slotsDelta) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO property_ownership (wallet_address, property_id, slots_owned, last_updated)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(wallet_address, property_id) 
       DO UPDATE SET 
         slots_owned = MAX(0, slots_owned + ?),
         last_updated = ?`,
      [walletAddress, propertyId, slotsDelta, Date.now(), slotsDelta, Date.now()],
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}

// Helper function to update player counters
async function updatePlayerCounter(db, playerAddress, actionType) {
  let field = null;
  
  switch (actionType) {
    case 'buy':
      field = 'properties_bought';
      break;
    case 'sell':
      field = 'properties_sold';
      break;
    case 'steal_success':
      field = 'successful_steals';
      break;
    case 'steal_failed':
      field = 'failed_steals';
      break;
  }

  if (!field) return;

  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE player_stats SET ${field} = ${field} + 1 WHERE wallet_address = ?`,
      [playerAddress],
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}

// Run the migration
recalculateAllStats()
  .then(async () => {
    console.log('🎉 Done!');
    await closeDatabase();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('❌ Migration failed:', error);
    await closeDatabase();
    process.exit(1);
  });