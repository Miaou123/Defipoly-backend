// ============================================
// Recalculate All Player Daily Incomes
// Run from backend root: node src/scripts/recalculate-incomes.js
// ============================================

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Use same path as database.js config
const DB_PATH = process.env.DB_PATH || './defipoly.db';

// Load constants from the config
const { PROPERTIES, SET_BONUS_BPS, PROPERTY_SETS } = require('../config/constants');

function calculateDailyIncome(walletAddress, db) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT property_id, slots_owned FROM property_ownership 
       WHERE wallet_address = ? AND slots_owned > 0`,
      [walletAddress],
      (err, ownerships) => {
        if (err || !ownerships || ownerships.length === 0) {
          return resolve(0);
        }

        // Group by set
        const setData = {};
        for (let i = 0; i < 8; i++) {
          setData[i] = { properties: [], minSlots: Infinity };
        }

        // Process each ownership
        ownerships.forEach(own => {
          const property = PROPERTIES.find(p => p.id === own.property_id);
          if (!property) return;

          const dailyIncomePerSlot = (property.price * property.yieldBps) / 10000;
          
          setData[property.setId].properties.push({
            slots: own.slots_owned,
            dailyIncomePerSlot: dailyIncomePerSlot
          });
          setData[property.setId].minSlots = Math.min(setData[property.setId].minSlots, own.slots_owned);
        });

        // Calculate total daily income
        let totalDailyIncome = 0;

        Object.keys(setData).forEach(setId => {
          const set = setData[setId];
          if (set.properties.length === 0) return;

          const requiredProperties = PROPERTY_SETS[setId] ? PROPERTY_SETS[setId].length : 0;
          const hasCompleteSet = set.properties.length >= requiredProperties;

          set.properties.forEach(prop => {
            if (hasCompleteSet && set.minSlots > 0) {
              const bonusSlots = Math.min(prop.slots, set.minSlots);
              const baseSlots = prop.slots - bonusSlots;
              const baseIncome = baseSlots * prop.dailyIncomePerSlot;
              const bonusIncome = bonusSlots * prop.dailyIncomePerSlot * (10000 + SET_BONUS_BPS) / 10000;
              totalDailyIncome += baseIncome + bonusIncome;
            } else {
              totalDailyIncome += prop.dailyIncomePerSlot * prop.slots;
            }
          });
        });

        resolve(Math.floor(totalDailyIncome));
      }
    );
  });
}

async function recalculateAllIncomes() {
  console.log('🔧 Recalculating daily incomes...');
  console.log(`📁 Using database: ${DB_PATH}\n`);
  
  const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
      console.error('❌ Database connection failed:', err.message);
      process.exit(1);
    }
  });

  return new Promise((resolve, reject) => {
    db.all(
      `SELECT DISTINCT wallet_address FROM property_ownership WHERE slots_owned > 0`,
      async (err, players) => {
        if (err) {
          reject(err);
          return;
        }

        console.log(`📊 Found ${players.length} players\n`);

        let updated = 0;
        for (const player of players) {
          try {
            const dailyIncome = await calculateDailyIncome(player.wallet_address, db);
            
            await new Promise((res, rej) => {
              db.run(
                `UPDATE player_stats SET daily_income = ?, updated_at = strftime('%s', 'now') 
                 WHERE wallet_address = ?`,
                [dailyIncome, player.wallet_address],
                (err) => {
                  if (err) rej(err);
                  else {
                    updated++;
                    console.log(`✅ ${player.wallet_address.slice(0, 8)}...: ${(dailyIncome / 1e9).toFixed(0)} tokens/day`);
                    res();
                  }
                }
              );
            });
          } catch (error) {
            console.error(`❌ Error for ${player.wallet_address}:`, error.message);
          }
        }

        console.log(`\n✅ Updated ${updated} players`);
        db.close();
        resolve({ updated });
      }
    );
  });
}

recalculateAllIncomes()
  .then(() => {
    console.log('\n🎉 Done! Restart your backend now.');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Error:', err.message);
    process.exit(1);
  });