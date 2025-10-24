// ============================================
// FILE: wssListener.js
// WebSocket listener for Solana transactions
// Replaces Helius webhooks with direct RPC connection
// ============================================

const { Connection, PublicKey } = require('@solana/web3.js');
const { processWebhook } = require('../controllers/webhookController');

class WSSListener {
  constructor(rpcUrl, wsUrl, programId) {
    this.rpcUrl = rpcUrl;
    this.wsUrl = wsUrl;
    this.programId = new PublicKey(programId);
    this.connection = null;
    this.subscriptionId = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 5000; // 5 seconds
    this.startTime = Date.now();
    
    // Stats tracking
    this.stats = {
      received: 0,
      processed: 0,
      failed: 0,
      reconnections: 0
    };
  }

  /**
   * Initialize WebSocket connection and start listening
   */
  async start() {
    try {
      console.log('\n🌐 Starting WebSocket listener...');
      console.log('📡 RPC URL:', this.rpcUrl);
      console.log('🔌 WS URL:', this.wsUrl);
      console.log('🎯 Program ID:', this.programId.toString());

      // Create connection
      this.connection = new Connection(this.rpcUrl, {
        commitment: 'confirmed',
        wsEndpoint: this.wsUrl
      });

      // Test connection
      const version = await this.connection.getVersion();
      console.log(`✅ Connected to Solana node (version: ${version['solana-core']})`);

      // Subscribe to program account changes
      await this.subscribe();
      
      this.isConnected = true;
      this.reconnectAttempts = 0;

      // Set up connection monitoring
      this.setupConnectionMonitoring();

      console.log('✅ WebSocket listener started successfully!\n');
    } catch (error) {
      console.error('❌ Failed to start WebSocket listener:', error);
      await this.handleConnectionError(error);
    }
  }

  /**
   * Subscribe to program logs
   */
  async subscribe() {
    try {
      console.log(`👂 Listening for transactions on program: ${this.programId.toString()}`);

      this.subscriptionId = this.connection.onLogs(
        this.programId,
        async (logs, context) => {
          await this.handleTransaction(logs, context);
        },
        'confirmed'
      );

      console.log(`📊 Subscription ID: ${this.subscriptionId}`);
    } catch (error) {
      console.error('❌ Failed to subscribe:', error);
      throw error;
    }
  }

  /**
   * Handle incoming transaction
   */
  async handleTransaction(logs, context) {
    try {
      const signature = logs.signature;
      const slot = context.slot;

      this.stats.received++;
      console.log(`\n🔔 [WSS] Transaction detected: ${signature}`);
      console.log(`   Slot: ${slot}`);

      // Fetch full transaction data with retry logic
      console.log('   📥 [WSS] Fetching full transaction data...');
      
      let transaction = null;
      const maxRetries = 5;
      const retryDelays = [500, 1000, 2000, 3000, 5000]; // Progressive delays
      
      for (let i = 0; i < maxRetries; i++) {
        try {
          transaction = await this.connection.getTransaction(signature, {
            maxSupportedTransactionVersion: 0,
            commitment: 'confirmed'
          });
          
          if (transaction) {
            console.log(`   ✅ [WSS] Transaction fetched successfully${i > 0 ? ` (retry ${i})` : ''}`);
            break;
          }
          
          // Wait before retry
          if (i < maxRetries - 1) {
            console.log(`   ⏳ [WSS] Transaction not ready, waiting ${retryDelays[i]}ms before retry ${i + 1}...`);
            await new Promise(resolve => setTimeout(resolve, retryDelays[i]));
          }
        } catch (error) {
          console.log(`   ⚠️  [WSS] Error fetching transaction (attempt ${i + 1}): ${error.message}`);
          if (i < maxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, retryDelays[i]));
          }
        }
      }

      if (!transaction) {
        console.log(`   ❌ [WSS] Could not fetch transaction after ${maxRetries} attempts`);
        console.log(`   💡 [WSS] This transaction will be caught by gap detector on next check`);
        this.stats.failed++;
        return;
      }

