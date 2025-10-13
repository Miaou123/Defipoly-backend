const { getDatabase } = require('../config/database');
const { calculateDailyIncome } = require('./incomeCalculator');

/**
 * Update property ownership and recalculate daily income
 */
function updatePropertyOwnership(walletAddress, propertyId, slotsDelta, callback) {
  const db = getDatabase();
  
  db.run(
    `INSERT INTO property_ownership (wallet_address, property_id, slots_owned, last_updated)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(wallet_address, property_id) 
     DO UPDATE SET 
       slots_owned = slots_owned + ?,
       last_updated = ?`,
    [walletAddress, propertyId, slotsDelta, Date.now(), slotsDelta, Date.now()],
    (err) => {
      if (err) {
        console.error('Error updating property ownership:', err);
        if (callback) callback(err);
        return;
      }

      // Recalculate and update daily income
      calculateDailyIncome(walletAddress, (dailyIncome) => {
        db.run(
          `UPDATE player_stats SET daily_income = ? WHERE wallet_address = ?`,
          [dailyIncome, walletAddress],
          (err) => {
            if (err) console.error('Error updating daily income:', err);
            if (callback) callback(null, dailyIncome);
          }
        );
      });
    }
  );
}

/**
 * Update player stats based on action type
 */
function updatePlayerStats(playerAddress, actionType, amount, slots, propertyId) {
  const db = getDatabase();
  
  // Insert or increment total actions
  db.run(
    `INSERT INTO player_stats (wallet_address, total_actions, last_action_time)
     VALUES (?, 1, ?)
     ON CONFLICT(wallet_address) 
     DO UPDATE SET 
       total_actions = total_actions + 1,
       last_action_time = ?,
       updated_at = strftime('%s', 'now')`,
    [playerAddress, Date.now(), Date.now()]
  );

  let updateField = null;
  let spentEarned = null;

  switch (actionType) {
    case 'buy':
      updateField = 'properties_bought = properties_bought + 1';
      if (slots) {
        updateField += `, total_slots_owned = total_slots_owned + ${slots}`;
      }
      spentEarned = amount ? `total_spent = total_spent + ${amount}` : null;

      // Update property ownership and daily income
      if (propertyId !== undefined && slots) {
        updatePropertyOwnership(playerAddress, propertyId, slots);
      }
      break;

    case 'sell':
      updateField = 'properties_sold = properties_sold + 1';
      if (slots) {
        updateField += `, total_slots_owned = total_slots_owned - ${slots}`;
      }
      spentEarned = amount ? `total_earned = total_earned + ${amount}` : null;

      // Update property ownership and daily income
      if (propertyId !== undefined && slots) {
        updatePropertyOwnership(playerAddress, propertyId, -slots);
      }
      break;

    case 'steal_success':
      updateField = 'successful_steals = successful_steals + 1';
      if (slots) {
        updateField += `, total_slots_owned = total_slots_owned + ${slots}`;
      }
      spentEarned = amount ? `total_spent = total_spent + ${amount}` : null;

      // Update property ownership and daily income
      if (propertyId !== undefined && slots) {
        updatePropertyOwnership(playerAddress, propertyId, slots);
      }
      break;

    case 'steal_failed':
      updateField = 'failed_steals = failed_steals + 1';
      spentEarned = amount ? `total_spent = total_spent + ${amount}` : null;
      break;

    case 'claim':
      updateField = 'rewards_claimed = rewards_claimed + 1';
      spentEarned = amount ? `total_earned = total_earned + ${amount}` : null;
      break;

    case 'shield':
      updateField = 'shields_activated = shields_activated + 1';
      spentEarned = amount ? `total_spent = total_spent + ${amount}` : null;
      break;
  }

  if (updateField) {
    const updateSql = spentEarned 
      ? `UPDATE player_stats SET ${updateField}, ${spentEarned} WHERE wallet_address = ?`
      : `UPDATE player_stats SET ${updateField} WHERE wallet_address = ?`;
    
    db.run(updateSql, [playerAddress]);
  }
}

/**
 * Update target player when they lose slots from steal
 */
function updateTargetOnSteal(targetAddress, propertyId, slots) {
  const db = getDatabase();
  
  if (propertyId !== undefined && slots) {
    updatePropertyOwnership(targetAddress, propertyId, -slots);
  }
  
  db.run(
    `UPDATE player_stats 
     SET total_slots_owned = total_slots_owned - ?
     WHERE wallet_address = ?`,
    [slots, targetAddress]
  );
}

module.exports = {
  updatePropertyOwnership,
  updatePlayerStats,
  updateTargetOnSteal
};