import { useState, useEffect } from 'react';
import { documentsAPI } from '../services/api';
import { 
  Upload, 
  FileText, 
  Trash2, 
  RefreshCw, 
  CheckCircle, 
  XCircle,
  Loader,
  AlertCircle
} from 'lucide-react';

export default function Documents() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const response = await documentsAPI.getAll();
      setDocuments(response.data);
    } catch (err) {
      console.error('Failed to load documents:', err);
      setError('Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (files) => {
    if (!files || files.length === 0) return;

    setUploading(true);
    setError(null);

    for (const file of files) {
      const formData = new FormData();
      formData.append('file', file);

      try {
        await documentsAPI.upload(formData);
      } catch (err) {
        console.error('Upload failed:', err);
        setError(`Failed to upload ${file.name}`);
      }
    }

    setUploading(false);
    loadDocuments();
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this document?')) return;

    try {
      await documentsAPI.delete(id);
      loadDocuments();
    } catch (err) {
      console.error('Delete failed:', err);
      setError('Failed to delete document');
    }
  };

  const handleReprocess = async (id) => {
    try {
      await documentsAPI.reprocess(id);
      loadDocuments();
    } catch (err) {
      console.error('Reprocess failed:', err);
      setError('Failed to reprocess document');
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    const files = e.dataTransfer.files;
    handleUpload(files);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = () => {
    setDragActive(false);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-400" />;
      case 'processing':
        return <Loader className="w-5 h-5 text-yellow-400 animate-spin" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-400" />;
      default:
        return <Loader className="w-5 h-5 text-dark-400 animate-spin" />;
    }
  };

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-2">Knowledge Base</h1>
        <p className="text-dark-400">Upload and manage your company documents</p>
      </div>

      {/* Upload Area */}
      <div
        className={`border-2 border-dashed rounded-xl p-8 mb-8 text-center transition-colors ${
          dragActive 
            ? 'border-primary-500 bg-primary-500/10' 
            : 'border-dark-600 hover:border-dark-500'
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <Upload className="w-12 h-12 text-dark-500 mx-auto mb-4" />
        <p className="text-white mb-2">
          Drag and drop PDF files here, or click to select
        </p>
        <p className="text-dark-500 text-sm mb-4">
          Supports PDF files up to 50MB
        </p>
        <label className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg cursor-pointer transition-colors">
          <Upload className="w-4 h-4" />
          {uploading ? 'Uploading...' : 'Select Files'}
          <input
            type="file"
            accept=".pdf"
            multiple
            className="hidden"
            onChange={(e) => handleUpload(e.target.files)}
            disabled={uploading}
          />
        </label>
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-3 p-4 mb-6 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      )}

      {/* Documents List */}
      <div className="bg-dark-800 rounded-xl border border-dark-700">
        <div className="p-4 border-b border-dark-700">
          <h2 className="text-lg font-semibold text-white">Uploaded Documents</h2>
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <Loader className="w-8 h-8 text-primary-500 mx-auto animate-spin" />
            <p className="text-dark-400 mt-2">Loading documents...</p>
          </div>
        ) : documents.length === 0 ? (
          <div className="p-8 text-center">
            <FileText className="w-12 h-12 text-dark-600 mx-auto mb-4" />
            <p className="text-dark-400">No documents uploaded yet</p>
          </div>
        ) : (
          <div className="divide-y divide-dark-700">
            {documents.map((doc) => (
              <div 
                key={doc._id}
                className="p-4 flex items-center justify-between hover:bg-dark-700/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-dark-700 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-primary-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-medium">{doc.fileName}</h3>
                    <div className="flex items-center gap-3 text-sm text-dark-500">
                      <span>{doc.totalChunks} chunks</span>
                      <span>•</span>
                      <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(doc.status)}
                    <span className="text-dark-400 capitalize">{doc.status}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleReprocess(doc._id)}
                      className="p-2 text-dark-400 hover:text-white hover:bg-dark-700 rounded-lg transition-colors"
                      title="Reprocess"
                    >
                      <RefreshCw className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(doc._id)}
                      className="p-2 text-dark-400 hover:text-red-400 hover:bg-dark-700 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
