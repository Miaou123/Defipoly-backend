const { getDatabase } = require('../config/database');
const { updatePlayerStats } = require('../services/playerStatsService');

const storeAction = (req, res) => {
  const action = req.body;
  
  console.log('📥 [STORE ACTION] Received action:', JSON.stringify(action, null, 2));

  if (!action.txSignature || !action.actionType || !action.playerAddress) {
    console.error('❌ [STORE ACTION] Missing required fields');
    return res.status(400).json({ 
      error: 'Missing required fields: txSignature, actionType, playerAddress' 
    });
  }

  const db = getDatabase();
  const metadata = action.metadata ? JSON.stringify(action.metadata) : null;

  const query = `INSERT INTO game_actions 
    (tx_signature, action_type, player_address, property_id, target_address, amount, slots, success, metadata, block_time)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(tx_signature) DO NOTHING`;

  const params = [
    action.txSignature,
    action.actionType,
    action.playerAddress,
    action.propertyId || null,
    action.targetAddress || null,
    action.amount || null,
    action.slots || null,
    action.success !== undefined ? action.success : null,
    metadata,
    action.blockTime
  ];

  console.log('📝 [STORE ACTION] Query:', query);
  console.log('📝 [STORE ACTION] Params:', params);

  db.run(query, params, function(err) {
    if (err) {
      console.error('❌ [STORE ACTION] Database error:', err);
      return res.status(500).json({ error: 'Database error', details: err.message });
    }

    console.log(`✅ [STORE ACTION] Inserted/Ignored action. Changes: ${this.changes}, Last ID: ${this.lastID}`);

    if (this.changes > 0) {
      updatePlayerStats(action.playerAddress, action.actionType, action.amount);
      console.log(`📊 [STORE ACTION] Updated player stats for ${action.playerAddress}`);
    } else {
      console.log(`ℹ️  [STORE ACTION] Action already exists (tx_signature conflict)`);
    }

    res.json({ 
      success: true, 
      inserted: this.changes > 0,
      actionType: action.actionType,
      txSignature: action.txSignature
    });
  });
};

const storeActionsBatch = (req, res) => {
  const { actions } = req.body;

  if (!Array.isArray(actions) || actions.length === 0) {
    return res.status(400).json({ error: 'Invalid actions array' });
  }

  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO game_actions 
    (tx_signature, action_type, player_address, property_id, target_address, amount, slots, success, metadata, block_time)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(tx_signature) DO NOTHING
  `);

  let inserted = 0;
  actions.forEach(action => {
    const metadata = action.metadata ? JSON.stringify(action.metadata) : null;
    stmt.run([
      action.txSignature,
      action.actionType,
      action.playerAddress,
      action.propertyId || null,
      action.targetAddress || null,
      action.amount || null,
      action.slots || null,
      action.success !== undefined ? action.success : null,
      metadata,
      action.blockTime
    ], function(err) {
      if (!err && this.changes > 0) {
        inserted++;
        updatePlayerStats(action.playerAddress, action.actionType, action.amount);
      }
    });
  });

  stmt.finalize((err) => {
    if (err) {
      console.error('Error in batch insert:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json({ success: true, inserted });
  });
};

const getPlayerActions = (req, res) => {
  const { wallet } = req.params;
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const offset = parseInt(req.query.offset) || 0;
  const actionType = req.query.type;

  let query = `SELECT * FROM game_actions 
     WHERE (player_address = ? OR target_address = ?)`;
  
  const params = [wallet, wallet];
  
  if (actionType) {
    query += ` AND action_type = ?`;
    params.push(actionType);
  }
  
  query += ` ORDER BY block_time DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const db = getDatabase();
  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    const actions = rows.map(row => ({
      id: row.id,
      txSignature: row.tx_signature,
      actionType: row.action_type,
      playerAddress: row.player_address,
      propertyId: row.property_id,
      targetAddress: row.target_address,
      amount: row.amount,
      slots: row.slots,
      success: row.success,
      metadata: row.metadata ? JSON.parse(row.metadata) : null,
      blockTime: row.block_time,
      createdAt: row.created_at
    }));
    
    res.json({ actions, count: actions.length });
  });
};

const getRecentActions = (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const actionType = req.query.type;

  let query = `SELECT * FROM game_actions`;
  const params = [];
  
  if (actionType) {
    query += ` WHERE action_type = ?`;
    params.push(actionType);
  }
  
  query += ` ORDER BY block_time DESC LIMIT ?`;
  params.push(limit);

  const db = getDatabase();
  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    const actions = rows.map(row => ({
      id: row.id,
      txSignature: row.tx_signature,
      actionType: row.action_type,
      playerAddress: row.player_address,
      propertyId: row.property_id,
      targetAddress: row.target_address,
      amount: row.amount,
      slots: row.slots,
      success: row.success,
      metadata: row.metadata ? JSON.parse(row.metadata) : null,
      blockTime: row.block_time
    }));
    
    res.json({ actions });
  });
};

const getPropertyActions = (req, res) => {
  const { propertyId } = req.params;
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);

  const db = getDatabase();
  db.all(
    `SELECT * FROM game_actions 
     WHERE property_id = ?
     ORDER BY block_time DESC 
     LIMIT ?`,
    [propertyId, limit],
    (err, rows) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      const actions = rows.map(row => ({
        id: row.id,
        txSignature: row.tx_signature,
        actionType: row.action_type,
        playerAddress: row.player_address,
        propertyId: row.property_id,
        targetAddress: row.target_address,
        amount: row.amount,
        slots: row.slots,
        success: row.success,
        metadata: row.metadata ? JSON.parse(row.metadata) : null,
        blockTime: row.block_time
      }));
      
      res.json({ actions, count: actions.length });
    }
  );
};

module.exports = {
  storeAction,
  storeActionsBatch,
  getPlayerActions,
  getRecentActions,
  getPropertyActions
};