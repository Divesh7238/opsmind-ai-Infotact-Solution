import mongoose from 'mongoose';

const chunkSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true
  },
  embedding: {
    type: [Number],
    required: true,
    select: false // Don't return embeddings in regular queries
  },
  documentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Document',
    required: true
  },
  sourceDocument: {
    type: String,
    required: true
  },
  pageNumber: {
    type: Number,
    default: 1
  },
  chunkIndex: {
    type: Number,
    required: true
  },
  metadata: {
    type: Object,
    default: {}
  }
}, {
  timestamps: true
});

// Text index for keyword search
chunkSchema.index({ text: 'text' });

// Compound index for efficient querying
chunkSchema.index({ documentId: 1, chunkIndex: 1 });

// MongoDB Atlas Vector Search Index
// This enables semantic vector similarity search
// Note: This index is created in MongoDB Atlas, not in Mongoose
// You'll need to create it in Atlas UI or using Atlas CLI

const Chunk = mongoose.model('Chunk', chunkSchema);

// Function to create vector search index (call this after connection)
Chunk.createVectorIndex = async function() {
  try {
    // Check if index already exists
    const indexes = await this.collection.indexes();
    const vectorIndexExists = indexes.some(idx => idx.name === 'embedding_vector_index');
    
    if (!vectorIndexExists) {
      await this.collection.createIndex(
        { embedding: 'vector' },
        {
          name: 'embedding_vector_index',
          vectorOptions: {
            dimensions: 768, // Gemini embedding dimensions
            metric: 'cosine'
          }
        }
      );
      console.log('Vector search index created successfully');
    }
  } catch (error) {
    // Index might already exist or not supported - that's ok
    console.log('Vector index creation skipped:', error.message);
  }
};

export default Chunk;
