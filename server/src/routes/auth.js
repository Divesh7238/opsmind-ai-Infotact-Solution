import express from 'express';
import User from '../models/User.js';
import { protect, generateToken, authorize } from '../middleware/auth.js';
import { isDBConnected, requireDB } from '../index.js';

const router = express.Router();

// @route   POST /api/auth/register
// @desc    Register a new user (Public - Employee only)
// @access  Public
router.post('/register', async (req, res) => {
  // Check if database is available
  if (!isDBConnected) {
    return res.status(503).json({ 
      error: 'Registration unavailable',
      demo: true,
      message: 'Database not connected. Please configure MONGODB_URI in server/.env for full functionality.'
    });
  }
  
  try {
    const { name, email, password } = req.body;

    // SECURITY: Never accept role from public registration
    // Role is always forced to 'employee'

    // Validate input
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    // Check if user exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Validate password strength
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Create user - ALWAYS as employee (never accept role from client)
    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      role: 'employee' // SECURITY: Force employee role
    });

    // Generate token
    const token = generateToken(user._id);

    res.status(201).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', async (req, res) => {
  // Allow demo login with hardcoded credentials (works with or without MongoDB)
  const { email, password } = req.body;
  
  // Demo admin login
  if (email === 'admin@opsmind.ai' && password === 'admin123') {
    return res.json({
      token: 'demo-token-admin',
      user: {
        id: 'demo-admin-id',
        name: 'Demo Admin',
        email: 'admin@opsmind.ai',
        role: 'admin'
      },
      demo: true
    });
  }
  
  // Demo employee login
  if (email === 'employee@opsmind.ai' && password === 'employee123') {
    return res.json({
      token: 'demo-token-employee',
      user: {
        id: 'demo-employee-id',
        name: 'Demo Employee',
        email: 'employee@opsmind.ai',
        role: 'employee'
      },
      demo: true
    });
  }
  
  // Try database login
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Please provide email and password' });
    }

    // Find user and include password
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({ error: 'Account is deactivated' });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    // Generate token with role
    const token = generateToken(user._id);

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
});

// @route   POST /api/auth/create-admin
// @desc    Create admin account using secure invite key
// @access  Private (Admin only with invite key)
router.post('/create-admin', protect, authorize('admin'), async (req, res) => {
  try {
    const { name, email, password, inviteKey } = req.body;

    // Validate required fields
    if (!name || !email || !password || !inviteKey) {
      return res.status(400).json({ error: 'Name, email, password, and invite key are required' });
    }

    // Verify the admin invite key from environment
    const adminInviteKey = process.env.ADMIN_INVITE_KEY;
    if (!adminInviteKey || inviteKey !== adminInviteKey) {
      return res.status(403).json({ error: 'Invalid invite key' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Validate password
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Create admin user
    const adminUser = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      role: 'admin'
    });

    res.status(201).json({
      message: 'Admin account created successfully',
      user: {
        id: adminUser._id,
        name: adminUser.name,
        email: adminUser.email,
        role: adminUser.role
      }
    });
  } catch (error) {
    console.error('Create admin error:', error);
    res.status(500).json({ error: 'Failed to create admin account' });
  }
});

// @route   POST /api/auth/invite-admin
// @desc    Admin creates another admin (no invite key needed for existing admins)
// @access  Private (Admin only)
router.post('/invite-admin', protect, authorize('admin'), async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Validate password
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Create admin user (existing admin can create new admins)
    const adminUser = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      role: 'admin'
    });

    res.status(201).json({
      message: 'Admin account created successfully',
      user: {
        id: adminUser._id,
        name: adminUser.name,
        email: adminUser.email,
        role: adminUser.role
      }
    });
  } catch (error) {
    console.error('Invite admin error:', error);
    res.status(500).json({ error: 'Failed to create admin account' });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// @route   PUT /api/auth/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', protect, async (req, res) => {
  try {
    const { name, email } = req.body;

    // SECURITY: Never allow role modification via profile update
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { name, email },
      { new: true, runValidators: true }
    );

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// @route   PUT /api/auth/password
// @desc    Update password
// @access  Private
router.put('/password', protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user.id).select('+password');

    // Check current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update password' });
  }
});

export default router;
