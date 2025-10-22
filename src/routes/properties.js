// ============================================
// FILE: src/routes/properties.js
// Add this new route file to your backend
// ============================================

const express = require('express');
const router = express.Router();
const { getPropertyStats, getAllPropertiesStats } = require('../controllers/propertyController');

// Get stats for a specific property
router.get('/:propertyId/stats', getPropertyStats);

// Get stats for all properties at once
router.get('/stats', getAllPropertiesStats);

module.exports = router;