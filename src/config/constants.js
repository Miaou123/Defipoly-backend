// ============================================
// AUTO-GENERATED FROM property-config.ts
// SINGLE SOURCE OF TRUTH
// Last updated: 2025-10-24
// ============================================

const PROPERTIES = [
  // Set 0 - Brown (10%)
  { id: 0, setId: 0, price: 1500000000000, yieldBps: 600, shieldCostBps: 1000, cooldownHours: 6 },
  { id: 1, setId: 0, price: 1500000000000, yieldBps: 600, shieldCostBps: 1000, cooldownHours: 6 },
  
  // Set 1 - Light Blue (11%)
  { id: 2, setId: 1, price: 3500000000000, yieldBps: 650, shieldCostBps: 1100, cooldownHours: 8 },
  { id: 3, setId: 1, price: 3500000000000, yieldBps: 650, shieldCostBps: 1100, cooldownHours: 8 },
  { id: 4, setId: 1, price: 3500000000000, yieldBps: 650, shieldCostBps: 1100, cooldownHours: 8 },
  
  // Set 2 - Pink (12%)
  { id: 5, setId: 2, price: 7500000000000, yieldBps: 700, shieldCostBps: 1200, cooldownHours: 10 },
  { id: 6, setId: 2, price: 7500000000000, yieldBps: 700, shieldCostBps: 1200, cooldownHours: 10 },
  { id: 7, setId: 2, price: 7500000000000, yieldBps: 700, shieldCostBps: 1200, cooldownHours: 10 },
  
  // Set 3 - Orange (13%)
  { id: 8, setId: 3, price: 15000000000000, yieldBps: 750, shieldCostBps: 1300, cooldownHours: 12 },
  { id: 9, setId: 3, price: 15000000000000, yieldBps: 750, shieldCostBps: 1300, cooldownHours: 12 },
  { id: 10, setId: 3, price: 15000000000000, yieldBps: 750, shieldCostBps: 1300, cooldownHours: 12 },
  
  // Set 4 - Red (14%)
  { id: 11, setId: 4, price: 30000000000000, yieldBps: 800, shieldCostBps: 1400, cooldownHours: 16 },
  { id: 12, setId: 4, price: 30000000000000, yieldBps: 800, shieldCostBps: 1400, cooldownHours: 16 },
  { id: 13, setId: 4, price: 30000000000000, yieldBps: 800, shieldCostBps: 1400, cooldownHours: 16 },
  
  // Set 5 - Yellow (15%)
  { id: 14, setId: 5, price: 60000000000000, yieldBps: 850, shieldCostBps: 1500, cooldownHours: 20 },
  { id: 15, setId: 5, price: 60000000000000, yieldBps: 850, shieldCostBps: 1500, cooldownHours: 20 },
  { id: 16, setId: 5, price: 60000000000000, yieldBps: 850, shieldCostBps: 1500, cooldownHours: 20 },
  
  // Set 6 - Green (16%)
  { id: 17, setId: 6, price: 120000000000000, yieldBps: 900, shieldCostBps: 1600, cooldownHours: 24 },
  { id: 18, setId: 6, price: 120000000000000, yieldBps: 900, shieldCostBps: 1600, cooldownHours: 24 },
  { id: 19, setId: 6, price: 120000000000000, yieldBps: 900, shieldCostBps: 1600, cooldownHours: 24 },
  
  // Set 7 - Dark Blue (17%)
  { id: 20, setId: 7, price: 240000000000000, yieldBps: 1000, shieldCostBps: 1700, cooldownHours: 28 },
  { id: 21, setId: 7, price: 240000000000000, yieldBps: 1000, shieldCostBps: 1700, cooldownHours: 28 },
];

const SET_BONUS_BPS = 4000; // 40% bonus

const PROPERTY_SETS = {
  0: [0, 1],           // Brown
  1: [2, 3, 4],        // Light Blue
  2: [5, 6, 7],        // Pink
  3: [8, 9, 10],       // Orange
  4: [11, 12, 13],     // Red
  5: [14, 15, 16],     // Yellow
  6: [17, 18, 19],     // Green
  7: [20, 21]          // Dark Blue
};

function getCooldownDurationForSet(setId) {
  const firstProp = PROPERTIES.find(p => p.setId === setId);
  return firstProp ? firstProp.cooldownHours * 3600 : 86400;
}

function getPropertiesInSet(setId) {
  return PROPERTY_SETS[setId] ? PROPERTY_SETS[setId].length : 0;
}

module.exports = {
  PROPERTIES,
  SET_BONUS_BPS,
  PROPERTY_SETS,
  getCooldownDurationForSet,
  getPropertiesInSet
};