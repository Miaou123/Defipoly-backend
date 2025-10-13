const express = require('express');
const router = express.Router();
const { getCooldownStatus, getAllPlayerCooldowns } = require('../controllers/cooldownController');

// GET /api/cooldown/:wallet/:setId
router.get('/:wallet/:setId', getCooldownStatus);

// GET /api/cooldown/:wallet
router.get('/:wallet', getAllPlayerCooldowns);

module.exports = router;