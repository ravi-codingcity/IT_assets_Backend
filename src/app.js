const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { API_PREFIX, NODE_ENV } = require('./config/environment');

const app = express();

// Middleware
app.use(helmet());

// Permissive CORS for development - allows all origins
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: false
}));

app.use(morgan(NODE_ENV === 'development' ? 'dev' : 'combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use(`${API_PREFIX}/auth`, require('./routes/auth.routes'));
app.use(`${API_PREFIX}/assets`, require('./routes/asset.routes'));
app.use(`${API_PREFIX}/health`, require('./routes/health.routes'));

// Root
app.get('/', (req, res) => res.json({ message: 'IT Asset Management API', version: '1.0.0' }));

// Error handling
app.use(require('./middleware/notFound'));
app.use(require('./middleware/errorHandler'));

module.exports = app;
