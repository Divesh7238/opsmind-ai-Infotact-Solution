import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { chatAPI } from '../services/api';
import { 
  MessageSquare, 
  Trash2, 
  Loader,
  Search,
  Edit,
  X
} from 'lucide-react';

export default function ChatHistory() {
  const navigate = useNavigate();
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');

  useEffect(() => {
    loadChats();
  }, []);

  const loadChats = async () => {
    try {
      setLoading(true);
      const response = await chatAPI.getHistory();
      setChats(response.data);
    } catch (err) {
      console.error('Failed to load chats:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this chat?')) return;

    try {
      await chatAPI.deleteChat(id);
      loadChats();
    } catch (err) {
      console.error('Failed to delete chat:', err);
    }
  };

  const handleRename = async (id) => {
    if (!editTitle.trim()) return;

    try {
      await chatAPI.renameChat(id, editTitle);
      setEditingId(null);
      setEditTitle('');
      loadChats();
    } catch (err) {
      console.error('Failed to rename chat:', err);
    }
  };

  const startRename = (chat, e) => {
    e.stopPropagation();
    setEditingId(chat._id);
    setEditTitle(chat.title);
  };

  const filteredChats = chats.filter(chat => 
    chat.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    chat.lastMessage?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-2">Chat History</h1>
        <p className="text-dark-400">View and manage your previous conversations</p>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-500" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search chats..."
          className="w-full pl-12 pr-4 py-3 bg-dark-800 border border-dark-700 rounded-xl text-white placeholder-dark-500 focus:outline-none focus:border-primary-500"
        />
      </div>

      {/* Chats List */}
      <div className="bg-dark-800 rounded-xl border border-dark-700">
        {loading ? (
          <div className="p-8 text-center">
            <Loader className="w-8 h-8 text-primary-500 mx-auto animate-spin" />
            <p className="text-dark-400 mt-2">Loading chats...</p>
          </div>
        ) : filteredChats.length === 0 ? (
          <div className="p-8 text-center">
            <MessageSquare className="w-12 h-12 text-dark-600 mx-auto mb-4" />
            <p className="text-dark-400">
              {searchQuery ? 'No chats found' : 'No chat history yet'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-dark-700">
            {filteredChats.map((chat) => (
              <div
                key={chat._id}
                onClick={() => navigate(`/chat/${chat._id}`)}
                className="p-4 flex items-center justify-between hover:bg-dark-700/50 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-dark-700 flex items-center justify-center flex-shrink-0">
                    <MessageSquare className="w-5 h-5 text-primary-400" />
                  </div>
                  <div className="min-w-0">
                    {editingId === chat._id ? (
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="px-2 py-1 bg-dark-700 border border-dark-600 rounded text-white text-sm focus:outline-none focus:border-primary-500"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRename(chat._id);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                        />
                        <button
                          onClick={() => handleRename(chat._id)}
                          className="p-1 text-green-400 hover:bg-dark-700 rounded"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="p-1 text-red-400 hover:bg-dark-700 rounded"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <h3 className="text-white font-medium truncate">{chat.title}</h3>
                        <p className="text-dark-500 text-sm truncate">
                          {chat.lastMessage || 'New conversation'}
                        </p>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4 flex-shrink-0">
                  <span className="text-dark-500 text-sm">
                    {new Date(chat.createdAt).toLocaleDateString()}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => startRename(chat, e)}
                      className="p-2 text-dark-400 hover:text-white hover:bg-dark-700 rounded-lg transition-colors"
                      title="Rename"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => handleDelete(chat._id, e)}
                      className="p-2 text-dark-400 hover:text-red-400 hover:bg-dark-700 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
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
