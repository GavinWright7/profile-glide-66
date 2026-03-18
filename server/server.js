if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const express = require('express');
const cors = require('cors');
const config = require('./config');
const db = require('./services/db');
const redis = require('./services/redis');

const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profile');
const sharingRoutes = require('./routes/sharing');
const interactionsRoutes = require('./routes/interactions');
const premiumRoutes = require('./routes/premium');
const socialModeRoutes = require('./routes/socialMode');

const app = express();

const PORT = Number(process.env.PORT) || 3001;
console.log(`[startup] PORT=${PORT} (process.env.PORT=${process.env.PORT || 'not set'})`);

const required = [
  'LINKEDIN_CLIENT_ID',
  'LINKEDIN_CLIENT_SECRET',
  'LINKEDIN_REDIRECT_URI',
  'JWT_SECRET',
  'DATABASE_URL',
  'REDIS_URL',
];

config.requireEnv(required);

// Log resolved config (excluding secrets) for debugging
const safeConfig = {
  PORT,
  NODE_ENV: process.env.NODE_ENV || 'development',
  LINKEDIN_REDIRECT_URI: config.LINKEDIN_REDIRECT_URI ? '(set)' : '(missing)',
  JWT_SECRET: config.JWT_SECRET ? '(set)' : '(missing)',
  DATABASE_URL: config.DATABASE_URL ? '(set)' : '(missing)',
  REDIS_URL: config.REDIS_URL
    ? (config.REDIS_URL.includes('localhost') ? 'localhost (⚠️ use Railway Redis URL in production)' : '(set)')
    : '(missing)',
};
console.log('[startup] config:', JSON.stringify(safeConfig, null, 2));

app.use(cors());
app.use(express.json());

app.get('/health', async (req, res) => {
  try {
    const dbOk = await db.healthCheck();
    const redisOk = await redis.redisHealthCheck();

    res.json({
      status: dbOk && redisOk ? 'ok' : 'degraded',
      service: 'airlinks-auth',
      database: dbOk ? 'ok' : 'error',
      redis: redisOk ? 'ok' : 'error',
      port: PORT
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      error: err.message
    });
  }
});

app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'airlinks-auth',
    health: '/health',
    linkedin: '/auth/linkedin/start'
  });
});

app.use('/auth', authRoutes);
app.use('/profile', profileRoutes);
app.use('/sharing', sharingRoutes);
app.use('/interactions', interactionsRoutes);
app.use('/premium', premiumRoutes);
app.use('/social-mode', socialModeRoutes);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});