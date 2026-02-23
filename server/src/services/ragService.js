import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import Chunk from '../models/Chunk.js';

// Configuration
const RAG_THRESHOLD = 0.65;
const RETRIEVE_TOP_K = 2;
const MAX_TOKENS = 500;

let embeddingsModel = null;
let chatModel = null;
let openaiClient = null;
let genAI = null;
let aiInitialized = false;
let currentProvider = null;

// ============================================
// INITIALIZATION
// ============================================

async function initializeAI() {
  if (aiInitialized) return;
  
  const provider = process.env.AI_PROVIDER || 'gemini';
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const openaiApiKey = process.env.OPENAI_API_KEY;
  
  if (!geminiApiKey && !openaiApiKey) {
    console.warn('⚠️ No AI API key configured');
    aiInitialized = true;
    return;
  }
  
  try {
    if (provider === 'gemini' && geminiApiKey) {
      await initGemini(geminiApiKey);
    } else if (provider === 'openai' && openaiApiKey) {
      await initOpenAI(openaiApiKey);
    } else if (geminiApiKey) {
      await initGemini(geminiApiKey);
    } else if (openaiApiKey) {
      await initOpenAI(openaiApiKey);
    }
    
    aiInitialized = true;
  } catch (error) {
    console.error('❌ AI initialization error:', error);
    aiInitialized = true;
  }
}

async function initGemini(apiKey) {
  genAI = new GoogleGenerativeAI(apiKey);
  
  embeddingsModel = {
    embedQuery: async (text) => {
      try {
        const model = genAI.getGenerativeModel({ model: 'gemini-embedding-001' });
        const result = await model.embedContent(text);
        return result.embedding?.values || [];
      } catch (error) {
        console.error('❌ Gemini embedding error:', error.message);
        return createPseudoEmbedding(text);
      }
    }
  };
  
  chatModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  currentProvider = 'gemini';
  console.log('✅ AI initialized: Gemini');
}

async function initOpenAI(apiKey) {
  openaiClient = new OpenAI({ apiKey });
  
  embeddingsModel = {
    embedQuery: async (text) => {
      try {
        const response = await openaiClient.embeddings.create({
          model: 'text-embedding-3-small',
          input: text
        });
        return response.data[0].embedding;
      } catch (error) {
        console.error('❌ OpenAI embedding error:', error.message);
        return createPseudoEmbedding(text);
      }
    }
  };
  
  chatModel = {
    generateContent: async (contents) => {
      const response = await openaiClient.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: contents[0]?.text || '' },
          { role: 'user', content: contents[1]?.text || '' }
        ],
        max_tokens: MAX_TOKENS,
        temperature: 0.7
      });
      
      return {
        response: {
          text: () => response.choices[0]?.message?.content || ''
        }
      };
    }
  };
  
  currentProvider = 'openai';
  console.log('✅ AI initialized: OpenAI');
}

// Pseudo embedding fallback
function createPseudoEmbedding(text) {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  const vector = [];
  let seed = Math.abs(hash);
  for (let i = 0; i < 768; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    vector.push((seed / 0x7fffffff) * 2 - 1);
  }
  return vector;
}

// ============================================
// MODEL GETTERS
// ============================================

async function getEmbeddingsModel() {
  if (!embeddingsModel) await initializeAI();
  return embeddingsModel;
}

async function getChatModel() {
  if (!chatModel) await initializeAI();
  return chatModel;
}

export async function generateEmbedding(text) {
  const model = await getEmbeddingsModel();
  return await model.embedQuery(text);
}

// ============================================
// SIMILARITY CALCULATION
// ============================================

function cosineSimilarity(vec1, vec2) {
  if (!vec1 || !vec2 || vec1.length !== vec2.length) return 0;
  
  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;
  
  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    norm1 += vec1[i] * vec1[i];
    norm2 += vec2[i] * vec2[i];
  }
  
  if (norm1 === 0 || norm2 === 0) return 0;
  return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
}

// ============================================
// CHUNK RETRIEVAL
// ============================================

export async function findRelevantChunks(question, topK = RETRIEVE_TOP_K) {
  try {
    const questionEmbedding = await generateEmbedding(question);
    
    if (!questionEmbedding.some(v => Math.abs(v) > 0.01)) {
      console.log('⚠️ Invalid embedding generated');
      return [];
    }
    
    const results = await Chunk.aggregate([
      {
        $vectorSearch: {
          index: 'embedding_vector_index',
          path: 'embedding',
          queryVector: questionEmbedding,
          numCandidates: topK * 4,
          limit: topK
        }
      },
      {
        $lookup: {
          from: 'documents',
          localField: 'documentId',
          foreignField: '_id',
          as: 'document'
        }
      },
      {
        $unwind: { path: '$document', preserveNullAndEmptyArrays: true }
      },
      {
        $project: {
          text: 1,
          sourceDocument: 1,
          pageNumber: 1,
          embedding: 1
        }
      }
    ]);
    
    // Calculate similarity scores
    const scoredResults = results.map(chunk => ({
      ...chunk,
      similarity: cosineSimilarity(questionEmbedding, chunk.embedding)
    }));
    
    // Sort by similarity
    return scoredResults.sort((a, b) => b.similarity - a.similarity);
    
  } catch (error) {
    console.log('⚠️ Vector search error:', error.message);
    return [];
  }
}

// ============================================
// MODE DETECTION
// ============================================

