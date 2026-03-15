import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';
import Chunk from '../models/Chunk.js';
import Document from '../models/Document.js';

// Configuration
const RAG_THRESHOLD = 0.65;
const RETRIEVE_TOP_K = 2;
const MAX_TOKENS = 1000;
const EMBEDDING_MODEL = 'text-embedding-3-small';
const DOCUMENT_ONLY_NO_ANSWER = 'This information is not available in the uploaded HR policy document.';

let embeddingsModel = null;
let chatProviders = [];
let aiInitialized = false;

function normalizeApiKey(value) {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/^['"]|['"]$/g, '');
}

function isLikelyConfiguredApiKey(value, prefixes = []) {
  const key = normalizeApiKey(value);
  if (!key) return false;
  if (key.toLowerCase().includes('your-') || key.toLowerCase().includes('here')) return false;
  if (prefixes.length === 0) return true;
  return prefixes.some(prefix => key.startsWith(prefix));
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
  for (let i = 0; i < 1536; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    vector.push((seed / 0x7fffffff) * 2 - 1);
  }
  return vector;
}

// Provider factories - return async generateContent func
async function createGeminiProvider(apiKey) {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  return async (contents) => {
    const systemPrompt = contents[0]?.text || '';
    const userPrompt = contents[1]?.text || '';
    const fullPrompt = systemPrompt + '\n\n' + userPrompt;
    const result = await model.generateContent(fullPrompt);
    console.log('✅ AI Provider Used: Gemini');
    return {
      response: {
        text: () => result.response.text()
      }
    };
  };
}

async function createGroqProvider(apiKey) {
  const groq = new Groq({ apiKey });
  return async (contents) => {
    const messages = [
      { role: 'system', content: contents[0]?.text || '' },
      { role: 'user', content: contents[1]?.text || '' }
    ];
    const completion = await groq.chat.completions.create({
      messages,
      model: 'llama-3.1-8b-instant',
      max_tokens: MAX_TOKENS,
      temperature: 0.7
    });
    console.log('✅ AI Provider Used: Groq');
    return {
      response: {
        text: () => completion.choices[0].message.content
      }
    };
  };
}

async function createOpenAIProvider(apiKey) {
  const openai = new OpenAI({ apiKey });
  return async (contents) => {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: contents[0]?.text || '' },
        { role: 'user', content: contents[1]?.text || '' }
      ],
      max_tokens: MAX_TOKENS,
      temperature: 0.7
    });
    if (!response.choices?.[0]?.message?.content) {
      throw new Error('Invalid OpenAI response format');
    }
    console.log('✅ AI Provider Used: OpenAI');
    return {
      response: {
        text: () => response.choices[0].message.content
      }
    };
  };
}

// ============================================
 // INITIALIZATION
// ============================================

