
const express = require('express');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../utils/db');
const { loginLimiter, registerLimiter } = require('../middleware/rateLimit');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.post('/register', registerLimiter, [
  body('username').trim().isLength({ min: 3, max: 30 }),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { username, email, password } = req.body;

    if (await db.userExists(username) || await db.userExists(email)) {
      return res.status(400).json({
        success: false,
        message: 'Username or email already exists'
      });
    }

    const user = await db.createUser({ username, email, password });
    
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
      expiresIn: '7d'
    });

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      token,
      user: { id: user.id, username, email }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Registration failed'
    });
  }
});

router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password required'
      });
    }

    const user = await db.findUser(username);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
      const minutes = Math.ceil((new Date(user.lockedUntil) - Date.now()) / 60000);
      return res.status(423).json({
        success: false,
        message: `Account locked. Wait ${minutes} minutes`
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      await db.incrementFailedAttempts(user.id);
      const userUpdated = await db.findUserById(user.id);
      const attemptsLeft = 3 - userUpdated.failedAttempts;
      
      return res.status(401).json({
        success: false,
        message: attemptsLeft > 0 
          ? `Wrong password. ${attemptsLeft} attempts left`
          : 'Account locked for 15 minutes'
      });
    }

    await db.resetAttempts(user.id);

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
      expiresIn: '7d'
    });

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Login failed'
    });
  }
});
router.get('/profile', protect, async (req, res) => {
  const { password, ...userWithoutPassword } = req.user;
  res.json({
    success: true,
    user: userWithoutPassword
  });
});
router.get('/users', protect, async (req, res) => {
  if (req.user.username !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Admin only'
    });
  }
  
  res.json({
    success: true,
    users: db.db.data.users.map(({ password, ...user }) => user)
  });
});

module.exports = router;