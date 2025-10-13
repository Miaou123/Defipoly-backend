const { getDatabase } = require('../config/database');

const getLeaderboard = (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 10, 100);
  const db = getDatabase();

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
};

module.exports = {
  getLeaderboard
};