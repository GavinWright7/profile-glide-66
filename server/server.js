if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const express = require('express');
const cors = require('cors');

const NODE_ENV = process.env.NODE_ENV || 'development';

/** Railway sets PORT; bind to it exactly — never a hardcoded production fallback. */
const rawPort = process.env.PORT;
if (!rawPort && NODE_ENV === 'production') {
  console.error('[startup] FATAL: process.env.PORT is required in production');
  process.exit(1);
}
const PORT = rawPort ? Number(rawPort) : 3001;
if (!Number.isFinite(PORT) || PORT <= 0) {
  console.error('[startup] FATAL: invalid PORT value:', rawPort);
  process.exit(1);
}

console.log(`[startup] PORT=${PORT} (process.env.PORT=${process.env.PORT ?? 'not set'})`);
console.log(`[startup] NODE_ENV=${NODE_ENV}`);

const app = express();
app.set('trust proxy', 1);

const corsOptions = {
  origin: true,
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-User-Id', 'X-Requested-With'],
  credentials: true,
  optionsSuccessStatus: 204,
  maxAge: 86400,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(express.json());

/** Liveness — respond immediately; never wait on Redis/DB (Railway health checks). */
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

const config = require('./config');
const db = require('./services/db');
const redis = require('./services/redis');

const envKeys = [
  'LINKEDIN_CLIENT_ID',
  'LINKEDIN_CLIENT_SECRET',
  'LINKEDIN_REDIRECT_URI',
  'JWT_SECRET',
  'DATABASE_URL',
  'REDIS_URL',
];
config.warnEnv(envKeys);

const safeConfig = {
  PORT,
  NODE_ENV,
  LINKEDIN_REDIRECT_URI: config.LINKEDIN_REDIRECT_URI ? '(set)' : '(missing)',
  JWT_SECRET: config.JWT_SECRET ? '(set)' : '(missing)',
  DATABASE_URL: config.DATABASE_URL ? '(set)' : '(missing)',
  REDIS_URL: config.REDIS_URL
    ? (config.REDIS_URL.includes('localhost') ? 'localhost (use Railway Redis URL in production)' : '(set)')
    : '(missing)',
};
console.log('[startup] config:', JSON.stringify(safeConfig, null, 2));

/** Readiness — optional deep check; not used for liveness. */
app.get('/health/ready', async (_req, res) => {
  try {
    const [dbOk, redisOk] = await Promise.all([
      db.healthCheck(),
      redis.redisHealthCheck(),
    ]);
    const ok = dbOk && redisOk;
    res.status(ok ? 200 : 503).json({
      status: ok ? 'ok' : 'degraded',
      service: 'airlinks-auth',
      database: dbOk ? 'ok' : 'error',
      redis: redisOk ? 'ok' : 'error',
      port: PORT,
    });
  } catch (err) {
    res.status(503).json({ status: 'error', error: err.message });
  }
});

app.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'airlinks-auth',
    health: '/health',
    linkedin: '/auth/linkedin/start',
  });
});

const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profile');
const sharingRoutes = require('./routes/sharing');
const interactionsRoutes = require('./routes/interactions');
const premiumRoutes = require('./routes/premium');
const savedProfilesRoutes = require('./routes/savedProfiles');
const debugRoutes = require('./routes/debug');

app.use('/auth', authRoutes);
app.use('/profile', profileRoutes);
app.use('/sharing', sharingRoutes);
app.use('/debug', debugRoutes);
app.use('/interactions', interactionsRoutes);
app.use('/premium', premiumRoutes);
app.use('/saved-profiles', savedProfilesRoutes);

app.use((err, _req, res, _next) => {
  console.error('[error]', err.message);
  if (res.headersSent) return;
  res.status(500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[startup] Server listening on http://0.0.0.0:${PORT}`);
});
