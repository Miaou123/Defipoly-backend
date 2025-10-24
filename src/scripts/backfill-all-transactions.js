// ============================================
// FILE: backfill-all-transactions.js
// Fetch ALL historical transactions from blockchain
// and backfill any missing ones
// ============================================

const { Connection, PublicKey } = require('@solana/web3.js');
const { initDatabase, getDatabase, closeDatabase } = require('../config/database');
const { processWebhook } = require('../controllers/webhookController');
require('dotenv').config();

async function backfillAllTransactions() {
  console.log('🔄 Full Historical Backfill\n');
  console.log('This will fetch ALL transactions from the blockchain and backfill missing ones.\n');

  // Initialize database
  console.log('📦 Initializing database...');
  await initDatabase();
  console.log('✅ Database initialized\n');

  const db = getDatabase();

  // Setup connection
  const RPC_URL = process.env.RPC_URL;
  const PROGRAM_ID = process.env.PROGRAM_ID;

  if (!RPC_URL || !PROGRAM_ID) {
    throw new Error('RPC_URL and PROGRAM_ID must be set in .env');
  }

  console.log('🌐 Connecting to Solana...');
  console.log(`   RPC: ${RPC_URL}`);
  console.log(`   Program: ${PROGRAM_ID}\n`);

  const connection = new Connection(RPC_URL, 'confirmed');
  const programId = new PublicKey(PROGRAM_ID);

  // Verify connection
  const version = await connection.getVersion();
  console.log(`✅ Connected to Solana (version: ${version['solana-core']})\n`);

  // Step 1: Get count of existing transactions
  console.log('📊 Checking existing transactions in database...');
  const existingCount = await new Promise((resolve, reject) => {
    db.get('SELECT COUNT(*) as count FROM game_actions', (err, row) => {
      if (err) reject(err);
      else resolve(row.count);
    });
  });
  console.log(`   Found ${existingCount} existing transactions in database\n`);

  // Step 2: Fetch ALL signatures from blockchain
  console.log('🔍 Fetching ALL transaction signatures from blockchain...');
  console.log('   This may take a while...\n');

  let allSignatures = [];
  let before = undefined;
  let batch = 0;

  while (true) {
    batch++;
    const limit = 1000; // Maximum per request
    
    console.log(`   Batch ${batch}: Fetching up to ${limit} signatures...`);
    
    const signatures = await connection.getSignaturesForAddress(
      programId,
      { before, limit },
      'confirmed'
    );

    if (signatures.length === 0) {
      console.log(`   No more signatures found.\n`);
      break;
    }

    allSignatures.push(...signatures);
    console.log(`   Found ${signatures.length} signatures (total: ${allSignatures.length})`);

    // If we got less than the limit, we've reached the end
    if (signatures.length < limit) {
      console.log(`   Reached end of transaction history.\n`);
      break;
    }

    // Use the last signature as 'before' for next batch
    before = signatures[signatures.length - 1].signature;

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log(`✅ Fetched ${allSignatures.length} total signatures from blockchain\n`);

  // Step 3: Check which ones are missing
  console.log('🔍 Identifying missing transactions...');
  
  const missingSignatures = [];
  let checkedCount = 0;

  for (const sig of allSignatures) {
    checkedCount++;
    
    if (checkedCount % 100 === 0) {
      console.log(`   Checked ${checkedCount}/${allSignatures.length}...`);
    }

    const exists = await new Promise((resolve, reject) => {
      db.get(
        'SELECT tx_signature FROM game_actions WHERE tx_signature = ?',
        [sig.signature],
        (err, row) => {
          if (err) reject(err);
          else resolve(!!row);
        }
      );
    });

    if (!exists) {
      missingSignatures.push(sig);
    }
  }

  console.log(`\n✅ Checked all ${allSignatures.length} signatures\n`);

  if (missingSignatures.length === 0) {
    console.log('🎉 No missing transactions! Your database is complete.\n');
    await closeDatabase();
    return;
  }

  console.log(`⚠️  Found ${missingSignatures.length} missing transactions\n`);
  console.log(`📥 Starting backfill process...\n`);

  // Step 4: Backfill missing transactions
  let backfilled = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < missingSignatures.length; i++) {
    const sig = missingSignatures[i];
    
    if ((i + 1) % 10 === 0 || i === missingSignatures.length - 1) {
      console.log(`   Progress: ${i + 1}/${missingSignatures.length} (✅ ${backfilled} | ❌ ${failed} | ⏭️  ${skipped})`);
    }

    try {
      // Fetch full transaction
      const transaction = await connection.getTransaction(sig.signature, {
        maxSupportedTransactionVersion: 0,
        commitment: 'confirmed'
      });

      if (!transaction) {
        console.log(`   ⚠️  Transaction not found: ${sig.signature.substring(0, 20)}... (too old or pruned)`);
        skipped++;
        continue;
      }

      // Check if transaction errored
      if (transaction.meta?.err) {
        skipped++;
        continue;
      }

      // Format for webhook processor
      const webhookData = [{
        transaction: {
          signatures: [sig.signature]
        },
        meta: transaction.meta,
        blockTime: transaction.blockTime,
        slot: transaction.slot
      }];

      // Process transaction
      await processWebhook(webhookData);
      backfilled++;

      // Small delay to avoid overwhelming the system
      if (i % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

    } catch (error) {
      failed++;
      console.error(`   ❌ Failed to backfill ${sig.signature.substring(0, 20)}...: ${error.message}`);
    }
  }

  console.log(`\n✅ Backfill complete!\n`);
  console.log(`📊 Results:`);
  console.log(`   ✅ Successfully backfilled: ${backfilled}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   ⏭️  Skipped (errors/not found): ${skipped}`);
  console.log(`   📈 Total processed: ${backfilled + failed + skipped}\n`);

  // Step 5: Verify final count
  const finalCount = await new Promise((resolve, reject) => {
    db.get('SELECT COUNT(*) as count FROM game_actions', (err, row) => {
      if (err) reject(err);
      else resolve(row.count);
    });
  });

  console.log(`📊 Database now has ${finalCount} transactions (was ${existingCount})\n`);
  console.log(`💾 Added ${finalCount - existingCount} new transactions\n`);

  await closeDatabase();
}

// Run the backfill
backfillAllTransactions()
  .then(() => {
    console.log('🎉 Complete! Now run: node src/scripts/recalculate-stats.js');
    console.log('   This will recalculate all player stats based on the backfilled data.\n');
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('❌ Backfill failed:', error);
    await closeDatabase();
    process.exit(1);
  });