      await this.processTransaction(transaction, signature);
    } catch (error) {
      this.stats.failed++;
      console.error('   ❌ [WSS] Error handling transaction:', error.message);
    }
  }

  /**
   * Process transaction using existing webhook controller
   */
  async processTransaction(transaction, signature) {
    try {
      console.log('   💾 [WSS] Storing transaction...');

      // Format transaction data to match webhook format
      const webhookData = [{
        transaction: {
          signatures: [signature]
        },
        meta: transaction.meta,
        blockTime: transaction.blockTime,
        slot: transaction.slot
      }];

      // Use existing webhook processing logic
      await processWebhook(webhookData);

      this.stats.processed++;
      console.log('   ✅ [WSS] Successfully processed transaction');
    } catch (error) {
      this.stats.failed++;
      console.error('   ❌ [WSS] Error processing transaction:', error.message);
      throw error;
    }
  }

  /**
   * Setup connection monitoring and auto-reconnect
   */
  setupConnectionMonitoring() {
    // Monitor connection every 30 seconds
    this.monitoringInterval = setInterval(async () => {
      if (!this.isConnected) {
        console.log('🔄 Connection lost, attempting to reconnect...');
        await this.reconnect();
      }
    }, 30000);

    // Listen for WebSocket errors
    if (this.connection._rpcWebSocket) {
      this.connection._rpcWebSocket.on('error', (error) => {
        console.error('❌ WebSocket error:', error.message);
        this.isConnected = false;
      });

      this.connection._rpcWebSocket.on('close', () => {
        console.log('🔌 WebSocket connection closed');
        this.isConnected = false;
      });
    }
  }

  /**
   * Handle connection error and attempt reconnect
   */
  async handleConnectionError(error) {
    console.error('Connection error:', error.message);
    this.isConnected = false;
    
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      await this.reconnect();
    } else {
      console.error('❌ Max reconnection attempts reached. Manual intervention required.');
    }
  }

  /**
   * Reconnect to WebSocket
   */
  async reconnect() {
    this.reconnectAttempts++;
    this.stats.reconnections++;
    
    console.log(`🔄 Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}...`);
    console.log(`   Waiting ${this.reconnectDelay / 1000} seconds...`);
    
    await new Promise(resolve => setTimeout(resolve, this.reconnectDelay));

    // Unsubscribe from old connection if it exists
    if (this.subscriptionId) {
      try {
        await this.connection.removeOnLogsListener(this.subscriptionId);
      } catch (error) {
        // Ignore errors during cleanup
      }
    }

    // Attempt to restart
    await this.start();
  }

  /**
   * Get listener stats
   */
  getStats() {
    const uptime = Date.now() - this.startTime;
    const uptimeMinutes = Math.floor(uptime / 60000);
    const uptimeSeconds = Math.floor((uptime % 60000) / 1000);

    return {
      connected: this.isConnected,
      uptime: `${uptimeMinutes} minutes ${uptimeSeconds} seconds`,
      uptimeMs: uptime,
      transactions: {
        received: this.stats.received,
        processed: this.stats.processed,
        failed: this.stats.failed,
        successRate: this.stats.received > 0 
          ? ((this.stats.processed / this.stats.received) * 100).toFixed(2) + '%'
          : '100.00%'
      },
      reconnections: this.stats.reconnections
    };
  }

  /**
   * Stop the listener
   */
  async stop() {
    console.log('\n🛑 Stopping WebSocket listener...');
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    if (this.subscriptionId) {
      try {
        await this.connection.removeOnLogsListener(this.subscriptionId);
        console.log('✅ Unsubscribed from program logs');
      } catch (error) {
        console.error('Error unsubscribing:', error);
      }
    }

    this.isConnected = false;
    console.log('✅ WebSocket listener stopped');
  }
}

module.exports = WSSListener;