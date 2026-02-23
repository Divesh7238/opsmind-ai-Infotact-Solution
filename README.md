# OpsMind AI

Enterprise Hybrid RAG + General AI Knowledge Assistant.

OpsMind AI is a production-ready corporate knowledge assistant that combines Retrieval-Augmented Generation (RAG) with general AI fallback.

It allows organizations to upload internal documents and ask context-aware questions while also answering general AI queries like ChatGPT.

---

## 🚀 Features

- Hybrid RAG + General AI Mode
- PDF/DOCX/TXT Document Upload
- MongoDB Atlas Vector Search
- Gemini / OpenAI Support
- JWT Authentication (Admin / Employee)
- Secure Admin Invite System
- Citation-based Answers
- Clean Tailwind UI
- Similarity Threshold Control
- Graceful API Quota Handling

---

## 🧠 Architecture

Frontend:
- React + Tailwind CSS

Backend:
- Node.js + Express
- MongoDB Atlas
- Vector Search
- Gemini / OpenAI

AI Flow:
1. Query → Embedding
2. Similarity Check
3. Mode Switch (RAG / General)
4. LLM Response
5. Citation Formatting (if RAG mode)

---

## 📦 Environment Variables (.env)

Create a `.env` file inside `server/`:
