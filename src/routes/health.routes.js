const router = require('express').Router();
const mongoose = require('mongoose');

// Health check
router.get('/', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// Database health
router.get('/db', async (req, res) => {
  try {
    await mongoose.connection.db.admin().ping();
    res.json({ status: 'healthy', database: mongoose.connection.name });
  } catch (err) {
    res.status(503).json({ status: 'unhealthy', error: err.message });
  }
});

module.exports = router;
