const mongoose = require('mongoose');
const dns = require('dns');
const { MONGODB_URI } = require('./environment');

// Use Google DNS to help with SRV lookup issues
dns.setServers(['8.8.8.8', '8.8.4.4']);

module.exports = async () => {
  try {
    const conn = await mongoose.connect(MONGODB_URI, {
      family: 4  // Force IPv4
    });
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB Error: ${error.message}`);
    process.exit(1);
  }
};
