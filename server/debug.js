import dotenv from 'dotenv';
dotenv.config();

console.log('1. Loading dependencies...');
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import expressSanitizer from 'express-sanitizer';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

console.log('2. Dependencies loaded');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('3. Loading routes...');
import authRoutes from './src/routes/auth.js';
import adminRoutes from './src/routes/admin.js';
import chatRoutes from './src/routes/chat.js';
import documentRoutes from './src/routes/documents.js';
import dashboardRoutes from './src/routes/dashboard.js';
import { errorHandler } from './src/middleware/errorHandler.js';

console.log('4. Routes loaded');

const app = express();
console.log('5. App created');

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
console.log('6. Helmet added');

app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.CLIENT_URL 
    : ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true
}));
console.log('7. CORS added');

const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);
console.log('8. Rate limiter added');

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(expressSanitizer());
console.log('9. Body parsers added');

const uploadDir = path.join(__dirname, '..', process.env.UPLOAD_PATH || './uploads');
if (!fs.existsSync(uploadDir)){
  fs.mkdirSync(uploadDir, { recursive: true });
}
app.use('/uploads', express.static(uploadDir));
console.log('10. Static files configured');

console.log('11. Connecting to MongoDB...');
console.log('   URI:', process.env.MONGODB_URI);

// Use MongoDB driver options to handle DNS
const mongooseOptions = {
  serverSelectionTimeoutMS: 30000,
  socketTimeoutMS: 45000,
};

try {
  const conn = await mongoose.connect(process.env.MONGODB_URI, mongooseOptions);
  console.log(`MongoDB Connected: ${conn.connection.host}`);
} catch (error) {
  console.error(`MongoDB Error: ${error.message}`);
  console.log('Attempting alternative connection...');
  
  // Try alternative connection with direct servers (use a single node first)
  try {
    const altUri = 'mongodb://opsmind:opsmind123@ac-cm8eecv-shard-00-02.cvid7ad.mongodb.net:27017/opsmind?authSource=admin';
    const conn2 = await mongoose.connect(altUri, mongooseOptions);
    console.log(`MongoDB Connected (alt): ${conn2.connection.host}`);
  } catch (error2) {
    console.error(`MongoDB Alt Error: ${error2.message}`);
  }
}

console.log('12. Registering routes...');
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/dashboard', dashboardRoutes);
console.log('13. Routes registered');

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use(errorHandler);
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

console.log('14. All done!');
