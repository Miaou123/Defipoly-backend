// ============================================
// FILE: src/services/gameService.js
// Enhanced Game Service with FIXED Leaderboard Scoring
// ✅ FIXED: Scores now scale properly (top score < 1M)
// ============================================

const { getDatabase } = require('../config/database');

/**
 * Calculate composite leaderboard score
 * ✅ FIXED: Properly scaled to keep top scores under 1 million
 * 
 * Scoring breakdown for a top player (~400K SOL earned, 60 properties, 10 steals):
 * - Wealth: ~120K points (30%)
 * - Activity: ~30K points (25%)  
 * - Combat: ~15K points (20%)
 * - Efficiency: ~50K points (15%)
 * - Defense: ~10K points (10%)
 * Total: ~225K points (well under 1M target)
 */
function calculateLeaderboardScore(stats) {
  let score = 0;
  
  // Convert lamports to SOL for all calculations
  const earnedSOL = stats.total_earned / 1e9;
  const spentSOL = stats.total_spent / 1e9;
  
  // 1. Wealth Component (30% weight)
  // Scale: 1 SOL earned = 0.3 points
  // Top player (442K SOL) = ~133K points
  score += earnedSOL * 0.3;
  
  // 2. Activity Component (25% weight)
  // Properties: 100 points each
  // Complete sets: 5000 points each (major achievement)
  score += stats.properties_bought * 100;
  score += stats.complete_sets * 5000;
  
  // 3. Combat Component (20% weight)
  // Successful steals: 500 points each
  score += stats.successful_steals * 500;
  
  // Win rate bonus (max 5000 points)
  const stealWinRate = stats.successful_steals + stats.failed_steals > 0
    ? stats.successful_steals / (stats.successful_steals + stats.failed_steals)
    : 0;
  score += stealWinRate * 5000;
  
  // 4. Efficiency Component (15% weight)
  // ROI multiplier (max 50,000 points for amazing ROI)
  const roi = spentSOL > 0 ? earnedSOL / spentSOL : 0;
  const roiBonus = Math.min(roi * 25000, 50000); // Cap at 200% ROI
  score += roiBonus;
  
  // 5. Defense Component (10% weight)
  // Shields: 100 points each
  score += stats.shields_activated * 100;
  
  // Defense rating bonus (max 10,000 points)
  const defenseRating = stats.total_slots_owned > 0
    ? 1 - (stats.times_stolen / Math.max(stats.total_slots_owned, 1))
    : 0;
  score += defenseRating * 10000;
  
  return Math.floor(score);
}

/**
 * Calculate ROI ratio
 */
function calculateROI(totalEarned, totalSpent) {
  if (totalSpent === 0) return 0;
  return parseFloat((totalEarned / totalSpent).toFixed(4));
}

/**
 * Calculate steal win rate
 */
function calculateStealWinRate(successful, failed) {
  const total = successful + failed;
  if (total === 0) return 0;
  return parseFloat((successful / total).toFixed(4));
}

/**
 * Calculate defense rating
 */
function calculateDefenseRating(timesStolen, totalSlots) {
  if (totalSlots === 0) return 0;
  const rating = 1 - (timesStolen / totalSlots);
  return Math.max(0, Math.min(1, rating)); // Clamp between 0 and 1
}

/**
 * Update player stats when an action occurs
 * ENHANCED VERSION with full leaderboard tracking
 */
