const { getStealCooldownForProperty, getAllStealCooldowns } = require('../services/stealCooldownService');

const getStealCooldownStatus = (req, res) => {
  const { wallet, propertyId } = req.params;

  getStealCooldownForProperty(wallet, propertyId, (err, cooldownData) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: err.message });
    }

    res.json(cooldownData);
  });
};

const getAllPlayerStealCooldowns = (req, res) => {
  const { wallet } = req.params;

  getAllStealCooldowns(wallet, (err, result) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    res.json(result);
  });
};

module.exports = {
  getStealCooldownStatus,
  getAllPlayerStealCooldowns,

};