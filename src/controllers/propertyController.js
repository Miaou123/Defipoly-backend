const { getDatabase } = require('../config/database');

/**
 * Get property statistics including number of owners with unshielded slots
 */
const getPropertyStats = (req, res) => {
  const { propertyId } = req.params;
  const db = getDatabase();

  db.get(
    `SELECT 
      COUNT(DISTINCT wallet_address) as owners_with_unshielded_slots
     FROM property_ownership
     WHERE property_id = ? 
       AND slots_owned > 0
       AND (slots_shielded = 0 OR slots_shielded < slots_owned OR shield_expiry < strftime('%s', 'now'))`,
    [propertyId],
    (err, row) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      res.json({
        propertyId: parseInt(propertyId),
        ownersWithUnshieldedSlots: row.owners_with_unshielded_slots || 0
      });
    }
  );
};

/**
 * Get all property stats (for all 22 properties at once)
 */
const getAllPropertiesStats = (req, res) => {
  const db = getDatabase();

  db.all(
    `SELECT 
      property_id,
      COUNT(DISTINCT wallet_address) as owners_with_unshielded_slots
     FROM property_ownership
     WHERE slots_owned > 0
       AND (slots_shielded = 0 OR slots_shielded < slots_owned OR shield_expiry < strftime('%s', 'now'))
     GROUP BY property_id`,
    [],
    (err, rows) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      const stats = {};
      rows.forEach(row => {
        stats[row.property_id] = {
          ownersWithUnshieldedSlots: row.owners_with_unshielded_slots
        };
      });
      
      res.json({ properties: stats });
    }
  );
};

module.exports = {
  getPropertyStats,
  getAllPropertiesStats
};