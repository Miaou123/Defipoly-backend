// ============================================
// FILE: server.js
// Defipoly Backend - Modular Architecture
// ============================================

const express = require('express');
const cors = require('cors');
const { initDatabase, closeDatabase } = require('./src/config/database');
const routes = require('./src/routes');
const errorHandler = require('./src/middleware/errorHandler');

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
    features: ['profiles', 'actions', 'cooldowns', 'stats', 'leaderboard']
  });
});

// Mount API routes
app.use('/api', routes);

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Initialize database and start server
async function startServer() {
  try {
    await initDatabase();
    
    app.listen(PORT, () => {
      console.log(`🚀 Defipoly API v2.0 running on port ${PORT}`);
      console.log(`📊 Database: SQLite (defipoly.db)`);
      console.log(`✅ Profile storage enabled`);
      console.log(`✅ Game actions tracking enabled`);
      console.log(`✅ Cooldown system enabled`);
      console.log(`✅ Player stats & leaderboard enabled`);
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
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Graceful shutdown initiated...');
  await closeDatabase();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Graceful shutdown initiated...');
  await closeDatabase();
  process.exit(0);
});

// Start the server
startServer();