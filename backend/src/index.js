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
const PORT = process.env.PORT || 5000;

const localDefaultOrigins = ['http://localhost:3000', 'http://127.0.0.1:3000'];
const envOrigins = [process.env.FRONTEND_URL || '', process.env.FRONTEND_URLS || '']
  .join(',')
  .split(',')
  .map((origin) => origin.trim().replace(/\/+$/, ''))
  .filter(Boolean);
const allowedOrigins = new Set(envOrigins.length > 0 ? envOrigins : localDefaultOrigins);

if (
  process.env.NODE_ENV === 'production' &&
  (!process.env.JWT_SECRET || process.env.JWT_SECRET.includes('change') || process.env.JWT_SECRET.length < 32)
) {
  throw new Error('Unsafe JWT_SECRET for production. Set a strong random value (>= 32 chars).');
}

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    // Allow server-to-server or curl-like requests without Origin header.
    if (!origin) return callback(null, true);
    const normalizedOrigin = origin.replace(/\/+$/, '');
    if (allowedOrigins.has(normalizedOrigin)) return callback(null, true);
    if (/^https:\/\/[-a-zA-Z0-9]+\.vercel\.app$/.test(normalizedOrigin)) return callback(null, true);
    return callback(new Error('CORS blocked: origin not allowed'));
  },
  credentials: true,
}));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/centres', centreRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/loans', loanRoutes);
app.use('/api/emis', emiRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/settings', settingsRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

app.listen(PORT, () => {
  console.log(`LoanFlow API running on port ${PORT}`);

  // Run once on boot so overdue status is corrected immediately.
  syncOverdueStatuses(prisma)
    .then((count) => {
      if (count > 0) console.log(`Overdue sync updated ${count} EMI records on startup`);
    })
    .catch((err) => console.error('Overdue sync failed on startup:', err.message));

  // Keep overdue statuses fresh even if no EMI pay/undo actions are triggered.
  setInterval(() => {
    syncOverdueStatuses(prisma)
      .then((count) => {
        if (count > 0) console.log(`Overdue sync updated ${count} EMI records`);
      })
      .catch((err) => console.error('Overdue sync failed:', err.message));
  }, 60 * 1000);
});

