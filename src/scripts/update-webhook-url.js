// ============================================
// FILE: update-webhook-url.js
// Update existing Helius webhook with correct URL
// ============================================

require('dotenv').config();
const axios = require('axios');
const readline = require('readline');

const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const NGROK_URL = 'https://noncertified-domonique-corymblike.ngrok-free.dev';
const WEBHOOK_ENDPOINT = '/api/webhooks/helius';
const FULL_WEBHOOK_URL = NGROK_URL + WEBHOOK_ENDPOINT;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function listWebhooks() {
  try {
    const response = await axios.get(
      `https://api.helius.xyz/v0/webhooks?api-key=${HELIUS_API_KEY}`
    );
    return response.data;
  } catch (error) {
    console.error('❌ Error fetching webhooks:', error.response?.data || error.message);
    return [];
  }
}

async function updateWebhook(webhookID, updates) {
  try {
    const response = await axios.put(
      `https://api.helius.xyz/v0/webhooks/${webhookID}?api-key=${HELIUS_API_KEY}`,
      updates
    );
    return response.data;
  } catch (error) {
    console.error('❌ Error updating webhook:', error.response?.data || error.message);
    return null;
  }
}

async function deleteWebhook(webhookID) {
  try {
    await axios.delete(
      `https://api.helius.xyz/v0/webhooks/${webhookID}?api-key=${HELIUS_API_KEY}`
    );
    return true;
  } catch (error) {
    console.error('❌ Error deleting webhook:', error.response?.data || error.message);
    return false;
  }
}

async function createWebhook() {
  const PROGRAM_ID = process.env.PROGRAM_ID;
  
  if (!PROGRAM_ID) {
    console.error('❌ PROGRAM_ID not set in .env');
    return null;
  }
  
  try {
    const response = await axios.post(
      `https://api.helius.xyz/v0/webhooks?api-key=${HELIUS_API_KEY}`,
      {
        webhookURL: FULL_WEBHOOK_URL,
        transactionTypes: ['ANY'],
        accountAddresses: [PROGRAM_ID],
        webhookType: 'raw',
        txnStatus: 'confirmed'
      }
    );
    
    console.log('✅ New webhook created!');
    console.log('   ID:', response.data.webhookID);
    console.log('   URL:', FULL_WEBHOOK_URL);
    return response.data;
  } catch (error) {
    console.error('❌ Error creating webhook:', error.response?.data || error.message);
    return null;
  }
}

async function main() {
  console.log('\n🔧 HELIUS WEBHOOK UPDATER\n');
  console.log('='.repeat(60));
  
  if (!HELIUS_API_KEY) {
    console.error('\n❌ HELIUS_API_KEY not found in .env file');
    console.error('   Please add it to your .env file');
    rl.close();
    return;
  }
  
  console.log(`\n✅ Helius API Key: ${HELIUS_API_KEY.substring(0, 10)}...`);
  console.log(`✅ Target Webhook URL: ${FULL_WEBHOOK_URL}\n`);
  
  console.log('📡 Fetching existing webhooks...\n');
  const webhooks = await listWebhooks();
  
  if (webhooks.length === 0) {
    console.log('ℹ️  No existing webhooks found.');
    const answer = await question('Would you like to create a new webhook? (yes/no): ');
    
    if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
      await createWebhook();
    }
    rl.close();
    return;
  }
  
  console.log(`Found ${webhooks.length} webhook(s):\n`);
  
  webhooks.forEach((webhook, index) => {
    console.log(`${index + 1}. Webhook ID: ${webhook.webhookID}`);
    console.log(`   URL: ${webhook.webhookURL}`);
    console.log(`   Type: ${webhook.webhookType}`);
    console.log(`   Addresses: ${webhook.accountAddresses.join(', ')}`);
    console.log();
  });
  
  console.log('Options:');
  console.log('  1. Update an existing webhook URL');
  console.log('  2. Delete an existing webhook');
  console.log('  3. Create a new webhook');
  console.log('  4. Exit\n');
  
  const choice = await question('Choose an option (1-4): ');
  
  switch (choice.trim()) {
    case '1':
      const updateIndex = await question(`Which webhook to update? (1-${webhooks.length}): `);
      const webhookToUpdate = webhooks[parseInt(updateIndex) - 1];
      
      if (webhookToUpdate) {
        console.log(`\nUpdating webhook ${webhookToUpdate.webhookID}...`);
        const result = await updateWebhook(webhookToUpdate.webhookID, {
          webhookURL: FULL_WEBHOOK_URL
        });
        
        if (result) {
          console.log('✅ Webhook updated successfully!');
          console.log('   New URL:', FULL_WEBHOOK_URL);
        }
      } else {
        console.log('❌ Invalid webhook number');
      }
      break;
      
    case '2':
      const deleteIndex = await question(`Which webhook to delete? (1-${webhooks.length}): `);
      const webhookToDelete = webhooks[parseInt(deleteIndex) - 1];
      
      if (webhookToDelete) {
        const confirm = await question(`Are you sure you want to delete ${webhookToDelete.webhookID}? (yes/no): `);
        if (confirm.toLowerCase() === 'yes' || confirm.toLowerCase() === 'y') {
          const deleted = await deleteWebhook(webhookToDelete.webhookID);
          if (deleted) {
            console.log('✅ Webhook deleted successfully!');
          }
        }
      } else {
        console.log('❌ Invalid webhook number');
      }
      break;
      
    case '3':
      await createWebhook();
      break;
      
    case '4':
      console.log('👋 Goodbye!');
      break;
      
    default:
      console.log('❌ Invalid option');
  }
  
  rl.close();
}

main().catch(error => {
  console.error('\n❌ Error:', error.message);
  rl.close();
  process.exit(1);
});