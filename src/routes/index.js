const express = require('express');
const router = express.Router();

// Import route modules
const profilesRouter = require('./profiles');
const actionsRouter = require('./actions');
const cooldownRouter = require('./cooldown');
const statsRouter = require('./stats');
const leaderboardController = require('../controllers/leaderboardController');
const gameRouter = require('./game');
const propertiesRouter = require('./properties');
const stealCooldownRouter = require('./stealCooldown');

// Mount routes (removed webhooks)
router.use('/profile', profilesRouter);
router.use('/profiles', profilesRouter);
router.use('/actions', actionsRouter);
router.use('/cooldown', cooldownRouter);
router.use('/stats', statsRouter);
router.use('/game', gameRouter);
router.use('/properties', propertiesRouter);
router.use('/steal-cooldown', stealCooldownRouter);

// Special routes that need custom paths
const { getPlayerOwnership } = require('../controllers/statsController');
router.get('/ownership/:wallet', getPlayerOwnership);

// Get leaderboard by type
// GET /api/leaderboard?type=overall&limit=100&offset=0
// Types: overall, wealth, efficiency, combat, defense, collections, income
router.get('/leaderboard', leaderboardController.getLeaderboard);

// Get player's ranks across all leaderboards
// GET /api/leaderboard/ranks/:wallet
router.get('/leaderboard/ranks/:wallet', leaderboardController.getPlayerRanks);

// Get overall leaderboard stats
// GET /api/leaderboard/stats
router.get('/leaderboard/stats', leaderboardController.getLeaderboardStats);

// Get recent movers (most active players)
// GET /api/leaderboard/movers?limit=10
router.get('/leaderboard/movers', leaderboardController.getRecentMovers);

// Trigger manual score recalculation for all players
// POST /api/admin/recalculate-scores
router.post('/admin/recalculate-scores', async (req, res) => {
    try {
      const { batchRecalculateScores } = require('../services/gameService');
      await batchRecalculateScores();
      res.json({ success: true, message: 'Scores recalculated' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });  

module.exports = router;