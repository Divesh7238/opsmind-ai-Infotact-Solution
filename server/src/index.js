import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import expressSanitizer from 'express-sanitizer';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import chatRoutes from './routes/chat.js';
import documentRoutes from './routes/documents.js';
import dashboardRoutes from './routes/dashboard.js';
import { errorHandler } from './middleware/errorHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.CLIENT_URL 
    : ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// Body parsing with size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(expressSanitizer());

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '..', process.env.UPLOAD_PATH || './uploads');
if (!fs.existsSync(uploadDir)){
  fs.mkdirSync(uploadDir, { recursive: true });
}
app.use('/uploads', express.static(uploadDir));

// MongoDB Connection with fallback options
let isDBConnected = false;

const connectDB = async () => {
  const mongooseOptions = {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    connectTimeoutMS: 10000,
  };
  
  try {
    // Try primary connection
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    
    if (!mongoUri) {
      throw new Error('MONGODB_URI not configured');
    }
    
    const conn = await mongoose.connect(mongoUri, mongooseOptions);
    isDBConnected = true;
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`MongoDB Error: ${error.message}`);
    
    // Try alternative connection (from env or hardcoded fallback)
    try {
      const altUri = process.env.MONGODB_URI_ALT || 
        process.env.MONGO_URI ||
        'mongodb://localhost:27017/opsmind';
      console.log(`Trying fallback URI: ${altUri.substring(0, 30)}...`);
      const conn2 = await mongoose.connect(altUri, mongooseOptions);
      isDBConnected = true;
      console.log(`MongoDB Connected (alt): ${conn2.connection.host}`);
      return conn2;
    } catch (error2) {
      console.error(`MongoDB Alt Error: ${error2.message}`);
      console.warn('⚠️ Running without database connection - App will work in DEMO mode');
      console.warn('To enable full functionality, configure MONGODB_URI in server/.env');
      isDBConnected = false;
      return null;
    }
  }
};

// Middleware to check DB connection
export const requireDB = (req, res, next) => {
  if (!isDBConnected) {
    return res.status(503).json({ 
      error: 'Database not available',
      demo: true,
      message: 'Running in demo mode. Please configure MongoDB for full functionality.'
    });
  }
  next();
};

export { isDBConnected };

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
const startServer = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
};

startServer();

export default app;
