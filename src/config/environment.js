require('dotenv').config();

module.exports = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: process.env.PORT || 5000,
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/it_assets_db',
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:3000',
  API_PREFIX: process.env.API_PREFIX || '/api/v1'
};
