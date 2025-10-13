const express = require('express');
const router = express.Router();
const { getPlayerStats, getPlayerOwnership } = require('../controllers/statsController');

// GET /api/stats/:wallet
router.get('/:wallet', getPlayerStats);

module.exports = router;