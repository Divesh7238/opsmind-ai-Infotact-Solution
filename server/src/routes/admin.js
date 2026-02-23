import express from 'express';
import jwt from 'jsonwebtoken';

const router = express.Router();

// Hardcoded admin credentials - no database
// Configure these in .env file
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@opsmind.ai';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// @route   POST /api/admin/login
// @desc    Admin login with hardcoded credentials
// @access  Public
router.post('/login', (req, res) => {
  const { email, password } = req.body;

  // Validate input
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  // Check credentials against hardcoded values
  if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
    // Generate JWT token
    const token = jwt.sign(
      { id: 'admin', role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );

    return res.json({
      token,
      user: {
        id: 'admin',
        email: ADMIN_EMAIL,
        role: 'admin',
        name: 'Administrator'
      }
    });
  }

  // Invalid credentials
  return res.status(401).json({ error: 'Invalid credentials' });
});

export default router;
