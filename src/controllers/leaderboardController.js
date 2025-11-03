// ============================================
// FILE: src/controllers/leaderboardController.js (ENHANCED)
// Multiple Leaderboard Types
// Replace your existing leaderboardController.js
// ============================================

const { getDatabase } = require('../config/database');

/**
 * Get leaderboard by type
 * Supports: overall, wealth, efficiency, combat, defense, collections
 */
const getLeaderboard = (req, res) => {
  const type = req.query.type || 'overall';
  const limit = Math.min(parseInt(req.query.limit) || 100, 500);
  const offset = parseInt(req.query.offset) || 0;
  
  const db = getDatabase();

  // Determine which field to order by
  let orderByField = 'leaderboard_score';
  let leaderboardTitle = '🏆 Overall Champions';

  switch (type) {
    case 'wealth':
      orderByField = 'total_earned';
      leaderboardTitle = '💰 Richest Players';
      break;
    case 'efficiency':
      orderByField = 'roi_ratio';
      leaderboardTitle = '📈 Most Efficient';
      break;
    case 'combat':
      orderByField = 'successful_steals';
      leaderboardTitle = '⚔️ Master Thieves';
      break;
    case 'defense':
      orderByField = 'defense_rating';
      leaderboardTitle = '🛡️ Best Defenders';
      break;
    case 'collections':
      orderByField = 'complete_sets';
      leaderboardTitle = '🎨 Collectors';
      break;
    case 'income':
      orderByField = 'daily_income';
      leaderboardTitle = '💵 Top Earners';
      break;
    case 'overall':
    default:
      orderByField = 'leaderboard_score';
      leaderboardTitle = '🏆 Overall Champions';
  }

  // Query with rank calculation
  const query = `
    SELECT 
      wallet_address,
      leaderboard_score,
      total_earned,
      total_spent,
      roi_ratio,
      successful_steals,
      failed_steals,
      steal_win_rate,
      defense_rating,
      complete_sets,
      daily_income,
      total_slots_owned,
      properties_bought,
      shields_activated,
      times_stolen,
      total_actions,
      ROW_NUMBER() OVER (ORDER BY ${orderByField} DESC) as rank
    FROM player_stats
    WHERE total_actions > 0
    ORDER BY ${orderByField} DESC
    LIMIT ? OFFSET ?
  `;

  db.all(query, [limit, offset], (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    const leaderboard = rows.map(row => ({
      rank: row.rank,
      walletAddress: row.wallet_address,
      // Display name (truncated wallet if no username)
      displayName: `${row.wallet_address.slice(0, 4)}...${row.wallet_address.slice(-4)}`,
      
      // Scores
      leaderboardScore: Math.round(row.leaderboard_score),
      
      // Wealth metrics
      totalEarned: row.total_earned,
      totalSpent: row.total_spent,
      roiRatio: parseFloat(row.roi_ratio?.toFixed(2)) || 0,
      
      // Combat metrics
      successfulSteals: row.successful_steals,
      failedSteals: row.failed_steals,
      stealWinRate: parseFloat((row.steal_win_rate * 100).toFixed(1)),
      
      // Defense metrics
      defenseRating: parseFloat((row.defense_rating * 100).toFixed(1)),
      timesStolen: row.times_stolen,
      shieldsActivated: row.shields_activated,
      
      // Collection metrics
      completeSets: row.complete_sets,
      propertiesBought: row.properties_bought,
      
      // Income
      dailyIncome: row.daily_income,
      totalSlotsOwned: row.total_slots_owned,
      
      // Activity
      totalActions: row.total_actions
    }));

    res.json({
      type,
      title: leaderboardTitle,
      leaderboard,
      pagination: {
        limit,
        offset,
        count: leaderboard.length
      }
    });
  });
};

/**
 * Get player's rank in different leaderboards
 */
