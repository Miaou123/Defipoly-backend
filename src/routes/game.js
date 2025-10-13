const express = require('express');
const router = express.Router();
const { getGameConstants, getHealthStatus } = require('../controllers/gameController');

// GET /api/game/constants
router.get('/constants', getGameConstants);

// GET /health
router.get('/health', getHealthStatus);

module.exports = router;