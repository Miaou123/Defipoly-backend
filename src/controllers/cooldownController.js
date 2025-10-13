const { getCooldownForSet, getAllCooldowns } = require('../services/cooldownService');

const getCooldownStatus = (req, res) => {
  const { wallet, setId } = req.params;

  getCooldownForSet(wallet, setId, (err, cooldownData) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: err.message });
    }

    res.json(cooldownData);
  });
};

const getAllPlayerCooldowns = (req, res) => {
  const { wallet } = req.params;

  getAllCooldowns(wallet, (err, result) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    res.json(result);
  });
};

module.exports = {
  getCooldownStatus,
  getAllPlayerCooldowns
};