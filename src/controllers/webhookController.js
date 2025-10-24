// ============================================
// FILE: webhookController.js
// Transaction processor for both webhooks and WSS
// FIXED: Now uses gameService.js for proper stats tracking
// ============================================

const { parseTransaction } = require('../services/transactionProcessor');
const { getDatabase } = require('../config/database');
const { updatePlayerStats, updateTargetOnSteal } = require('../services/gameService'); // ✅ FIXED!

async function processWebhook(payload) {
  const transactions = Array.isArray(payload) ? payload : [payload];
  
  for (const tx of transactions) {
    try {
      if (tx.meta?.err !== null) continue;
      
      const parsedData = await parseTransaction(tx);
      if (!parsedData) continue;
      
      await storeTransactionData(parsedData);
      
      // Update player stats using gameService (the correct one!)
      await updatePlayerStats(
        parsedData.playerAddress,
        parsedData.actionType,
        parsedData.amount,
        parsedData.slots,
        parsedData.propertyId
      );

      // If steal success, update target player too
      if (parsedData.actionType === 'steal_success' && parsedData.targetAddress) {
        await updateTargetOnSteal(
          parsedData.targetAddress,
          parsedData.propertyId,
          parsedData.slots
        );
      }
    } catch (error) {
      console.error('❌ [WEBHOOK] Error:', error);
    }
  }
}

async function storeTransactionData(data) {
  const db = getDatabase();
  
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO game_actions 
       (tx_signature, action_type, player_address, property_id, 
        target_address, amount, slots, success, metadata, block_time)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(tx_signature) DO NOTHING`,
      [
        data.signature,
        data.actionType,
        data.playerAddress,
        data.propertyId || null,
        data.targetAddress || null,
        data.amount || null,
        data.slots || null,
        data.success !== undefined ? data.success : null,
        JSON.stringify(data.metadata || {}),
        data.blockTime
      ],
      function(err) {
        if (err) reject(err);
        else {
          if (this.changes > 0) {
            console.log(`      ✅ [WSS] Stored in database (Row ID: ${this.lastID})`);
          } else {
            console.log(`      ℹ️  [WSS] Transaction already in database (duplicate)`);
          }
          resolve(this.changes);
        }
      }
    );
  });
}

module.exports = { processWebhook };