async function initializeAI() {
  if (aiInitialized) return;
  chatProviders = [];
  
  // Embeddings - OpenAI primary with pseudo fallback
  const openaiApiKey = normalizeApiKey(process.env.OPENAI_API_KEY);
  if (isLikelyConfiguredApiKey(openaiApiKey, ['sk-'])) {
    const openai = new OpenAI({ apiKey: openaiApiKey });
    embeddingsModel = {
      embedQuery: async (text) => {
        try {
          const response = await openai.embeddings.create({
            model: EMBEDDING_MODEL,
            input: text,
          });
          return response.data[0].embedding;
        } catch (error) {
          console.error('❌ OpenAI embedding error:', error.message);
          return createPseudoEmbedding(text);
        }
      }
    };
  } else {
    embeddingsModel = {
      embedQuery: async (text) => createPseudoEmbedding(text)
    };
  }

  const configuredProviders = [];
  const geminiApiKey = normalizeApiKey(process.env.GEMINI_API_KEY);
  const groqApiKey = normalizeApiKey(process.env.GROQ_API_KEY);

  if (isLikelyConfiguredApiKey(geminiApiKey, ['AIza'])) {
    configuredProviders.push({
      name: 'Gemini',
      create: () => createGeminiProvider(geminiApiKey)
    });
  }

  if (isLikelyConfiguredApiKey(groqApiKey, ['gsk_'])) {
    configuredProviders.push({
      name: 'Groq',
      create: () => createGroqProvider(groqApiKey)
    });
  }

  if (isLikelyConfiguredApiKey(openaiApiKey, ['sk-'])) {
    configuredProviders.push({
      name: 'OpenAI',
      create: () => createOpenAIProvider(openaiApiKey)
    });
  }

  const preferredProvider = normalizeApiKey(process.env.AI_PROVIDER).toLowerCase();
  if (preferredProvider) {
    configuredProviders.sort((a, b) => {
      const aRank = a.name.toLowerCase() === preferredProvider ? -1 : 0;
      const bRank = b.name.toLowerCase() === preferredProvider ? -1 : 0;
      return aRank - bRank;
    });
  }

  for (const providerConfig of configuredProviders) {
    try {
      chatProviders.push({
        name: providerConfig.name,
        generate: await providerConfig.create()
      });
    } catch (e) {
      console.warn(`${providerConfig.name} provider init failed:`, e.message);
    }
  }

  if (chatProviders.length === 0) {
    console.warn('No valid AI providers configured. Check GEMINI_API_KEY, GROQ_API_KEY, OPENAI_API_KEY in server/.env');
  } else {
    console.log(`AI initialized with ${chatProviders.length} providers: ${chatProviders.map(provider => provider.name).join(', ')}`);
  }

  aiInitialized = true;
}

// ============================================
// CHAT MODEL with fallback
// ============================================

async function getChatModel() {
  if (!aiInitialized) await initializeAI();
  return {
    generateContent: async (contents) => {
      if (chatProviders.length === 0) {
        throw new Error('No AI providers available. Please configure API keys in server/.env');
      }
      
      for (let i = 0; i < chatProviders.length; i++) {
        const provider = chatProviders[i];
        try {
          const result = await provider.generate(contents);
          return result;
        } catch (error) {
          console.warn(`${provider.name} provider failed:`, error.message);
          if (i === chatProviders.length - 1) {
            throw new Error('All AI providers failed. Please check your API keys and quotas.');
          }
        }
      }
    }
  };
}

// ... (rest of the file unchanged: getEmbeddingsModel, generateEmbedding, cosineSimilarity, findRelevantChunks, detectMode, generateRAGAnswer, generateGeneralAnswer, askQuestion)

async function getEmbeddingsModel() {
  if (!embeddingsModel) await initializeAI();
  return embeddingsModel;
}

export async function generateEmbedding(text) {
  const model = await getEmbeddingsModel();
  return await model.embedQuery(text);
}

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

function isDocumentOnlyQuestion(question) {
  const normalizedQuestion = question.toLowerCase();
  const documentOnlyPatterns = [
    /\bhr\b/,
    /\bpolicy\b/,
    /\bleave\b/,
    /\bvacation\b/,
    /\bpto\b/,
    /\battendance\b/,
    /\bpayroll\b/,
    /\bsalary\b/,
    /\bbenefits?\b/,
    /\bprobation\b/,
    /\bresignation\b/,
    /\btermination\b/,
    /\bholiday\b/,
    /\bwork from home\b/,
    /\bremote work\b/,
    /\bemployee\b/,
    /\bnotice period\b/,
    /\bgrievance\b/,
    /\bcode of conduct\b/,
    /\breimbursement\b/
  ];

  return documentOnlyPatterns.some(pattern => pattern.test(normalizedQuestion));
}

async function hasCompletedDocuments() {
  try {
    return Boolean(await Document.exists({ status: 'completed' }));
  } catch {
    return false;
  }
}

