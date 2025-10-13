const express = require('express');
const router = express.Router();
const { getProfile, updateProfile, getProfilesBatch } = require('../controllers/profileController');

// GET /api/profile/:wallet
router.get('/:wallet', getProfile);

// POST /api/profile
router.post('/', updateProfile);

// POST /api/profiles/batch
router.post('/batch', getProfilesBatch);

module.exports = router;