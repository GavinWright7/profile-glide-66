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

const app = express();

const PORT = Number(process.env.PORT);
if (!PORT || PORT <= 0 || !Number.isInteger(PORT)) {
  console.error('FATAL: PORT environment variable must be set (Railway injects this automatically).');
  process.exit(1);
}

const required = [
  'LINKEDIN_CLIENT_ID',
  'LINKEDIN_CLIENT_SECRET',
  'LINKEDIN_REDIRECT_URI',
  'JWT_SECRET',
  'DATABASE_URL',
  'REDIS_URL',
];

config.requireEnv(required);

app.use(cors());
app.use(express.json());

app.get('/health', async (req, res) => {
  try {
    const dbOk = await db.healthCheck();
    const redisOk = await redis.redisHealthCheck();

    res.json({
      status: dbOk && redisOk ? 'ok' : 'degraded',
      service: 'profile-glide-auth',
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
    service: 'profile-glide-auth',
    health: '/health',
    linkedin: '/auth/linkedin/start'
  });
});

app.use('/auth', authRoutes);
app.use('/profile', profileRoutes);
app.use('/sharing', sharingRoutes);
app.use('/interactions', interactionsRoutes);
app.use('/premium', premiumRoutes);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on Railway port ${PORT}`);
});