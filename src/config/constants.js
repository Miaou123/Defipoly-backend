// ============================================
// GAME CONSTANTS (Match your Solana program)
// FIXED: Added cooldownHours to PROPERTIES
// ============================================

const PROPERTIES = [
  // Set 0 - Brown (1 hour cooldown)
  { id: 0, setId: 0, price: 1000000000000, yieldBps: 100, cooldownHours: 1 },
  { id: 1, setId: 0, price: 1200000000000, yieldBps: 100, cooldownHours: 1 },
  // Set 1 - Light Blue (2 hour cooldown)
  { id: 2, setId: 1, price: 2500000000000, yieldBps: 120, cooldownHours: 2 },
  { id: 3, setId: 1, price: 2500000000000, yieldBps: 120, cooldownHours: 2 },
  { id: 4, setId: 1, price: 3000000000000, yieldBps: 120, cooldownHours: 2 },
  // Set 2 - Pink (4 hour cooldown)
  { id: 5, setId: 2, price: 3500000000000, yieldBps: 140, cooldownHours: 4 },
  { id: 6, setId: 2, price: 3500000000000, yieldBps: 140, cooldownHours: 4 },
  { id: 7, setId: 2, price: 4000000000000, yieldBps: 140, cooldownHours: 4 },
  // Set 3 - Orange (4 hour cooldown)
  { id: 8, setId: 3, price: 4500000000000, yieldBps: 160, cooldownHours: 4 },
  { id: 9, setId: 3, price: 4500000000000, yieldBps: 160, cooldownHours: 4 },
  { id: 10, setId: 3, price: 5000000000000, yieldBps: 160, cooldownHours: 4 },
  // Set 4 - Red (5 hour cooldown)
  { id: 11, setId: 4, price: 5500000000000, yieldBps: 180, cooldownHours: 5 },
  { id: 12, setId: 4, price: 5500000000000, yieldBps: 180, cooldownHours: 5 },
  { id: 13, setId: 4, price: 6000000000000, yieldBps: 180, cooldownHours: 5 },
  // Set 5 - Yellow (6 hour cooldown)
  { id: 14, setId: 5, price: 6500000000000, yieldBps: 200, cooldownHours: 6 },
  { id: 15, setId: 5, price: 6500000000000, yieldBps: 200, cooldownHours: 6 },
  { id: 16, setId: 5, price: 7000000000000, yieldBps: 200, cooldownHours: 6 },
  // Set 6 - Green (7 hour cooldown)
  { id: 17, setId: 6, price: 7500000000000, yieldBps: 220, cooldownHours: 7 },
  { id: 18, setId: 6, price: 7500000000000, yieldBps: 220, cooldownHours: 7 },
  { id: 19, setId: 6, price: 8000000000000, yieldBps: 220, cooldownHours: 7 },
  // Set 7 - Dark Blue (24 hour cooldown)
  { id: 20, setId: 7, price: 10000000000000, yieldBps: 250, cooldownHours: 24 },
  { id: 21, setId: 7, price: 12000000000000, yieldBps: 250, cooldownHours: 24 },
];

const SET_BONUS_BPS = 4000;

// Property sets mapping for easier access
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

// Get cooldown duration for each set (in seconds)
function getCooldownDurationForSet(setId) {
  const cooldownHours = [1, 2, 4, 4, 5, 6, 7, 24]; // Set 0-7
  return cooldownHours[setId] * 3600; // Convert hours to seconds
}

// Get number of properties in a set
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