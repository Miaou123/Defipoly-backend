// ============================================
// AUTO-GENERATED FROM property-config.ts
// SINGLE SOURCE OF TRUTH
// Last updated: 2025-10-24
// ============================================

const PROPERTIES = [
  // Set 0 - Brown
  { id: 0, setId: 0, price: 1500000000000, yieldBps: 600, cooldownHours: 6 }, // Mediterranean Avenue
  { id: 1, setId: 0, price: 1500000000000, yieldBps: 600, cooldownHours: 6 }, // Baltic Avenue
  // Set 1 - Light Blue
  { id: 2, setId: 1, price: 3500000000000, yieldBps: 650, cooldownHours: 8 }, // Oriental Avenue
  { id: 3, setId: 1, price: 3500000000000, yieldBps: 650, cooldownHours: 8 }, // Vermont Avenue
  { id: 4, setId: 1, price: 3500000000000, yieldBps: 650, cooldownHours: 8 }, // Connecticut Avenue
  // Set 2 - Pink
  { id: 5, setId: 2, price: 7500000000000, yieldBps: 700, cooldownHours: 10 }, // St. Charles Place
  { id: 6, setId: 2, price: 7500000000000, yieldBps: 700, cooldownHours: 10 }, // States Avenue
  { id: 7, setId: 2, price: 7500000000000, yieldBps: 700, cooldownHours: 10 }, // Virginia Avenue
  // Set 3 - Orange
  { id: 8, setId: 3, price: 15000000000000, yieldBps: 750, cooldownHours: 12 }, // St. James Place
  { id: 9, setId: 3, price: 15000000000000, yieldBps: 750, cooldownHours: 12 }, // Tennessee Avenue
  { id: 10, setId: 3, price: 15000000000000, yieldBps: 750, cooldownHours: 12 }, // New York Avenue
  // Set 4 - Red
  { id: 11, setId: 4, price: 30000000000000, yieldBps: 800, cooldownHours: 16 }, // Kentucky Avenue
  { id: 12, setId: 4, price: 30000000000000, yieldBps: 800, cooldownHours: 16 }, // Indiana Avenue
  { id: 13, setId: 4, price: 30000000000000, yieldBps: 800, cooldownHours: 16 }, // Illinois Avenue
  // Set 5 - Yellow
  { id: 14, setId: 5, price: 60000000000000, yieldBps: 850, cooldownHours: 20 }, // Atlantic Avenue
  { id: 15, setId: 5, price: 60000000000000, yieldBps: 850, cooldownHours: 20 }, // Ventnor Avenue
  { id: 16, setId: 5, price: 60000000000000, yieldBps: 850, cooldownHours: 20 }, // Marvin Gardens
  // Set 6 - Green
  { id: 17, setId: 6, price: 120000000000000, yieldBps: 900, cooldownHours: 24 }, // Pacific Avenue
  { id: 18, setId: 6, price: 120000000000000, yieldBps: 900, cooldownHours: 24 }, // North Carolina Avenue
  { id: 19, setId: 6, price: 120000000000000, yieldBps: 900, cooldownHours: 24 }, // Pennsylvania Avenue
  // Set 7 - Dark Blue
  { id: 20, setId: 7, price: 250000000000000, yieldBps: 1000, cooldownHours: 24 }, // Park Place
  { id: 21, setId: 7, price: 250000000000000, yieldBps: 1000, cooldownHours: 24 }, // Boardwalk
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