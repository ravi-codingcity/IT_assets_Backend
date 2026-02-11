const app = require('./app');
const connectDB = require('./config/database');
const { PORT, NODE_ENV } = require('./config/environment');

// Start server after DB connection
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT} [${NODE_ENV}]`);
  });
});

// Handle errors
process.on('unhandledRejection', (err) => {
  console.error('❌', err.message);
  process.exit(1);
});