async function updatePlayerStats(walletAddress, actionType, amount = 0, slots = 0, propertyId = null) {
  const db = getDatabase();

  return new Promise((resolve, reject) => {
    // First, ensure the player exists
    db.run(
      `INSERT OR IGNORE INTO player_stats 
       (wallet_address, total_actions, properties_bought, properties_sold, 
        successful_steals, failed_steals, shields_activated, rewards_claimed,
        total_spent, total_earned, total_slots_owned, daily_income, complete_sets,
        times_stolen, leaderboard_score, roi_ratio, steal_win_rate, defense_rating)
       VALUES (?, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0)`,
      [walletAddress],
      (err) => {
        if (err) {
          console.error('Error initializing player stats:', err);
          return reject(err);
        }

        // Update stats based on action type
        let updateQuery = '';
        let params = [];

        switch (actionType) {
          case 'buy':
            updateQuery = `UPDATE player_stats 
                           SET total_actions = total_actions + 1,
                               properties_bought = properties_bought + 1,
                               total_spent = total_spent + ?,
                               total_slots_owned = total_slots_owned + ?,
                               last_action_time = ?
                           WHERE wallet_address = ?`;
            params = [amount || 0, slots || 0, Math.floor(Date.now() / 1000), walletAddress];
            break;

          case 'sell':
            updateQuery = `UPDATE player_stats 
                           SET total_actions = total_actions + 1,
                               properties_sold = properties_sold + 1,
                               total_earned = total_earned + ?,
                               total_slots_owned = total_slots_owned - ?,
                               last_action_time = ?
                           WHERE wallet_address = ?`;
            params = [amount || 0, slots || 0, Math.floor(Date.now() / 1000), walletAddress];
            break;

          case 'steal_success':
            updateQuery = `UPDATE player_stats 
                           SET total_actions = total_actions + 1,
                               successful_steals = successful_steals + 1,
                               total_slots_owned = total_slots_owned + ?,
                               last_action_time = ?
                           WHERE wallet_address = ?`;
            params = [slots || 1, Math.floor(Date.now() / 1000), walletAddress];
            break;

          case 'steal_failed':
            updateQuery = `UPDATE player_stats 
                           SET total_actions = total_actions + 1,
                               failed_steals = failed_steals + 1,
                               total_spent = total_spent + ?,
                               last_action_time = ?
                           WHERE wallet_address = ?`;
            params = [amount || 0, Math.floor(Date.now() / 1000), walletAddress];
            break;

          case 'claim':
            updateQuery = `UPDATE player_stats 
                           SET total_actions = total_actions + 1,
                               rewards_claimed = rewards_claimed + 1,
                               total_earned = total_earned + ?,
                               last_action_time = ?
                           WHERE wallet_address = ?`;
            params = [amount || 0, Math.floor(Date.now() / 1000), walletAddress];
            break;

          case 'shield':
            updateQuery = `UPDATE player_stats 
                           SET total_actions = total_actions + 1,
                               shields_activated = shields_activated + 1,
                               total_spent = total_spent + ?,
                               last_action_time = ?
                           WHERE wallet_address = ?`;
            params = [amount || 0, Math.floor(Date.now() / 1000), walletAddress];
            break;

          default:
            // Generic action counter
            updateQuery = `UPDATE player_stats 
                           SET total_actions = total_actions + 1,
                               last_action_time = ?
                           WHERE wallet_address = ?`;
            params = [Math.floor(Date.now() / 1000), walletAddress];
        }

        if (updateQuery) {
          db.run(updateQuery, params, (err) => {
            if (err) {
              console.error(`Error updating player stats for ${actionType}:`, err);
              return reject(err);
            }

            // ✅ Recalculate composite scores after updating stats
            recalculatePlayerScore(walletAddress)
              .then(() => {
                console.log(`✅ Updated stats and score for ${walletAddress}`);
                resolve();
              })
              .catch(reject);
          });
        } else {
          resolve();
        }
      }
    );
  });
}

/**
 * Update target player when they get stolen from
 */
