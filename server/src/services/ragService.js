import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq';
import Chunk from '../models/Chunk.js';

// Configuration
const RAG_THRESHOLD = 0.65;
const RETRIEVE_TOP_K = 2;
const MAX_TOKENS = 1000;
const EMBEDDING_MODEL = 'text-embedding-3-small';

let embeddingsModel = null;
let chatProviders = [];
let aiInitialized = false;

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
  
  // Embeddings - OpenAI primary with pseudo fallback
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (openaiApiKey) {
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

  // Chat providers - Gemini > Groq > OpenAI
  if (process.env.GEMINI_API_KEY) {
    try {
      chatProviders.push(await createGeminiProvider(process.env.GEMINI_API_KEY));
    } catch (e) {
      console.warn('Gemini provider init failed:', e.message);
    }
  }
  if (process.env.GROQ_API_KEY) {
    try {
      chatProviders.push(await createGroqProvider(process.env.GROQ_API_KEY));
    } catch (e) {
      console.warn('Groq provider init failed:', e.message);
    }
  }
  if (process.env.OPENAI_API_KEY) {
    try {
      chatProviders.push(await createOpenAIProvider(process.env.OPENAI_API_KEY));
    } catch (e) {
      console.warn('OpenAI provider init failed:', e.message);
    }
  }

  if (chatProviders.length === 0) {
    console.warn('⚠️ No AI providers configured. Check GEMINI_API_KEY, GROQ_API_KEY, OPENAI_API_KEY in server/.env');
  } else {
    console.log(`✅ AI initialized with ${chatProviders.length} providers: ${chatProviders.map((_,i) => ['Gemini','Groq','OpenAI'][i] || 'Unknown').filter(Boolean).join(', ')}`);
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
          const result = await provider(contents);
          return result;
        } catch (error) {
          console.warn(`Provider ${i + 1} failed:`, error.message);
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
          sourceDocument: '$document.name',
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
  
  const systemPrompt = `You are a corporate knowledge assistant. Answer questions using ONLY the provided document context.

Rules:
- Provide clear, concise, accurate answers
- Use bullet points and numbered lists when helpful
- Cite sources at the end: Source: <filename> - Page <number>
- If unclear or not in context, say "Not found in provided documents."
- Be professional and precise`;

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
      onChunk("Please add AI API keys (GEMINI_API_KEY, GROQ_API_KEY, or OPENAI_API_KEY) to server/.env and restart server.");
      return;
    }
    
    const chunks = await findRelevantChunks(question, RETRIEVE_TOP_K);
    
    const { mode, maxSimilarity } = detectMode(chunks);
    console.log(`MODE: ${mode} (max similarity: ${maxSimilarity.toFixed(3)})`);
    
    let result;
    if (mode === 'RAG') {
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

