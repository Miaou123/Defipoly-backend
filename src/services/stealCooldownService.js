const { getDatabase } = require('../config/database');
const { PROPERTIES } = require('../config/constants');

/**
 * Get steal cooldown status for a player's specific property
 * Steal cooldown is HALF of buy cooldown and is PER PROPERTY (not per set)
 */
function getStealCooldownForProperty(wallet, propertyId, callback) {
  const db = getDatabase();
  const propIdNum = parseInt(propertyId);

  if (isNaN(propIdNum) || propIdNum < 0 || propIdNum > 21) {
    return callback(new Error('Invalid propertyId (must be 0-21)'), null);
  }

  // Find property info to get cooldown duration
  const property = PROPERTIES.find(p => p.id === propIdNum);
  if (!property) {
    return callback(new Error('Invalid property'), null);
  }

  // Get cooldown duration (half of buy cooldown)
  const buyCooldownSeconds = property.cooldownHours * 3600;
  const stealCooldownDuration = buyCooldownSeconds / 2;

  // Get the most recent steal attempt (success OR failure) for THIS specific property
  db.get(
    `SELECT property_id, block_time, tx_signature, action_type
     FROM game_actions
     WHERE player_address = ?
       AND (action_type = 'steal_success' OR action_type = 'steal_failed')
       AND property_id = ?
     ORDER BY block_time DESC
     LIMIT 1`,
    [wallet, propIdNum],
    (err, row) => {
      if (err) {
        return callback(err, null);
      }

      // No steal attempts on this property yet
      if (!row) {
        return callback(null, {
          isOnCooldown: false,
          cooldownRemaining: 0,
          lastStealTimestamp: 0,
          lastStealPropertyId: null,
          cooldownDuration: stealCooldownDuration,
          propertyId: propIdNum
        });
      }

      const now = Math.floor(Date.now() / 1000);
      const elapsed = now - row.block_time;
      const remaining = Math.max(0, stealCooldownDuration - elapsed);

      callback(null, {
        isOnCooldown: remaining > 0,
        cooldownRemaining: remaining,
        lastStealTimestamp: row.block_time,
        lastStealPropertyId: row.property_id,
        lastStealSuccess: row.action_type === 'steal_success',
        cooldownDuration: stealCooldownDuration,
        propertyId: propIdNum
      });
    }
  );
}

/**
 * Get all active steal cooldowns for a player (across all properties)
 */
function getAllStealCooldowns(wallet, callback) {
  const db = getDatabase();

  // Get all recent steal attempts grouped by property
  db.all(
    `SELECT 
       property_id,
       MAX(block_time) as last_steal_time,
       action_type
     FROM game_actions
     WHERE player_address = ?
       AND (action_type = 'steal_success' OR action_type = 'steal_failed')
     GROUP BY property_id
     ORDER BY last_steal_time DESC`,
    [wallet],
    (err, rows) => {
      if (err) {
        return callback(err, null);
      }

      const cooldowns = [];
      const now = Math.floor(Date.now() / 1000);

      rows.forEach(row => {
        const property = PROPERTIES.find(p => p.id === row.property_id);
        if (!property) return;

        const buyCooldownSeconds = property.cooldownHours * 3600;
        const stealCooldownDuration = buyCooldownSeconds / 2;
        const elapsed = now - row.last_steal_time;
        const remaining = Math.max(0, stealCooldownDuration - elapsed);

        if (remaining > 0) {
          cooldowns.push({
            propertyId: row.property_id,
            propertyName: property.name,
            isOnCooldown: true,
            cooldownRemaining: remaining,
            lastStealTimestamp: row.last_steal_time,
            cooldownDuration: stealCooldownDuration
          });
        }
      });

      callback(null, {
        cooldowns,
        activeCooldowns: cooldowns.length
      });
    }
  );
}

module.exports = {
  getStealCooldownForProperty,
  getAllStealCooldowns
};