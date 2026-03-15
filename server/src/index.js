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

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 5000;
const isHostedEnvironment = Boolean(
  process.env.RENDER ||
  process.env.RAILWAY_ENVIRONMENT ||
  process.env.KOYEB_APP_NAME ||
  process.env.FLY_APP_NAME ||
  process.env.NODE_ENV === 'production'
);
const configuredOrigins = [
  process.env.CLIENT_URL,
  process.env.CLIENT_URLS,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://opsmind-ai-divesh.onrender.com',
].flatMap((value) => {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
});

const allowRenderPreviewOrigin = (origin) => /^https:\/\/[a-z0-9-]+\.onrender\.com$/i.test(origin);
const allowLocalDevOrigin = (origin) => /^http:\/\/(localhost|127\.0\.0\.1):\d+$/i.test(origin);
const corsOriginHandler = (origin, callback) => {
  if (!origin) {
    callback(null, true);
    return;
  }

  if (
    configuredOrigins.includes(origin) ||
    allowLocalDevOrigin(origin) ||
    (isHostedEnvironment && allowRenderPreviewOrigin(origin))
  ) {
    callback(null, true);
    return;
  }

  callback(new Error(`CORS blocked for origin: ${origin}`));
};

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
app.use(cors({
  origin: corsOriginHandler,
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
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
app.use('/uploads', express.static(uploadDir));

// MongoDB Connection with safe fallbacks
let isDBConnected = false;

const maskMongoUri = (uri) => {
  if (!uri) {
    return 'not set';
  }

  try {
    const parsed = new URL(uri);
    if (parsed.password) {
      parsed.password = '***';
    }
    return parsed.toString();
  } catch {
    return `${uri.slice(0, 24)}...`;
  }
};

const getMongoCandidates = () => {
  const candidates = [
    { name: 'MONGODB_URI', value: process.env.MONGODB_URI },
    { name: 'MONGO_URI', value: process.env.MONGO_URI },
    { name: 'MONGODB_URI_ALT', value: process.env.MONGODB_URI_ALT },
  ];

  if (!isHostedEnvironment) {
    candidates.push({ name: 'local-dev-default', value: 'mongodb://localhost:27017/opsmind' });
  }

  return candidates.filter((candidate) => {
    if (typeof candidate.value !== 'string') {
      return false;
    }

    const trimmed = candidate.value.trim();
    if (!trimmed) {
      return false;
    }

    if (!trimmed.startsWith('mongodb://') && !trimmed.startsWith('mongodb+srv://')) {
      console.warn(`Skipping invalid MongoDB URI from ${candidate.name}. URI must start with mongodb:// or mongodb+srv://`);
      return false;
    }

    if (trimmed.startsWith('mongodb+srv://') && trimmed.includes('-shard-')) {
      console.warn(`Skipping invalid MongoDB URI from ${candidate.name}. mongodb+srv:// must use the cluster host, not a shard host.`);
      return false;
    }

    candidate.value = trimmed;
    return true;
  });
};

const connectDB = async () => {
  const mongooseOptions = {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    connectTimeoutMS: 10000,
  };

  const mongoCandidates = getMongoCandidates();

  if (mongoCandidates.length === 0) {
    console.error('MongoDB Error: no valid MongoDB URI configured');
    console.warn('Running without database connection - App will work in DEMO mode');
    console.warn('Set MONGODB_URI in the deployment environment for full functionality');
    isDBConnected = false;
    return null;
  }

  for (const candidate of mongoCandidates) {
    try {
      console.log(`Trying MongoDB connection using ${candidate.name}: ${maskMongoUri(candidate.value)}`);
      const conn = await mongoose.connect(candidate.value, mongooseOptions);
      isDBConnected = true;
      console.log(`MongoDB Connected: ${conn.connection.host}`);
      return conn;
    } catch (error) {
      console.error(`MongoDB Error (${candidate.name}): ${error.message}`);
    }
  }

  console.warn('Running without database connection - App will work in DEMO mode');
  console.warn('Set MONGODB_URI in the deployment environment for full functionality');
  isDBConnected = false;
  return null;
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
    console.log(`Environment: ${isHostedEnvironment ? 'production-like' : (process.env.NODE_ENV || 'development')}`);
  });
};

startServer();

export default app;
