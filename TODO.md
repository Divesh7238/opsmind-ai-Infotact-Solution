# TODO: Fix Hybrid RAG System

## Problem Statement
The current RAG system has a serious flaw:
- When API quota is exceeded, it falls back to returning document chunks
- This causes incorrect answers for unrelated questions (e.g., "What is AI?" returns random PDF content)

## Required Fix Architecture

### 1. Mode Detection Logic
- Run vector search and get similarity scores
- If similarity >= 0.65 → RAG MODE
- If similarity < 0.65 → GENERAL MODE

### 2. RAG Mode
- Retrieve top 2 relevant chunks
- Generate answer using LLM
- Provide citation (filename + page number)
- Do NOT dump raw content
- Format cleanly

### 3. General Mode
- Do NOT use document content
- Call LLM normally (Gemini/OpenAI)
- Answer like ChatGPT
- Keep answers short and clear
- Do NOT provide document citation

### 4. Critical Fix - Quota Error Handling
- If API quota error occurs:
  - Do NOT fallback to document text
  - Do NOT return random PDF content
  - Return: "AI service temporarily unavailable. Please try again later."
  - OR automatically switch to secondary provider (if configured)

### 5. Remove Document Fallback Logic
- Fallback must NEVER return unrelated document content

### 6. Response Rules
- Small question → short answer
- General question → general answer  
- Document question → document answer with citation
- Never mix modes
- Never hallucinate document answers

### 7. Console Logging
- Log mode switching:
  - `MODE: RAG` or `MODE: GENERAL`

## Implementation Steps

1. Rewrite `server/src/services/ragService.js` with clean architecture
2. Implement proper mode detection
3. Remove all fallback-to-document logic
4. Add proper quota error handling
5. Test the changes

## Files to Modify
- `server/src/services/ragService.js` - Main RAG service (complete rewrite)
