// ============================================
// FILE: server.js
// Defipoly Backend - WSS Version
// Upgraded from webhooks to WebSocket for 100% reliability
// ============================================

const express = require('express');
const cors = require('cors');
const { initDatabase, closeDatabase } = require('./src/config/database');
const routes = require('./src/routes');
const errorHandler = require('./src/middleware/errorHandler');
const WSSListener = require('./src/services/wssListener');
const GapDetector = require('./src/services/gapDetector');
const { router: wssMonitoringRouter, initMonitoring } = require('./src/routes/wssMonitoring');

require('dotenv').config();
const app = express();
const PORT = process.env.PORT || 3005;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health check endpoint (outside of /api)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: Date.now(),
    version: '2.0.0',
    mode: 'wss',
    features: ['profiles', 'actions', 'cooldowns', 'stats', 'leaderboard', 'wss', 'gap-detection']
  });
});

// Mount API routes
app.use('/api', routes);

// Mount WSS monitoring routes
app.use('/api/wss', wssMonitoringRouter);

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global WSS instances
let wssListener = null;
let gapDetector = null;

/**
 * Initialize WebSocket listener
 */
async function initializeWSS() {
  try {
    // Get configuration from environment
    const RPC_URL = process.env.RPC_URL;
    const PROGRAM_ID = process.env.PROGRAM_ID;
    
    if (!RPC_URL) {
      throw new Error('RPC_URL not set in .env file');
    }
    
    if (!PROGRAM_ID) {
      throw new Error('PROGRAM_ID not set in .env file');
    }

    // Derive WebSocket URL from RPC URL if not explicitly set
    let SOLANA_WS_URL = process.env.SOLANA_WS_URL;
    if (!SOLANA_WS_URL) {
      SOLANA_WS_URL = RPC_URL.replace('https://', 'wss://').replace('http://', 'ws://');
      console.log('ℹ️  SOLANA_WS_URL not set, auto-derived from RPC URL');
    }

    // Initialize WSS Listener
    wssListener = new WSSListener(RPC_URL, SOLANA_WS_URL, PROGRAM_ID);
    await wssListener.start();

    // Initialize Gap Detector
    gapDetector = new GapDetector(RPC_URL, SOLANA_WS_URL, PROGRAM_ID);
    await gapDetector.start();

    // Initialize monitoring routes with WSS instances
    initMonitoring(wssListener, gapDetector);

    console.log('✅ WSS and Gap Detection initialized successfully\n');
  } catch (error) {
    console.error('❌ Failed to initialize WSS:', error.message);
    console.error('Stack:', error.stack);
    throw error;
  }
}

/**
 * Initialize database and start server
 */
async function startServer() {
  try {
    // Initialize database
    await initDatabase();
    
    // Initialize WebSocket listener
    await initializeWSS();

    // Start Express server
    app.listen(PORT, () => {
      console.log(`🚀 Defipoly API v2.0 running on port ${PORT}`);
      console.log(`📊 Database: SQLite (defipoly.db)`);
      console.log(`✅ Profile storage enabled`);
      console.log(`✅ Game actions tracking enabled`);
      console.log(`✅ Cooldown system enabled`);
      console.log(`✅ Player stats & leaderboard enabled`);
      console.log(`🔌 WebSocket listener enabled`);
      console.log(`🔍 Gap detection enabled`);
      console.log(`\n📡 Available endpoints:`);
      console.log(`   GET  /health`);
      console.log(`   GET  /api/game/constants`);
      console.log(`   GET  /api/profile/:wallet`);
      console.log(`   POST /api/profile`);
      console.log(`   POST /api/profiles/batch`);
      console.log(`   GET  /api/cooldown/:wallet/:setId`);
      console.log(`   GET  /api/cooldown/:wallet`);
      console.log(`   GET  /api/steal-cooldown/:wallet/:propertyId`); 
      console.log(`   GET  /api/steal-cooldown/:wallet`); 
      console.log(`   GET  /api/stats/:wallet`);
      console.log(`   GET  /api/ownership/:wallet`);
      console.log(`   GET  /api/leaderboard`);
      console.log(`   GET  /api/actions/recent`);
      console.log(`   GET  /api/actions/player/:wallet`);
      console.log(`   GET  /api/actions/property/:propertyId`);
      console.log(`   POST /api/actions`);
      console.log(`   POST /api/actions/batch`);
      console.log(`\n🔌 WSS Monitoring endpoints:`);
      console.log(`   GET  /api/wss/status`);
      console.log(`   GET  /api/wss/stats`);
      console.log(`   GET  /api/wss/health`);
      console.log(`   POST /api/wss/check-gaps`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

/**
 * Graceful shutdown
 */
async function shutdown() {
  console.log('\n🛑 Graceful shutdown initiated...');
  
  // Stop WSS listener
  if (wssListener) {
    await wssListener.stop();
  }
  
  // Stop gap detector
  if (gapDetector) {
    gapDetector.stop();
  }
  
  // Close database
  await closeDatabase();
  
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Start the server
startServer();