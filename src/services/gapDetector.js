// ============================================
// FILE: gapDetector.js
// Gap detection and backfilling service
// Ensures 100% transaction capture by checking for missed transactions
// ============================================

const { Connection, PublicKey } = require('@solana/web3.js');
const { processWebhook } = require('../controllers/webhookController');
const { getDatabase } = require('../config/database');

class GapDetector {
  constructor(rpcUrl, wsUrl, programId) {
    this.rpcUrl = rpcUrl;
    this.wsUrl = wsUrl;
    this.programId = new PublicKey(programId);
    this.connection = null;
    this.checkInterval = 10 * 60 * 1000; // 10 minutes
    this.intervalId = null;
    this.isRunning = false;
    
    // Stats
    this.stats = {
      totalChecks: 0,
      totalGapsFound: 0,
      totalBackfilled: 0,
      lastCheck: null
    };
  }

  /**
   * Start gap detection
   */
  async start() {
    if (this.isRunning) {
      console.log('⚠️  Gap detector is already running');
      return;
    }

    console.log('\n🔍 Starting gap detector...');
    console.log(`   Check interval: ${this.checkInterval / 1000} seconds`);

    this.connection = new Connection(this.rpcUrl, {
      commitment: 'confirmed',
      wsEndpoint: this.wsUrl
    });

    this.isRunning = true;

    // Run first check after 5 seconds
    setTimeout(() => this.checkForGaps(), 5000);

    // Then run periodic checks
    this.intervalId = setInterval(() => this.checkForGaps(), this.checkInterval);

    console.log('✅ Gap detector started');
  }

  /**
   * Check for transaction gaps
   */
  async checkForGaps() {
    try {
      this.stats.totalChecks++;
      this.stats.lastCheck = new Date().toISOString();

      console.log(`\n🔍 [GAP] Checking for missed transactions...`);

      // Get the most recent transaction signature from our database
      const latestDbTx = await this.getLatestDatabaseTransaction();
      
      if (!latestDbTx) {
        console.log('   ℹ️  [GAP] No transactions in database yet, fetching recent transactions...');
        await this.backfillRecentTransactions(10);
        return;
      }

      console.log(`   📊 [GAP] Latest DB transaction: ${latestDbTx.signature.substring(0, 20)}...`);
      console.log(`   🕒 [GAP] Timestamp: ${new Date(latestDbTx.timestamp * 1000).toISOString()}`);

      // Fetch recent signatures from the blockchain
      const signatures = await this.connection.getSignaturesForAddress(
        this.programId,
        { limit: 100 },
        'confirmed'
      );

      console.log(`   📡 [GAP] Fetched ${signatures.length} signatures from blockchain`);

      // Find signatures that are NOT in our database
      const missingSignatures = [];
      
      for (const sig of signatures) {
        const exists = await this.transactionExists(sig.signature);
        if (!exists) {
          missingSignatures.push(sig);
        }
      }

      if (missingSignatures.length === 0) {
        console.log('   ✅ [GAP] No gaps found - all transactions captured!');
        return;
      }

      console.log(`   ⚠️  [GAP] Found ${missingSignatures.length} missing transactions`);
      this.stats.totalGapsFound += missingSignatures.length;

      // Backfill missing transactions
      await this.backfillTransactions(missingSignatures);

    } catch (error) {
      console.error('❌ [GAP] Error checking for gaps:', error.message);
    }
  }

  /**
   * Get the latest transaction from database
   */
  async getLatestDatabaseTransaction() {
    return new Promise((resolve, reject) => {
      const db = getDatabase();
      const query = `
        SELECT tx_signature as signature, block_time as timestamp 
        FROM game_actions 
        ORDER BY block_time DESC 
        LIMIT 1
      `;

      db.get(query, [], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row || null);
        }
      });
    });
  }

  /**
   * Check if transaction exists in database
   */
  async transactionExists(signature) {
    return new Promise((resolve, reject) => {
      const db = getDatabase();
      db.get(
        'SELECT tx_signature FROM game_actions WHERE tx_signature = ?',
        [signature],
        (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve(!!row);
          }
        }
      );
    });
  }

  /**
   * Backfill missing transactions
   */
  async backfillTransactions(signatures) {
    console.log(`   🔄 [GAP] Backfilling ${signatures.length} transactions...`);

    let backfilled = 0;
    let failed = 0;

    for (const sig of signatures) {
      try {
        console.log(`   📥 [GAP] Fetching: ${sig.signature.substring(0, 20)}...`);

        // Fetch full transaction
        const transaction = await this.connection.getTransaction(sig.signature, {
          maxSupportedTransactionVersion: 0,
          commitment: 'confirmed'
        });

        if (!transaction) {
          console.log(`   ⚠️  [GAP] Transaction not found: ${sig.signature.substring(0, 20)}...`);
          failed++;
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
        console.log(`   ✅ [GAP] Backfilled: ${sig.signature.substring(0, 20)}...`);

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        failed++;
        console.error(`   ❌ [GAP] Failed to backfill ${sig.signature.substring(0, 20)}...: ${error.message}`);
      }
    }

    this.stats.totalBackfilled += backfilled;

    console.log(`   📊 [GAP] Backfill complete:`);
    console.log(`      ✅ Success: ${backfilled}`);
    console.log(`      ❌ Failed: ${failed}`);
  }

  /**
   * Backfill recent transactions (for initial setup)
   */
  async backfillRecentTransactions(limit = 10) {
    try {
      console.log(`   🔄 [GAP] Fetching last ${limit} transactions...`);

      const signatures = await this.connection.getSignaturesForAddress(
        this.programId,
        { limit },
        'confirmed'
      );

      console.log(`   📡 [GAP] Found ${signatures.length} recent transactions`);

      await this.backfillTransactions(signatures);
    } catch (error) {
      console.error('   ❌ [GAP] Error backfilling recent transactions:', error.message);
    }
  }

  /**
   * Manually trigger gap check (exposed via API)
   */
  async triggerCheck() {
    if (!this.isRunning) {
      throw new Error('Gap detector is not running');
    }

    console.log('🔍 [GAP] Manual gap check triggered');
    await this.checkForGaps();
    return this.getStats();
  }

  /**
   * Get gap detection stats
   */
  getStats() {
    return {
      isRunning: this.isRunning,
      checkInterval: `${this.checkInterval / 1000} seconds`,
      totalChecks: this.stats.totalChecks,
      totalGapsFound: this.stats.totalGapsFound,
      totalBackfilled: this.stats.totalBackfilled,
      lastCheck: this.stats.lastCheck
    };
  }

  /**
   * Stop gap detector
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('✅ Gap detector stopped');
  }
}

module.exports = GapDetector;