export async function findRelevantChunks(question, topK = RETRIEVE_TOP_K) {
  try {
    const questionEmbedding = await generateEmbedding(question);
    
    if (!questionEmbedding || !questionEmbedding.some(v => Math.abs(v) > 0.01)) {
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
          sourceDocument: { $ifNull: ['$document.originalName', '$document.fileName'] },
          pageNumber: 1,
          embedding: 1
        }
      }
    ]);
    
    const scoredResults = results.map(chunk => ({
      ...chunk,
      similarity: cosineSimilarity(questionEmbedding, chunk.embedding)
    }));
    
    return scoredResults.sort((a, b) => b.similarity - a.similarity);
    
  } catch (error) {
    console.log('⚠️ Vector search error:', error.message);
    return [];
  }
}

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

async function generateRAGAnswer(question, chunks) {
  const model = await getChatModel();
  
  const context = chunks
    .map((chunk, idx) => `[Document ${idx + 1}]: ${chunk.sourceDocument} (Page ${chunk.pageNumber})\n${chunk.text}`) 
    .join('\n\n');
  
  const systemPrompt = `You are a document-based AI assistant.

Your task is to answer questions strictly using the uploaded HR policy document context below.

Rules:
1. Answer only from the provided document context.
2. Do not use general knowledge.
3. Keep the answer concise and directly based on the document text.
4. If the information is not present in the context, respond exactly with: "${DOCUMENT_ONLY_NO_ANSWER}"
5. Prefer quoting or closely summarizing the exact section from the document.
6. Do not invent policies, rules, or numbers not written in the document.`;

  const userPrompt = `Context:\n${context}\n\nQuestion: ${question}\n\nAnswer:`;

  const result = await model.generateContent([
    { text: systemPrompt },
    { text: userPrompt }
  ]);
  
  const answer = result.response.text();
  
  const citations = chunks.map(chunk => ({
    source: chunk.sourceDocument,
    pageNumber: chunk.pageNumber
  }));
  
  return { answer, citations };
}

async function generateGeneralAnswer(question) {
  const model = await getChatModel();
  
  const systemPrompt = `You are OpsMind AI, a helpful corporate assistant. Answer questions professionally and concisely. Use bullet points when appropriate. Be friendly yet authoritative.`;

  const userPrompt = question;

  const result = await model.generateContent([
    { text: systemPrompt },
    { text: userPrompt }
  ]);
  
  return { answer: result.response.text(), citations: [] };
}

export async function askQuestion(question, onChunk, onCitations, onError) {
  try {
    console.log('\n========== NEW QUESTION ==========');
    console.log(`Question: ${question}`);
    
    await initializeAI();
    
    if (!chatProviders.length) {
      onChunk("AI is not configured yet. Add a valid GEMINI_API_KEY, GROQ_API_KEY, or OPENAI_API_KEY in server/.env, then restart the server.");
      return;
    }
    
    const chunks = await findRelevantChunks(question, RETRIEVE_TOP_K);
    const documentOnlyQuestion = isDocumentOnlyQuestion(question);
    const documentsAvailable = await hasCompletedDocuments();
    
    const { mode, maxSimilarity } = detectMode(chunks);
    console.log(`MODE: ${mode} (max similarity: ${maxSimilarity.toFixed(3)})`);
    
    let result;
    if (documentOnlyQuestion && (!documentsAvailable || chunks.length === 0 || maxSimilarity < RAG_THRESHOLD)) {
      console.log('DOCUMENT_ONLY mode - no document-backed answer found');
      result = { answer: DOCUMENT_ONLY_NO_ANSWER, citations: [] };
    } else if (mode === 'RAG') {
      console.log('📄 RAG mode - document-based answer');
      result = await generateRAGAnswer(question, chunks);
    } else {
      console.log('💬 General mode - AI answer');
      result = await generateGeneralAnswer(question);
    }
    
    console.log(`Answer length: ${result.answer.length} chars`);
    if (result.citations?.length) {
      console.log('Citations:', result.citations.map(c => `${c.source} p.${c.pageNumber}`).join(', '));
    }
    
    onCitations(result.citations || []);
    onChunk(result.answer);
    
    console.log('✅ COMPLETE\n');
    
  } catch (error) {
    console.error('❌ RAG Error:', error.message);
    onError(error);
  }
}

