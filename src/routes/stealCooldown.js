const express = require('express');
const router = express.Router();
const { getStealCooldownStatus, getAllPlayerStealCooldowns } = require('../controllers/stealCooldownController');

// GET /api/steal-cooldown/:wallet/:setId
router.get('/:wallet/:propertyId', getStealCooldownStatus);

// GET /api/steal-cooldown/:wallet
router.get('/:wallet', getAllPlayerStealCooldowns);

module.exports = router;