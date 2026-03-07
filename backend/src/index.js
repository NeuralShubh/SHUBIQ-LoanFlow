require('dotenv').config();
const express = require('express');
const cors = require('cors');
const prisma = require('./lib/prisma');

const authRoutes = require('./routes/auth');
const branchRoutes = require('./routes/branches');
const centreRoutes = require('./routes/centres');
const memberRoutes = require('./routes/members');
const loanRoutes = require('./routes/loans');
const emiRoutes = require('./routes/emis');
const reportRoutes = require('./routes/reports');
const settingsRoutes = require('./routes/settings');
const dashboardRoutes = require('./routes/dashboard');
const { syncOverdueStatuses } = require('./services/overdueSync');

const app = express();
const PORT = Number(process.env.PORT || 5000);
const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PROD = NODE_ENV === 'production';
const DB_CONNECT_RETRIES = Number(process.env.DB_CONNECT_RETRIES || 5);
const DB_CONNECT_RETRY_DELAY_MS = Number(process.env.DB_CONNECT_RETRY_DELAY_MS || 5000);
const OVERDUE_SYNC_INTERVAL_MS = Number(process.env.OVERDUE_SYNC_INTERVAL_MS || 60 * 1000);

const localDefaultOrigins = ['http://localhost:3000', 'http://127.0.0.1:3000'];
const envOrigins = [process.env.FRONTEND_URL || '', process.env.FRONTEND_URLS || '']
  .join(',')
  .split(',')
  .map((origin) => origin.trim().replace(/\/+$/, ''))
  .filter(Boolean);
const allowedOrigins = new Set(envOrigins.length > 0 ? envOrigins : localDefaultOrigins);
const vercelOriginPattern = /^https:\/\/[-a-zA-Z0-9]+\.vercel\.app$/;
const localOriginPattern = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

if (
  IS_PROD &&
  (!process.env.JWT_SECRET || process.env.JWT_SECRET.includes('change') || process.env.JWT_SECRET.length < 32)
) {
  throw new Error('Unsafe JWT_SECRET for production. Set a strong random value (>= 32 chars).');
}
if (!Number.isFinite(PORT) || PORT <= 0) {
  throw new Error(`Invalid PORT value: ${process.env.PORT}`);
}
if (!Number.isFinite(OVERDUE_SYNC_INTERVAL_MS) || OVERDUE_SYNC_INTERVAL_MS < 10 * 1000) {
  throw new Error('OVERDUE_SYNC_INTERVAL_MS must be at least 10000 ms');
}

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (IS_PROD) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const normalizedOrigin = origin.replace(/\/+$/, '');
    if (allowedOrigins.has(normalizedOrigin)) return callback(null, true);
    if (vercelOriginPattern.test(normalizedOrigin)) return callback(null, true);
    if (!IS_PROD && localOriginPattern.test(normalizedOrigin)) return callback(null, true);

    console.warn(`CORS blocked origin: ${normalizedOrigin}`);
    return callback(null, false);
  },
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/centres', centreRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/loans', loanRoutes);
app.use('/api/emis', emiRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/settings', settingsRoutes);

app.get('/api/health', (req, res) => {
  const payload = {
    status: 'ok',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  };
  if (!IS_PROD) payload.env = NODE_ENV;
  res.json(payload);
});

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use((err, req, res, next) => {
  console.error(err.stack || err);
  const statusCode = err.statusCode && Number.isInteger(err.statusCode) ? err.statusCode : 500;
  const payload = { error: statusCode === 500 ? 'Internal server error' : (err.message || 'Request failed') };
  if (!IS_PROD && err.message) payload.message = err.message;
  res.status(statusCode).json(payload);
});

let server;
let overdueSyncTimer;
let overdueSyncInProgress = false;
let isShuttingDown = false;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const connectDatabaseWithRetry = async () => {
  for (let attempt = 1; attempt <= DB_CONNECT_RETRIES; attempt += 1) {
    try {
      await prisma.$connect();
      return;
    } catch (error) {
      const isLastAttempt = attempt === DB_CONNECT_RETRIES;
      console.error(`Database connection failed (attempt ${attempt}/${DB_CONNECT_RETRIES}):`, error.message);
      if (isLastAttempt) throw error;
      await sleep(DB_CONNECT_RETRY_DELAY_MS);
    }
  }
};

const runOverdueSync = async (reason = 'scheduled') => {
  if (overdueSyncInProgress || isShuttingDown) return;
  overdueSyncInProgress = true;
  try {
    const count = await syncOverdueStatuses(prisma);
    if (count > 0) console.log(`Overdue sync (${reason}) updated ${count} EMI records`);
  } catch (err) {
    console.error(`Overdue sync failed (${reason}):`, err.message);
  } finally {
    overdueSyncInProgress = false;
  }
};

const shutdown = async (signal, exitCode = 0) => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`Received ${signal}. Shutting down gracefully...`);

  if (overdueSyncTimer) clearInterval(overdueSyncTimer);

  if (server) {
    await new Promise((resolve) => {
      server.close(() => resolve());
    });
  }

  try {
    await prisma.$disconnect();
  } catch (error) {
    console.error('Error while disconnecting Prisma:', error.message);
  }

  process.exit(exitCode);
};

const startServer = async () => {
  await connectDatabaseWithRetry();

  server = app.listen(PORT, () => {
    console.log(`LoanFlow API running on port ${PORT}`);
    console.log(`Allowed CORS origins: ${Array.from(allowedOrigins).join(', ')}`);
  });

  await runOverdueSync('startup');
  overdueSyncTimer = setInterval(() => {
    runOverdueSync('interval');
  }, OVERDUE_SYNC_INTERVAL_MS);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
  shutdown('unhandledRejection', 1);
});
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  shutdown('uncaughtException', 1);
});

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