const getPlayerRanks = (req, res) => {
  const { wallet } = req.params;
  const db = getDatabase();

  // Get ranks for all leaderboard types
  const queries = {
    overall: `
      SELECT COUNT(*) + 1 as rank
      FROM player_stats
      WHERE leaderboard_score > (
        SELECT leaderboard_score FROM player_stats WHERE wallet_address = ?
      )
    `,
    wealth: `
      SELECT COUNT(*) + 1 as rank
      FROM player_stats
      WHERE total_earned > (
        SELECT total_earned FROM player_stats WHERE wallet_address = ?
      )
    `,
    efficiency: `
      SELECT COUNT(*) + 1 as rank
      FROM player_stats
      WHERE roi_ratio > (
        SELECT roi_ratio FROM player_stats WHERE wallet_address = ?
      )
    `,
    combat: `
      SELECT COUNT(*) + 1 as rank
      FROM player_stats
      WHERE successful_steals > (
        SELECT successful_steals FROM player_stats WHERE wallet_address = ?
      )
    `,
    defense: `
      SELECT COUNT(*) + 1 as rank
      FROM player_stats
      WHERE defense_rating > (
        SELECT defense_rating FROM player_stats WHERE wallet_address = ?
      )
    `,
    collections: `
      SELECT COUNT(*) + 1 as rank
      FROM player_stats
      WHERE complete_sets > (
        SELECT complete_sets FROM player_stats WHERE wallet_address = ?
      )
    `
  };

  const ranks = {};
  let completed = 0;
  const totalQueries = Object.keys(queries).length;

  Object.entries(queries).forEach(([type, query]) => {
    db.get(query, [wallet], (err, row) => {
      if (!err && row) {
        ranks[type] = row.rank;
      } else {
        ranks[type] = null;
      }

      completed++;
      if (completed === totalQueries) {
        // Get total player count
        db.get(
          `SELECT COUNT(*) as total FROM player_stats WHERE total_actions > 0`,
          (err, countRow) => {
            res.json({
              walletAddress: wallet,
              ranks,
              totalPlayers: countRow?.total || 0
            });
          }
        );
      }
    });
  });
};

/**
 * Get leaderboard stats (total players, total actions, etc.)
 */
const getLeaderboardStats = (req, res) => {
  const db = getDatabase();

  db.get(
    `SELECT 
      COUNT(*) as total_players,
      SUM(total_actions) as total_actions,
      SUM(total_earned) as total_earned,
      SUM(successful_steals) as total_steals,
      SUM(complete_sets) as total_complete_sets,
      AVG(leaderboard_score) as avg_score,
      MAX(leaderboard_score) as max_score
    FROM player_stats
    WHERE total_actions > 0`,
    (err, stats) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      res.json({
        totalPlayers: stats.total_players || 0,
        totalActions: stats.total_actions || 0,
        totalEarned: stats.total_earned || 0,
        totalSteals: stats.total_steals || 0,
        totalCompleteSets: stats.total_complete_sets || 0,
        averageScore: Math.round(stats.avg_score || 0),
        topScore: Math.round(stats.max_score || 0)
      });
    }
  );
};

/**
 * Get recent movers (players with biggest score changes)
 * This requires a history table - optional advanced feature
 */
const getRecentMovers = (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 10, 50);
  
  // For now, return top recent active players
  // To implement properly, you'd need a player_stats_history table
  const db = getDatabase();

  db.all(
    `SELECT 
      wallet_address,
      leaderboard_score,
      last_action_time
    FROM player_stats
    WHERE total_actions > 0 AND last_action_time IS NOT NULL
    ORDER BY last_action_time DESC
    LIMIT ?`,
    [limit],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      res.json({
        movers: rows.map(row => ({
          walletAddress: row.wallet_address,
          displayName: `${row.wallet_address.slice(0, 4)}...${row.wallet_address.slice(-4)}`,
          score: Math.round(row.leaderboard_score),
          lastActive: row.last_action_time
        }))
      });
    }
  );
};

module.exports = {
  getLeaderboard,
  getPlayerRanks,
  getLeaderboardStats,
  getRecentMovers
};