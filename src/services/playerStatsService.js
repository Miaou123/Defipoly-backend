// ============================================
// Player Stats Service
// Updates player statistics based on actions
// ============================================

const { getDatabase } = require('../config/database');

/**
 * Update player stats when an action occurs
 * @param {string} walletAddress - Player's wallet address
 * @param {string} actionType - Type of action (buy, sell, steal_success, etc.)
 * @param {number} amount - Amount involved in the action
 */
function updatePlayerStats(walletAddress, actionType, amount = 0) {
  const db = getDatabase();

  // First, ensure the player exists in player_stats
  db.run(
    `INSERT OR IGNORE INTO player_stats 
     (wallet_address, total_actions, properties_bought, total_spent, total_earned, daily_income, total_slots_owned)
     VALUES (?, 0, 0, 0, 0, 0, 0)`,
    [walletAddress],
    (err) => {
      if (err) {
        console.error('Error initializing player stats:', err);
        return;
      }

      // Update stats based on action type
      let updateQuery = '';
      let params = [];

      switch (actionType) {
        case 'buy':
          updateQuery = `UPDATE player_stats 
                         SET total_actions = total_actions + 1,
                             properties_bought = properties_bought + 1,
                             total_spent = total_spent + ?
                         WHERE wallet_address = ?`;
          params = [amount || 0, walletAddress];
          break;

        case 'sell':
          updateQuery = `UPDATE player_stats 
                         SET total_actions = total_actions + 1,
                             total_earned = total_earned + ?
                         WHERE wallet_address = ?`;
          params = [amount || 0, walletAddress];
          break;

        case 'steal_success':
          updateQuery = `UPDATE player_stats 
                         SET total_actions = total_actions + 1
                         WHERE wallet_address = ?`;
          params = [walletAddress];
          break;

        case 'steal_failed':
          updateQuery = `UPDATE player_stats 
                         SET total_actions = total_actions + 1,
                             total_spent = total_spent + ?
                         WHERE wallet_address = ?`;
          params = [amount || 0, walletAddress];
          break;

        case 'claim':
          updateQuery = `UPDATE player_stats 
                         SET total_actions = total_actions + 1,
                             total_earned = total_earned + ?
                         WHERE wallet_address = ?`;
          params = [amount || 0, walletAddress];
          break;

        case 'shield':
          updateQuery = `UPDATE player_stats 
                         SET total_actions = total_actions + 1,
                             total_spent = total_spent + ?
                         WHERE wallet_address = ?`;
          params = [amount || 0, walletAddress];
          break;

        default:
          // Generic action counter
          updateQuery = `UPDATE player_stats 
                         SET total_actions = total_actions + 1
                         WHERE wallet_address = ?`;
          params = [walletAddress];
      }

      if (updateQuery) {
        db.run(updateQuery, params, (err) => {
          if (err) {
            console.error(`Error updating player stats for ${actionType}:`, err);
          }
        });
      }
    }
  );
}

/**
 * Get player stats from database
 * @param {string} walletAddress - Player's wallet address
 * @param {function} callback - Callback function (err, stats)
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
          totalSpent: 0,
          totalEarned: 0,
          dailyIncome: 0,
          totalSlotsOwned: 0
        });
      }

      callback(null, {
        walletAddress: row.wallet_address,
        totalActions: row.total_actions,
        propertiesBought: row.properties_bought,
        totalSpent: row.total_spent,
        totalEarned: row.total_earned,
        dailyIncome: row.daily_income,
        totalSlotsOwned: row.total_slots_owned
      });
    }
  );
}

module.exports = {
  updatePlayerStats,
  getPlayerStats
};