// ============================================
// FILE: src/routes/webhooks.js
// Webhook route to receive Helius transaction notifications
// ============================================

const express = require('express');
const router = express.Router();
const { processWebhook } = require('../controllers/webhookController');

// POST /api/webhooks/helius
// This is where Helius will send transaction data
router.post('/helius', async (req, res) => {
  try {
    console.log('\n🔔 [WEBHOOK] Received webhook from Helius');
    console.log('📦 Payload size:', JSON.stringify(req.body).length, 'bytes');
    
    // Log the transaction signatures for debugging
    if (Array.isArray(req.body)) {
      console.log(`📝 Processing ${req.body.length} transactions`);
      req.body.forEach((tx, i) => {
        const sig = tx.transaction?.signatures?.[0] || 'unknown';
        console.log(`  ${i + 1}. ${sig.substring(0, 20)}...`);
      });
    } else if (req.body.transaction) {
      const sig = req.body.transaction.signatures?.[0] || 'unknown';
      console.log(`📝 Processing single transaction: ${sig.substring(0, 20)}...`);
    }
    
    // Process the webhook
    await processWebhook(req.body);
    
    console.log('✅ [WEBHOOK] Successfully processed');
    
    // Respond to Helius immediately
    res.status(200).json({ success: true, message: 'Webhook processed' });
  } catch (error) {
    console.error('❌ [WEBHOOK] Error processing webhook:', error);
    console.error('Error stack:', error.stack);
    
    // Still respond with 200 to avoid Helius retries
    res.status(200).json({ 
      success: false, 
      error: error.message,
      note: 'Error logged but returning 200 to avoid retries' 
    });
  }
});

// GET /api/webhooks/test
// Test endpoint to verify the webhook route is working
router.get('/test', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Webhook endpoint is active',
    endpoint: '/api/webhooks/helius',
    timestamp: new Date().toISOString()
  });
});

// POST /api/webhooks/test
// Test endpoint to simulate a webhook
router.post('/test', async (req, res) => {
  try {
    console.log('🧪 [TEST] Received test webhook');
    await processWebhook(req.body);
    res.json({ success: true, message: 'Test webhook processed' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;