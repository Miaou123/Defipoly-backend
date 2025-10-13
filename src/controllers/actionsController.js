const { getDatabase } = require('../config/database');
const { updatePlayerStats, updateTargetOnSteal } = require('../services/gameService');

const storeAction = (req, res) => {
  const {
    txSignature,
    actionType,
    playerAddress,
    propertyId,
    targetAddress,
    amount,
    slots,
    success,
    metadata,
    blockTime,
  } = req.body;

  if (!txSignature || !actionType || !playerAddress || !blockTime) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const db = getDatabase();
  const metadataJson = metadata ? JSON.stringify(metadata) : null;

  db.run(
    `INSERT INTO game_actions 
     (tx_signature, action_type, player_address, property_id, target_address, 
      amount, slots, success, metadata, block_time)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tx_signature) DO NOTHING`,
    [txSignature, actionType, playerAddress, propertyId, targetAddress, 
     amount, slots, success, metadataJson, blockTime],
    function(err) {
      if (err) {
        console.error('Error storing action:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      if (this.changes > 0) {
        updatePlayerStats(playerAddress, actionType, amount, slots, propertyId);
        
        if (actionType === 'steal_success' && targetAddress && slots && propertyId !== undefined) {
          updateTargetOnSteal(targetAddress, propertyId, slots);
        }
      }

      res.json({ success: true, id: this.lastID });
    }
  );
};

const storeActionsBatch = (req, res) => {
  const { actions } = req.body;

  if (!Array.isArray(actions) || actions.length === 0) {
    return res.status(400).json({ error: 'Invalid actions array' });
  }

  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO game_actions 
    (tx_signature, action_type, player_address, property_id, target_address, 
     amount, slots, success, metadata, block_time)
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