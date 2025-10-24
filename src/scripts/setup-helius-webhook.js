require('dotenv').config();
const axios = require('axios');

const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const PROGRAM_ID = process.env.PROGRAM_ID;
const WEBHOOK_URL = process.env.WEBHOOK_URL;

async function createWebhook() {
  const response = await axios.post(
    `https://api.helius.xyz/v0/webhooks?api-key=${HELIUS_API_KEY}`,
    {
      webhookURL: WEBHOOK_URL,
      transactionTypes: ['ANY'],
      accountAddresses: [PROGRAM_ID],
      webhookType: 'raw',
      txnStatus: 'confirmed'
    }
  );
  console.log('✅ Webhook created! ID:', response.data.webhookID);
}

const command = process.argv[2];
if (command === 'create') createWebhook();