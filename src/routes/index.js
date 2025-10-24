const express = require('express');
const router = express.Router();

// Import route modules
const profilesRouter = require('./profiles');
const actionsRouter = require('./actions');
const cooldownRouter = require('./cooldown');
const statsRouter = require('./stats');
const leaderboardRouter = require('./leaderboard');
const gameRouter = require('./game');
const propertiesRouter = require('./properties');
const webhooksRouter = require('./webhooks');
const stealCooldownRouter = require('./stealCooldown');

// Mount routes
router.use('/webhooks', webhooksRouter);
router.use('/profile', profilesRouter);
router.use('/profiles', profilesRouter); // For batch endpoint
router.use('/actions', actionsRouter);
router.use('/cooldown', cooldownRouter);
router.use('/stats', statsRouter);
router.use('/leaderboard', leaderboardRouter);
router.use('/game', gameRouter);
router.use('/properties', propertiesRouter);
router.use('/steal-cooldown', stealCooldownRouter);

// Special routes that need custom paths
const { getPlayerOwnership } = require('../controllers/statsController');
router.get('/ownership/:wallet', getPlayerOwnership);

module.exports = router;