import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { dashboardAPI } from '../services/api';
import { 
  MessageSquare, 
  FileText, 
  Brain, 
  Clock, 
  TrendingUp,
  ArrowRight,
  Sparkles
} from 'lucide-react';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await dashboardAPI.getStats();
      setStats(response.data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
      </div>
    );
  }

  const isAdmin = user?.role === 'admin';

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">
            Welcome back, {user?.name} 👋
          </h1>
          <p className="text-dark-400 mt-1">
            Ready to get some answers from your documents?
          </p>
        </div>
        <Link
          to="/chat"
          className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-lg font-medium transition-all hover:scale-105"
        >
          <Sparkles className="w-5 h-5" />
          Start New Chat
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-dark-400 text-sm">Total Chats</p>
              <p className="text-3xl font-bold text-white mt-1">{stats?.totalChats || 0}</p>
            </div>
            <div className="w- bg-primary-60012 h-12/20 rounded-lg flex items-center justify-center">
              <MessageSquare className="w-6 h-6 text-primary-400" />
            </div>
          </div>
        </div>

        <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-dark-400 text-sm">Messages</p>
              <p className="text-3xl font-bold text-white mt-1">{stats?.totalMessages || 0}</p>
            </div>
            <div className="w-12 h-12 bg-green-600/20 rounded-lg flex items-center justify-center">
              <Brain className="w-6 h-6 text-green-400" />
            </div>
          </div>
        </div>

        {isAdmin && (
          <>
            <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-dark-400 text-sm">Documents</p>
                  <p className="text-3xl font-bold text-white mt-1">{stats?.documentsCount || 0}</p>
                </div>
                <div className="w-12 h-12 bg-purple-600/20 rounded-lg flex items-center justify-center">
                  <FileText className="w-6 h-6 text-purple-400" />
                </div>
              </div>
            </div>

            <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-dark-400 text-sm">Indexed Chunks</p>
                  <p className="text-3xl font-bold text-white mt-1">{stats?.chunksCount || 0}</p>
                </div>
                <div className="w-12 h-12 bg-yellow-600/20 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-yellow-400" />
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Quick Ask Section */}
      <div className="bg-dark-800 border border-dark-700 rounded-xl p-8">
        <h2 className="text-xl font-semibold text-white mb-4">Quick Ask</h2>
        <p className="text-dark-400 mb-6">
          Ask a question about your documents and get instant answers with citations
        </p>
        <button
          onClick={() => navigate('/chat')}
          className="inline-flex items-center gap-2 bg-dark-700 hover:bg-dark-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
        >
          <MessageSquare className="w-5 h-5" />
          Go to Chat
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>

      {/* Recent Chats */}
      <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">Recent Chats</h2>
          <Link
            to="/history"
            className="text-primary-400 hover:text-primary-300 text-sm font-medium"
          >
            View all
          </Link>
        </div>

        {stats?.recentChats?.length > 0 ? (
          <div className="space-y-3">
            {stats.recentChats.map((chat) => (
              <Link
                key={chat._id}
                to={`/chat/${chat._id}`}
                className="flex items-center gap-4 p-4 bg-dark-700/50 hover:bg-dark-700 rounded-lg transition-colors"
              >
                <div className="w-10 h-10 bg-primary-600/20 rounded-lg flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-primary-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">{chat.title}</p>
                  <p className="text-dark-400 text-sm truncate">{chat.lastMessage}</p>
                </div>
                <div className="flex items-center gap-1 text-dark-500 text-sm">
                  <Clock className="w-4 h-4" />
                  {new Date(chat.createdAt).toLocaleDateString()}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <MessageSquare className="w-12 h-12 text-dark-600 mx-auto mb-4" />
            <p className="text-dark-400">No chats yet</p>
            <Link
              to="/chat"
              className="text-primary-400 hover:text-primary-300 text-sm font-medium mt-2 inline-block"
            >
              Start your first chat
            </Link>
          </div>
        )}
      </div>

      {/* Admin Notice */}
      {isAdmin && stats?.documentsCount === 0 && (
        <div className="bg-primary-600/10 border border-primary-600/20 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-primary-600/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <FileText className="w-5 h-5 text-primary-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white mb-1">Get Started</h3>
              <p className="text-dark-400 mb-4">
                Upload your first document to start building your knowledge base
              </p>
              <Link
                to="/documents"
                className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
              >
                Upload Documents
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
