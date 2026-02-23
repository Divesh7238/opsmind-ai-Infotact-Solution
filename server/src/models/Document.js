import mongoose from 'mongoose';

const documentSchema = new mongoose.Schema({
  fileName: {
    type: String,
    required: [true, 'File name is required'],
    trim: true
  },
  originalName: {
    type: String,
    required: true
  },
  filePath: {
    type: String,
    required: true
  },
  fileSize: {
    type: Number,
    required: true
  },
  mimeType: {
    type: String,
    required: true
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  totalChunks: {
    type: Number,
    default: 0
  },
  totalPages: {
    type: Number,
    default: 0
  },
  error: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

// Index for searching
documentSchema.index({ fileName: 'text', originalName: 'text' });

const Document = mongoose.model('Document', documentSchema);

export default Document;
