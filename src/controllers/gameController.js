const { PROPERTY_SETS, getCooldownDurationForSet } = require('../config/constants');

const getGameConstants = (req, res) => {
  res.json({
    propertySets: PROPERTY_SETS,
    cooldownDurations: Object.keys(PROPERTY_SETS).reduce((acc, setId) => {
      acc[setId] = getCooldownDurationForSet(parseInt(setId));
      return acc;
    }, {}),
    totalProperties: 22,
    totalSets: 8
  });
};

const getHealthStatus = (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: Date.now(),
    version: '2.0.0',
    features: ['profiles', 'actions', 'cooldowns', 'stats', 'leaderboard']
  });
};

module.exports = {
  getGameConstants,
  getHealthStatus
};