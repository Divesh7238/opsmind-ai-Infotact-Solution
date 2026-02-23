# OpsMind AI - Enterprise Knowledge Assistant

A production-ready SaaS web application that answers questions from uploaded company documents using Retrieval Augmented Generation (RAG). Built with React, Node.js, Express, MongoDB, and LangChain.

## 🌟 Features

- **ChatGPT-like Interface**: Modern dark-themed chat UI with streaming responses
- **RAG Pipeline**: Automatic PDF parsing, text chunking, and embedding generation
- **Citation System**: Every answer includes document source and page number
- **Guardrails**: AI refuses to answer questions not found in documents
- **Role-Based Access**: Admin and Employee roles with different permissions
- **Document Management**: Upload, delete, and reprocess PDF documents
- **Chat History**: View, rename, and delete previous conversations
- **Analytics Dashboard**: Track documents, users, and usage statistics

## 🛠️ Tech Stack

### Frontend
- React 18 with Vite
- Tailwind CSS
- React Router
- Zustand (State Management)
- React Markdown + Syntax Highlighter
- Lucide React (Icons)

### Backend
- Node.js + Express
- MongoDB Atlas with Vector Search
- JWT Authentication
- Multer (File Upload)
- pdf-parse
- LangChain.js

### AI
- Google Gemini 1.5 Flash (Recommended)
- OR OpenAI GPT-4
- Semantic Search with Embeddings

## 📁 Project Structure

```
opsmind-ai/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/    # Reusable components
│   │   ├── pages/        # Page components
│   │   ├── services/     # API services
│   │   ├── store/       # Zustand store
│   │   └── App.jsx      # Main app component
│   └── package.json
│
├── server/                 # Node.js backend
│   ├── src/
│   │   ├── models/       # MongoDB models
│   │   ├── routes/      # API routes
│   │   ├── middleware/  # Auth & error handling
│   │   └── services/    # RAG & document processing
│   ├── uploads/         # Uploaded files
│   └── package.json
│
├── TODO.md
└── README.md
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- MongoDB Atlas Account
- Google AI Studio Account (for Gemini) OR OpenAI Account

### 1. Clone & Setup

```
bash
# Navigate to project directory
cd opsmind-ai

# Install backend dependencies
cd server
npm install

# Install frontend dependencies
cd ../client
npm install
```

### 2. Environment Variables

Create `.env` file in `server/` directory:

```
env
# Server Configuration
PORT=5000
NODE_ENV=development

# MongoDB Atlas Connection
MONGODB_URI=your-mongodb-atlas-connection-string

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_EXPIRE=7d

# AI Provider (gemini or openai)
AI_PROVIDER=gemini

# Gemini Configuration (Recommended)
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-1.5-flash
EMBEDDING_MODEL=gemini-embedding-001

# OR OpenAI Configuration
# OPENAI_API_KEY=your-openai-api-key
# OPENAI_MODEL=gpt-4o-mini

# File Upload
MAX_FILE_SIZE=52428800
UPLOAD_PATH=./uploads

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### 3. Get API Keys

**Google Gemini (Recommended - Free):**
1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Create a new API key
3. Copy to `.env`

**OR OpenAI:**
1. Go to [OpenAI Platform](https://platform.openai.com/api-keys)
2. Create a new API key
3. Copy to `.env`

**MongoDB Atlas:**
1. Create account at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a new cluster (free tier)
3. Create database user
4. Get connection string
5. Replace password in connection string

### 4. Run the Application

```
bash
# Terminal 1 - Backend
cd server
npm run dev

# Terminal 2 - Frontend
cd client
npm run dev
```

### 5. Access the Application

- Frontend: http://localhost:5173
- Backend API: http://localhost:5000/api

## 👤 Default Admin Account

After first run, create an admin account via signup with role "admin".

## 📖 Usage Guide

### For Admins:
1. Login with admin account
2. Go to "Knowledge Base" in sidebar
3. Upload PDF documents
4. Wait for processing (status changes to "completed")
5. Documents are now searchable by all employees

### For Employees:
1. Login with employee account
2. Go to "Chat" page
3. Ask questions about company documents
4. AI will respond with citations
5. If answer not found in documents, AI will say "I don't know"

## 🔧 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user

### Chat
- `POST /api/chat/ask` - Ask a question (streaming)
- `GET /api/chat/history` - Get user's chat history
- `GET /api/chat/:id` - Get specific chat
- `DELETE /api/chat/:id` - Delete chat
- `PUT /api/chat/:id/rename` - Rename chat

### Documents (Admin)
- `POST /api/documents/upload` - Upload document
- `GET /api/documents` - List all documents
- `DELETE /api/documents/:id` - Delete document
- `POST /api/documents/:id/reprocess` - Reprocess document

### Dashboard
- `GET /api/dashboard/stats` - Get statistics

## 🔐 Security Features

- JWT Authentication
- Password hashing with bcrypt
- Rate limiting
- Input sanitization
- Helmet security headers
- CORS configuration
- Role-based access control

## 📝 License

MIT License

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
