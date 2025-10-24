// ============================================
// FILE: debug-webhook.js
// Comprehensive webhook debugging and testing script
// ============================================

require('dotenv').config();
const axios = require('axios');
const { PublicKey } = require('@solana/web3.js');

const BACKEND_URL = process.env.WEBHOOK_URL || 'http://localhost:3005';
const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const PROGRAM_ID = process.env.PROGRAM_ID;

console.log('\n🔍 WEBHOOK DIAGNOSTIC TOOL\n');
console.log('='.repeat(60));

// Step 1: Check environment variables
console.log('\n📋 Step 1: Checking Environment Variables\n');

if (!HELIUS_API_KEY) {
  console.log('❌ HELIUS_API_KEY is not set');
} else {
  console.log(`✅ HELIUS_API_KEY: ${HELIUS_API_KEY.substring(0, 10)}...`);
}

if (!PROGRAM_ID) {
  console.log('❌ PROGRAM_ID is not set');
} else {
  try {
    new PublicKey(PROGRAM_ID);
    console.log(`✅ PROGRAM_ID: ${PROGRAM_ID}`);
  } catch (error) {
    console.log(`❌ PROGRAM_ID is invalid: ${PROGRAM_ID}`);
  }
}

console.log(`📍 WEBHOOK_URL: ${BACKEND_URL}`);

// Step 2: Test backend connectivity
async function testBackend() {
  console.log('\n📋 Step 2: Testing Backend Connectivity\n');
  
  try {
    // Test health endpoint
    const healthResponse = await axios.get(`${BACKEND_URL}/health`, { timeout: 5000 });
    console.log('✅ Backend is online');
    console.log('   Version:', healthResponse.data.version);
    
    // Test webhook test endpoint
    try {
      const webhookTestResponse = await axios.get(`${BACKEND_URL}/api/webhooks/test`, { timeout: 5000 });
      console.log('✅ Webhook route is accessible');
      console.log('   Endpoint:', webhookTestResponse.data.endpoint);
    } catch (error) {
      console.log('❌ Webhook route is NOT accessible');
      console.log('   This means the webhooks.js route file is missing or not mounted correctly!');
      console.log('   Expected endpoint: POST /api/webhooks/helius');
    }
  } catch (error) {
    console.log('❌ Cannot connect to backend');
    console.log('   Error:', error.message);
    console.log('   Make sure your backend is running on:', BACKEND_URL);
    return false;
  }
  
  return true;
}

// Step 3: List Helius webhooks
async function listHeliusWebhooks() {
  console.log('\n📋 Step 3: Checking Helius Webhook Configuration\n');
  
  if (!HELIUS_API_KEY) {
    console.log('⏭️  Skipping (no API key)');
    return;
  }
  
  try {
    const response = await axios.get(
      `https://api.helius.xyz/v0/webhooks?api-key=${HELIUS_API_KEY}`
    );
    
    const webhooks = response.data;
    
    if (webhooks.length === 0) {
      console.log('⚠️  No webhooks found');
      console.log('   You need to create a webhook using: npm run setup-webhook');
      return;
    }
    
    console.log(`Found ${webhooks.length} webhook(s):\n`);
    
    webhooks.forEach((webhook, index) => {
      console.log(`Webhook ${index + 1}:`);
      console.log(`  ID: ${webhook.webhookID}`);
      console.log(`  URL: ${webhook.webhookURL}`);
      console.log(`  Type: ${webhook.webhookType}`);
      console.log(`  Transaction Types: ${webhook.transactionTypes.join(', ')}`);
      console.log(`  Addresses: ${webhook.accountAddresses.join(', ')}`);
      console.log(`  Transaction Status: ${webhook.txnStatus || 'confirmed'}`);
      console.log();
      
      // Check if webhook URL matches
      if (webhook.webhookURL === BACKEND_URL + '/api/webhooks/helius') {
        console.log('  ✅ Webhook URL matches your backend');
      } else {
        console.log(`  ⚠️  Webhook URL (${webhook.webhookURL}) does NOT match your backend (${BACKEND_URL}/api/webhooks/helius)`);
      }
      
      // Check if program ID matches
      if (webhook.accountAddresses.includes(PROGRAM_ID)) {
        console.log('  ✅ Program ID is configured');
      } else {
        console.log(`  ⚠️  Program ID not found in webhook addresses`);
      }
      console.log();
    });
  } catch (error) {
    console.log('❌ Error fetching webhooks from Helius');
    console.log('   Error:', error.response?.data || error.message);
  }
}

// Step 4: Test webhook endpoint with sample data
async function testWebhookEndpoint() {
  console.log('\n📋 Step 4: Testing Webhook Endpoint with Sample Data\n');
  
  const sampleWebhookData = [{
    transaction: {
      signatures: ['test_signature_' + Date.now()]
    },
    meta: {
      err: null,
      logMessages: [
        'Program log: Instruction: BuyProperty',
        'Program data: test_base64_data'
      ]
    },
    blockTime: Math.floor(Date.now() / 1000)
  }];
  
  try {
    const response = await axios.post(
      `${BACKEND_URL}/api/webhooks/test`,
      sampleWebhookData,
      { timeout: 5000 }
    );
    
    console.log('✅ Webhook endpoint responded successfully');
    console.log('   Response:', response.data);
  } catch (error) {
    console.log('❌ Webhook endpoint test failed');
    console.log('   Error:', error.response?.data || error.message);
  }
}

// Step 5: Recommendations
function printRecommendations() {
  console.log('\n📋 Step 5: Recommendations\n');
  console.log('='.repeat(60));
  
  console.log('\n✅ ACTIONS TO FIX YOUR WEBHOOK:\n');
  
  console.log('1. Copy the webhooks.js file to your backend:');
  console.log('   cp webhooks.js defipoly-backend/src/routes/webhooks.js\n');
  
  console.log('2. Make sure your .env file has these variables:');
  console.log('   HELIUS_API_KEY=your_helius_api_key');
  console.log('   PROGRAM_ID=your_program_public_key');
  console.log('   WEBHOOK_URL=https://noncertified-domonique-corymblike.ngrok-free.dev\n');
  
  console.log('3. Restart your backend:');
  console.log('   cd defipoly-backend && npm start\n');
  
  console.log('4. Update your Helius webhook URL to:');
  console.log('   https://noncertified-domonique-corymblike.ngrok-free.dev/api/webhooks/helius\n');
  
  console.log('5. Or create a new webhook with the correct URL:');
  console.log('   cd defipoly-backend && node src/scripts/setup-helius-webhook.js create\n');
  
  console.log('6. Test by making a transaction on your frontend\n');
  
  console.log('7. Monitor backend logs for webhook activity:');
  console.log('   Look for messages like: 🔔 [WEBHOOK] Received webhook from Helius\n');
  
  console.log('='.repeat(60));
}

// Run all diagnostics
async function runDiagnostics() {
  const backendOnline = await testBackend();
  
  if (backendOnline) {
    await listHeliusWebhooks();
    await testWebhookEndpoint();
  }
  
  printRecommendations();
}

runDiagnostics().catch(error => {
  console.error('\n❌ Diagnostic failed:', error);
  process.exit(1);
});