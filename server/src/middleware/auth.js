import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import mongoose from 'mongoose';

// Use a fallback secret for demo mode if JWT_SECRET is not set
const getJWT_SECRET = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.warn('⚠️ WARNING: JWT_SECRET not configured. Using insecure fallback. Set JWT_SECRET in .env for production!');
    return 'demo-secret-key-fallback-minimum-32-chars';
  }
  if (secret.length < 32) {
    console.warn('⚠️ WARNING: JWT_SECRET is too short. Use at least 32 characters for security!');
  }
  return secret;
};

// Demo user IDs (valid MongoDB ObjectIds)
const DEMO_ADMIN_ID = new mongoose.Types.ObjectId('507f1f77bcf86cd799439011');
const DEMO_EMPLOYEE_ID = new mongoose.Types.ObjectId('507f1f77bcf86cd799439012');

export const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ error: 'Not authorized, no token provided' });
  }

  // Handle demo tokens
  if (token.startsWith('demo-token-')) {
    const role = token === 'demo-token-admin' ? 'admin' : 'employee';
    const _id = token === 'demo-token-admin' ? DEMO_ADMIN_ID : DEMO_EMPLOYEE_ID;
    
    // Create a demo user object - use proper MongoDB ObjectId
    req.user = {
      _id,
      id: _id.toString(),
      name: role === 'admin' ? 'Demo Admin' : 'Demo Employee',
      email: role === 'admin' ? 'admin@opsmind.ai' : 'employee@opsmind.ai',
      role,
      isActive: true,
      isDemo: true
    };
    return next();
  }

  try {
    const decoded = jwt.verify(token, getJWT_SECRET());
    req.user = await User.findById(decoded.id);
    
    if (!req.user) {
      return res.status(401).json({ error: 'Not authorized, user not found' });
    }
    
    if (!req.user.isActive) {
      return res.status(401).json({ error: 'Account is deactivated' });
    }
    
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Not authorized, token invalid' });
  }
};

export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: `Role '${req.user.role}' is not authorized to access this route` 
      });
    }
    next();
  };
};

export const generateToken = (id) => {
  return jwt.sign({ id }, getJWT_SECRET(), {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });
};
