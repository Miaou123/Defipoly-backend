// src/services/incomeCalculator.js
// UPDATED: Uses variable set bonuses from generated constants
// The constants.js file is auto-generated from property-config.ts

const { getDatabase } = require('../config/database');
const { PROPERTIES, getSetBonusBps, PROPERTY_SETS } = require('../config/constants');

/**
 * Calculate a player's actual daily income with variable set bonuses
 * Variable bonuses range from 30% (Brown) to 50% (Dark Blue)
 */
function calculateDailyIncome(walletAddress, callback) {
  const db = getDatabase();
  
  // Get all properties owned by this player
  db.all(
    `SELECT property_id, slots_owned FROM property_ownership 
     WHERE wallet_address = ? AND slots_owned > 0`,
    [walletAddress],
    (err, ownerships) => {
      if (err || !ownerships || ownerships.length === 0) {
        return callback(0);
      }

      // Group by set
      const setData = {};
      for (let i = 0; i < 8; i++) {
        setData[i] = { properties: [], totalSlots: 0, minSlots: Infinity };
      }

      // Process each ownership
      ownerships.forEach(own => {
        const property = PROPERTIES.find(p => p.id === own.property_id);
        if (!property) return;

        const setId = property.setId;
        setData[setId].properties.push({
          propertyId: own.property_id,
          slots: own.slots_owned,
          dailyIncomePerSlot: (property.price * property.yieldBps) / 10000
        });
        setData[setId].totalSlots += own.slots_owned;
        setData[setId].minSlots = Math.min(setData[setId].minSlots, own.slots_owned);
      });

      // Calculate total daily income with variable set bonuses
      let totalDailyIncome = 0;

      Object.keys(setData).forEach(setId => {
        const set = setData[setId];
        if (set.properties.length === 0) return;

        const requiredProperties = getPropertiesInSet(parseInt(setId));
        const hasCompleteSet = set.properties.length >= requiredProperties;
        
        // Get the variable set bonus for this set (30-50% based on set tier)
        const setBonusBps = getSetBonusBps(parseInt(setId));

        set.properties.forEach(prop => {
          const baseDailyIncome = prop.dailyIncomePerSlot * prop.slots;

          if (hasCompleteSet && set.minSlots > 0) {
            // Split into bonus and non-bonus slots
            const bonusSlots = Math.min(prop.slots, set.minSlots);
            const baseSlots = prop.slots - bonusSlots;

            // Base slots get normal income
            const baseIncome = baseSlots * prop.dailyIncomePerSlot;

            // Bonus slots get variable bonus (30-50% based on set)
            const bonusIncome = bonusSlots * prop.dailyIncomePerSlot * (10000 + setBonusBps) / 10000;

            totalDailyIncome += baseIncome + bonusIncome;
          } else {
            // No set bonus
            totalDailyIncome += baseDailyIncome;
          }
        });
      });

      callback(Math.floor(totalDailyIncome));
    }
  );
}

function getPropertiesInSet(setId) {
  return PROPERTY_SETS[setId] ? PROPERTY_SETS[setId].length : 0;
}

module.exports = {
  calculateDailyIncome
};