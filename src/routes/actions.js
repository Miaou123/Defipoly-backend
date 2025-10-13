const express = require('express');
const router = express.Router();
const { 
  storeAction, 
  storeActionsBatch, 
  getPlayerActions, 
  getRecentActions, 
  getPropertyActions 
} = require('../controllers/actionsController');

// POST /api/actions
router.post('/', storeAction);

// POST /api/actions/batch
router.post('/batch', storeActionsBatch);

// GET /api/actions/player/:wallet
router.get('/player/:wallet', getPlayerActions);

// GET /api/actions/recent
router.get('/recent', getRecentActions);

// GET /api/actions/property/:propertyId
router.get('/property/:propertyId', getPropertyActions);

module.exports = router;