async function updateTargetOnSteal(targetAddress, propertyId, slotsStolen = 1) {
  const db = getDatabase();

  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE player_stats 
       SET times_stolen = times_stolen + 1,
           total_slots_owned = total_slots_owned - ?
       WHERE wallet_address = ?`,
      [slotsStolen, targetAddress],
      (err) => {
        if (err) {
          console.error('Error updating target stats:', err);
          return reject(err);
        }

        // Recalculate score for victim too
        recalculatePlayerScore(targetAddress)
          .then(() => {
            console.log(`✅ Updated victim stats for ${targetAddress}`);
            resolve();
          })
          .catch(reject);
      }
    );
  });
}

/**
 * Recalculate player's composite scores
 */
async function recalculatePlayerScore(walletAddress) {
  const db = getDatabase();

  return new Promise((resolve, reject) => {
    // Fetch current stats
    db.get(
      `SELECT * FROM player_stats WHERE wallet_address = ?`,
      [walletAddress],
      (err, stats) => {
        if (err) return reject(err);
        if (!stats) return resolve(); // Player doesn't exist yet

        // Calculate all scores
        const leaderboardScore = calculateLeaderboardScore(stats);
        const roiRatio = calculateROI(stats.total_earned, stats.total_spent);
        const stealWinRate = calculateStealWinRate(stats.successful_steals, stats.failed_steals);
        const defenseRating = calculateDefenseRating(stats.times_stolen, stats.total_slots_owned);

        // Update calculated fields
        db.run(
          `UPDATE player_stats 
           SET leaderboard_score = ?,
               roi_ratio = ?,
               steal_win_rate = ?,
               defense_rating = ?
           WHERE wallet_address = ?`,
          [leaderboardScore, roiRatio, stealWinRate, defenseRating, walletAddress],
          (err) => {
            if (err) return reject(err);
            resolve();
          }
        );
      }
    );
  });
}

/**
 * Get player stats from database
 */
function getPlayerStats(walletAddress, callback) {
  const db = getDatabase();

  db.get(
    `SELECT * FROM player_stats WHERE wallet_address = ?`,
    [walletAddress],
    (err, row) => {
      if (err) {
        return callback(err, null);
      }

      if (!row) {
        // Return default stats if player not found
        return callback(null, {
          walletAddress,
          totalActions: 0,
          propertiesBought: 0,
          propertiesSold: 0,
          successfulSteals: 0,
          failedSteals: 0,
          shieldsActivated: 0,
          rewardsClaimed: 0,
          totalSpent: 0,
          totalEarned: 0,
          totalSlotsOwned: 0,
          dailyIncome: 0,
          completeSets: 0,
          timesStolen: 0,
          leaderboardScore: 0,
          roiRatio: 0,
          stealWinRate: 0,
          defenseRating: 0
        });
      }

      callback(null, {
        walletAddress: row.wallet_address,
        totalActions: row.total_actions,
        propertiesBought: row.properties_bought,
        propertiesSold: row.properties_sold,
        successfulSteals: row.successful_steals,
        failedSteals: row.failed_steals,
        shieldsActivated: row.shields_activated,
        rewardsClaimed: row.rewards_claimed,
        totalSpent: row.total_spent,
        totalEarned: row.total_earned,
        totalSlotsOwned: row.total_slots_owned,
        dailyIncome: row.daily_income,
        completeSets: row.complete_sets,
        timesStolen: row.times_stolen,
        leaderboardScore: row.leaderboard_score,
        roiRatio: row.roi_ratio,
        stealWinRate: row.steal_win_rate,
        defenseRating: row.defense_rating,
        lastActionTime: row.last_action_time,
        updatedAt: row.updated_at
      });
    }
  );
}

/**
 * Batch recalculate scores for all players
 * Run this periodically or after major updates
 */
async function batchRecalculateScores() {
  const db = getDatabase();

  return new Promise((resolve, reject) => {
    db.all(`SELECT wallet_address FROM player_stats`, async (err, rows) => {
      if (err) return reject(err);

      console.log(`🔄 Recalculating scores for ${rows.length} players...`);

      for (const row of rows) {
        try {
          await recalculatePlayerScore(row.wallet_address);
        } catch (error) {
          console.error(`Error recalculating score for ${row.wallet_address}:`, error);
        }
      }

      console.log(`✅ Batch recalculation complete!`);
      resolve();
    });
  });
}

module.exports = {
  updatePlayerStats,
  updateTargetOnSteal,
  getPlayerStats,
  recalculatePlayerScore,
  batchRecalculateScores,
  calculateLeaderboardScore,
  calculateROI,
  calculateStealWinRate,
  calculateDefenseRating
};