function detectMode(chunks) {
  if (!chunks || chunks.length === 0) {
    return { mode: 'GENERAL', maxSimilarity: 0 };
  }
  
  const maxSimilarity = Math.max(...chunks.map(c => c.similarity || 0));
  
  if (maxSimilarity >= RAG_THRESHOLD) {
    return { mode: 'RAG', maxSimilarity };
  } else {
    return { mode: 'GENERAL', maxSimilarity };
  }
}

// ============================================
// RAG MODE - Answer from documents
// ============================================

async function generateRAGAnswer(question, chunks) {
  const model = await getChatModel();
  
  // Build context from chunks
  const context = chunks
    .map((chunk, idx) => `[Document ${idx + 1}]: ${chunk.sourceDocument} (Page ${chunk.pageNumber})\n${chunk.text}`)
    .join('\n\n');
  
  const systemPrompt = `You are a corporate assistant. Answer questions using ONLY the provided document context.

Rules:
- Provide clear, concise answers from the documents
- Use bullet points when appropriate
- Always cite the source at the end in format: Source: <filename> - Page <number>
- If the context doesn't contain the answer, say "I don't have information about that in the provided documents."`;

  const userPrompt = `Context:\n${context}\n\nQuestion: ${question}\n\nAnswer:`;

  const result = await model.generateContent([
    { text: systemPrompt },
    { text: userPrompt }
  ]);
  
  const answer = result.response.text();
  
  // Extract citations
  const citations = chunks.map(chunk => ({
    source: chunk.sourceDocument,
    pageNumber: chunk.pageNumber
  }));
  
  return { answer, citations };
}

// ============================================
// GENERAL MODE - Normal AI answer
// ============================================

async function generateGeneralAnswer(question) {
  const model = await getChatModel();
  
  const systemPrompt = `You are a helpful AI assistant. Answer questions clearly and concisely. Use bullet points when appropriate. Be friendly and professional.`;

  const userPrompt = `Question: ${question}\n\nAnswer:`;

  const result = await model.generateContent([
    { text: systemPrompt },
    { text: userPrompt }
  ]);
  
  return { answer: result.response.text(), citations: [] };
}

// ============================================
// QUOTA ERROR HANDLING
// ============================================

async function handleQuotaError(originalQuestion, mode) {
  console.log('⚠️ Quota error detected');
  
  // Try to switch to secondary provider
  const geminiKey = process.env.GEMINI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  
  if (currentProvider === 'gemini' && openaiKey) {
    console.log('🔄 Switching to OpenAI...');
    await initOpenAI(openaiKey);
    
    // Retry with new provider
    if (mode === 'RAG') {
      const chunks = await findRelevantChunks(originalQuestion);
      const modeInfo = detectMode(chunks);
      if (modeInfo.mode === 'RAG') {
        return await generateRAGAnswer(originalQuestion, chunks);
      }
    }
    return await generateGeneralAnswer(originalQuestion);
  }
  
  if (currentProvider === 'openai' && geminiKey) {
    console.log('🔄 Switching to Gemini...');
    await initGemini(geminiKey);
    
    if (mode === 'RAG') {
      const chunks = await findRelevantChunks(originalQuestion);
      const modeInfo = detectMode(chunks);
      if (modeInfo.mode === 'RAG') {
        return await generateRAGAnswer(originalQuestion, chunks);
      }
    }
    return await generateGeneralAnswer(originalQuestion);
  }
  
  // No secondary provider - return clean error
  return {
    answer: "AI service temporarily unavailable. Please try again later.",
    citations: []
  };
}

// ============================================
// MAIN QUESTION HANDLER
// ============================================

export async function askQuestion(question, onChunk, onCitations, onError) {
  try {
    console.log('\n========== NEW QUESTION ==========');
    console.log(`Question: ${question}`);
    
    await initializeAI();
    
    // Check if AI is configured
    if (!currentProvider) {
      onChunk("Please configure GEMINI_API_KEY or OPENAI_API_KEY in server .env file.");
      return;
    }
    
    // Step 1: Find relevant chunks
    const chunks = await findRelevantChunks(question, RETRIEVE_TOP_K);
    
    // Step 2: Detect mode
    const { mode, maxSimilarity } = detectMode(chunks);
    console.log(`MODE: ${mode} (similarity: ${maxSimilarity.toFixed(3)}, threshold: ${RAG_THRESHOLD})`);
    
    // Step 3: Generate answer based on mode
    let result;
    
    if (mode === 'RAG') {
      console.log('📄 Using RAG mode - answering from documents');
      try {
        result = await generateRAGAnswer(question, chunks);
      } catch (quotaError) {
        if (quotaError.message?.includes('429') || quotaError.message?.includes('quota')) {
          result = await handleQuotaError(question, 'RAG');
        } else {
          throw quotaError;
        }
      }
    } else {
      console.log('💬 Using GENERAL mode - normal AI answer');
      try {
        result = await generateGeneralAnswer(question);
      } catch (quotaError) {
        if (quotaError.message?.includes('429') || quotaError.message?.includes('quota')) {
          result = await handleQuotaError(question, 'GENERAL');
        } else {
          throw quotaError;
        }
      }
    }
    
    // Step 4: Send response
    console.log(`Answer length: ${result.answer.length} chars`);
    if (result.citations.length > 0) {
      console.log('Citations:', result.citations.map(c => `${c.source} p.${c.pageNumber}`).join(', '));
    }
    
    onCitations(result.citations);
    onChunk(result.answer);
    
    console.log('========== DONE ==========\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    
    // Check if it's a quota error
    if (error.message?.includes('429') || error.message?.includes('quota')) {
      onChunk("AI service temporarily unavailable due to quota limits. Please try again in a few minutes.");
    } else {
      onError(error);
    }
  }
}
