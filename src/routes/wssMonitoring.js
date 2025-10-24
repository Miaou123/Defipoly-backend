// ============================================
// FILE: wssMonitoring.js
// API routes for monitoring WSS connection and gap detection
// ============================================

const express = require('express');
const router = express.Router();

// These will be set by server.js when initializing
let wssListener = null;
let gapDetector = null;

/**
 * Initialize monitoring routes with WSS instances
 */
function initMonitoring(wss, gap) {
  wssListener = wss;
  gapDetector = gap;
}

/**
 * GET /api/wss/status
 * Get current WSS connection status and basic stats
 */
router.get('/status', (req, res) => {
  try {
    if (!wssListener) {
      return res.status(503).json({
        status: '❌ Not Initialized',
        message: 'WSS listener has not been initialized'
      });
    }

    const stats = wssListener.getStats();
    const healthy = stats.connected && 
                    stats.transactions.received === 0 || 
                    parseFloat(stats.transactions.successRate) >= 95;

    res.json({
      status: healthy ? '✅ Healthy' : '⚠️ Degraded',
      connection: {
        connected: stats.connected,
        uptime: stats.uptime,
        reconnections: stats.reconnections
      },
      transactions: stats.transactions,
      healthy
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get WSS status',
      message: error.message
    });
  }
});

/**
 * GET /api/wss/stats
 * Get detailed stats for both WSS and gap detection
 */
router.get('/stats', (req, res) => {
  try {
    if (!wssListener || !gapDetector) {
      return res.status(503).json({
        error: 'WSS or Gap Detector not initialized'
      });
    }

    const wssStats = wssListener.getStats();
    const gapStats = gapDetector.getStats();

    res.json({
      wss: {
        connected: wssStats.connected,
        uptime: wssStats.uptime,
        received: wssStats.transactions.received,
        processed: wssStats.transactions.processed,
        failed: wssStats.transactions.failed,
        successRate: wssStats.transactions.successRate,
        reconnections: wssStats.reconnections
      },
      gapDetection: {
        isRunning: gapStats.isRunning,
        checkInterval: gapStats.checkInterval,
        totalChecks: gapStats.totalChecks,
        totalGapsFound: gapStats.totalGapsFound,
        totalBackfilled: gapStats.totalBackfilled,
        lastCheck: gapStats.lastCheck
      },
      overall: {
        healthy: wssStats.connected && 
                 (wssStats.transactions.received === 0 || 
                  parseFloat(wssStats.transactions.successRate) >= 95),
        totalTransactions: wssStats.transactions.processed + gapStats.totalBackfilled,
        reliability: wssStats.transactions.received > 0
          ? wssStats.transactions.successRate
          : '100%'
      }
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get stats',
      message: error.message
    });
  }
});

/**
 * POST /api/wss/check-gaps
 * Manually trigger a gap detection check
 */
router.post('/check-gaps', async (req, res) => {
  try {
    if (!gapDetector) {
      return res.status(503).json({
        error: 'Gap detector not initialized'
      });
    }

    console.log('📡 Manual gap check requested via API');
    const stats = await gapDetector.triggerCheck();

    res.json({
      message: 'Gap check completed',
      stats
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to run gap check',
      message: error.message
    });
  }
});

/**
 * GET /api/wss/health
 * Simple health check endpoint
 */
router.get('/health', (req, res) => {
  try {
    if (!wssListener) {
      return res.status(503).json({ healthy: false, reason: 'Not initialized' });
    }

    const stats = wssListener.getStats();
    const healthy = stats.connected;

    res.json({
      healthy,
      connected: stats.connected,
      uptime: stats.uptime
    });
  } catch (error) {
    res.status(500).json({
      healthy: false,
      error: error.message
    });
  }
});

module.exports = {
  router,
  initMonitoring
};