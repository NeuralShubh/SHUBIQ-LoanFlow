const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { authenticate, JWT_SECRET } = require('../middleware/auth');
const prisma = require('../lib/prisma');

const router = express.Router();
const LOGIN_WINDOW_MS = Number(process.env.LOGIN_WINDOW_MS || 15 * 60 * 1000);
const LOGIN_MAX_ATTEMPTS = Number(process.env.LOGIN_MAX_ATTEMPTS || 10);
const loginAttempts = new Map();

function getClientKey(req) {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = Array.isArray(forwarded) ? forwarded[0] : String(forwarded || req.ip || '');
  return ip.split(',')[0].trim() || 'unknown';
}

function checkLoginThrottle(req) {
  const key = getClientKey(req);
  const entry = loginAttempts.get(key);
  if (!entry) return { blocked: false, key };

  const elapsed = Date.now() - entry.firstTs;
  if (elapsed > LOGIN_WINDOW_MS) {
    loginAttempts.delete(key);
    return { blocked: false, key };
  }

  if (entry.count >= LOGIN_MAX_ATTEMPTS) {
    return { blocked: true, key, retryAfterSec: Math.ceil((LOGIN_WINDOW_MS - elapsed) / 1000) };
  }
  return { blocked: false, key };
}

function recordFailedLogin(key) {
  const now = Date.now();
  const entry = loginAttempts.get(key);
  if (!entry || now - entry.firstTs > LOGIN_WINDOW_MS) {
    loginAttempts.set(key, { firstTs: now, count: 1 });
    return;
  }
  entry.count += 1;
}

function clearLoginAttempts(key) {
  loginAttempts.delete(key);
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const throttle = checkLoginThrottle(req);
    if (throttle.blocked) {
      res.set('Retry-After', String(throttle.retryAfterSec || 60));
      return res.status(429).json({ error: 'Too many login attempts. Please try again later.' });
    }

    const { email, password } = req.body;
    if (!email || !password) {
      recordFailedLogin(throttle.key);
      return res.status(400).json({ error: 'Email and password required' });
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    const plainPassword = String(password);

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { branch: true },
    });

    if (!user || !user.isActive) {
      recordFailedLogin(throttle.key);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(plainPassword, user.password);
    if (!validPassword) {
      recordFailedLogin(throttle.key);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    clearLoginAttempts(throttle.key);
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        branch: user.branch,
        phone: user.phone,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  const { password, ...user } = req.user;
  res.json(user);
});

// PUT /api/auth/change-password
router.put('/change-password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Both passwords required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user || !user.isActive) {
      return res.status(404).json({ error: 'User not found' });
    }

    const valid = await bcrypt.compare(String(currentPassword), user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const hashed = await bcrypt.hash(String(newPassword), 10);
    await prisma.user.update({ where: { id: req.user.id }, data: { password: hashed } });
    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to change password' });
  }
});

module.exports = router;
