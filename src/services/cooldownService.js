const { getDatabase } = require('../config/database');
const { PROPERTY_SETS, getCooldownDurationForSet } = require('../config/constants');

/**
 * Get cooldown status for a player's specific set
 */
function getCooldownForSet(wallet, setId, callback) {
  const db = getDatabase();
  const setIdNum = parseInt(setId);

  // Validate setId
  if (isNaN(setIdNum) || setIdNum < 0 || setIdNum > 7) {
    return callback(new Error('Invalid setId (must be 0-7)'), null);
  }

  const propertiesInSet = PROPERTY_SETS[setIdNum];
  if (!propertiesInSet) {
    return callback(new Error('Invalid set'), null);
  }

  const placeholders = propertiesInSet.map(() => '?').join(',');

  // Get the most recent 'buy' action for any property in this set
  db.get(
    `SELECT property_id, block_time, tx_signature
     FROM game_actions
     WHERE player_address = ?
       AND action_type = 'buy'
       AND property_id IN (${placeholders})
     ORDER BY block_time DESC
     LIMIT 1`,
    [wallet, ...propertiesInSet],
    (err, row) => {
      if (err) {
        return callback(err, null);
      }

      // No purchases in this set yet
      if (!row) {
        return callback(null, {
          isOnCooldown: false,
          cooldownRemaining: 0,
          lastPurchaseTimestamp: 0,
          lastPurchasedPropertyId: null,
          cooldownDuration: getCooldownDurationForSet(setIdNum),
          affectedPropertyIds: propertiesInSet,
          setId: setIdNum
        });
      }

      const now = Math.floor(Date.now() / 1000);
      const elapsed = now - row.block_time;
      const remaining = Math.max(0, getCooldownDurationForSet(setIdNum) - elapsed);

      callback(null, {
        isOnCooldown: remaining > 0,
        cooldownRemaining: remaining,
        lastPurchaseTimestamp: row.block_time,
        lastPurchasedPropertyId: row.property_id,
        cooldownDuration: getCooldownDurationForSet(setIdNum),
        affectedPropertyIds: propertiesInSet,
        setId: setIdNum
      });
    }
  );
}

/**
 * Get all active cooldowns for a player
 */
function getAllCooldowns(wallet, callback) {
  const cooldowns = [];
  let completed = 0;
  let hasError = false;

  // Check each set
  Object.keys(PROPERTY_SETS).forEach((setId) => {
    getCooldownForSet(wallet, setId, (err, cooldownData) => {
      if (err) {
        hasError = true;
        return callback(err, null);
      }

      if (cooldownData.isOnCooldown) {
        cooldowns.push(cooldownData);
      }

      completed++;
      if (completed === Object.keys(PROPERTY_SETS).length && !hasError) {
        callback(null, {
          cooldowns,
          activeCooldowns: cooldowns.length
        });
      }
    });
  });
}

module.exports = {
  getCooldownForSet,
  getAllCooldowns
};