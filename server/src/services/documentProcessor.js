import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pdf from 'pdf-parse';
import Document from '../models/Document.js';
import Chunk from '../models/Chunk.js';
import { generateEmbedding } from './ragService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Text chunking configuration
const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;

export async function processDocument(documentId) {
  try {
    const document = await Document.findById(documentId);
    if (!document) {
      throw new Error('Document not found');
    }

    // Update status to processing
    document.status = 'processing';
    await document.save();

    // Extract text based on file type
    let text = '';
    if (document.mimeType === 'application/pdf') {
      text = await extractPdfText(document.filePath);
    } else if (document.mimeType === 'text/plain') {
      text = await extractTextFile(document.filePath);
    } else {
      throw new Error('Unsupported file type');
    }

    // Calculate total pages (approximate)
    const totalPages = Math.ceil(text.length / 3000);
    document.totalPages = totalPages;

    // Split text into chunks
    const chunks = splitTextIntoChunks(text, CHUNK_SIZE, CHUNK_OVERLAP);

    // Process each chunk
    const processedChunks = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunkText = chunks[i];
      
      // Generate embedding
      const embedding = await generateEmbedding(chunkText);
      
      // Create chunk document
      const chunk = await Chunk.create({
        text: chunkText,
        embedding,
        documentId: document._id,
        sourceDocument: document.originalName,
        pageNumber: Math.min(i + 1, totalPages),
        chunkIndex: i,
        metadata: {
          processedAt: new Date()
        }
      });
      
      processedChunks.push(chunk);
    }

    // Update document status
    document.status = 'completed';
    document.totalChunks = processedChunks.length;
    await document.save();

    console.log(`Document processed successfully: ${document.originalName} with ${processedChunks.length} chunks`);
    
    return { success: true, chunksCount: processedChunks.length };
  } catch (error) {
    console.error('Document processing error:', error);
    
    // Update document status to failed
    const document = await Document.findById(documentId);
    if (document) {
      document.status = 'failed';
      document.error = error.message;
      await document.save();
    }
    
    throw error;
  }
}

async function extractPdfText(filePath) {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdf(dataBuffer);
    return data.text;
  } catch (error) {
    console.error('PDF extraction error:', error);
    throw new Error('Failed to extract text from PDF');
  }
}

async function extractTextFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch (error) {
    console.error('Text file extraction error:', error);
    throw new Error('Failed to read text file');
  }
}

function splitTextIntoChunks(text, chunkSize, overlap) {
  const chunks = [];
  const words = text.split(/\s+/);
  
  let start = 0;
  while (start < words.length) {
    const end = start + chunkSize;
    const chunk = words.slice(start, end).join(' ');
    
    if (chunk.trim().length > 0) {
      chunks.push(chunk);
    }
    
    start = end - overlap;
    
    if (start >= words.length) break;
  }
  
  return chunks;
}

export async function deleteDocumentChunks(documentId) {
  try {
    await Chunk.deleteMany({ documentId });
    return { success: true };
  } catch (error) {
    console.error('Delete chunks error:', error);
    throw error;
  }
}
