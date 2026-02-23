import { useState, useEffect } from 'react';
import { dashboardAPI } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { 
  FileText, 
  MessageSquare, 
  Users, 
  TrendingUp,
  Loader,
  AlertCircle,
  CheckCircle,
  XCircle,
  UserPlus,
  Shield,
  Key
} from 'lucide-react';

export default function AdminPanel() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateAdmin, setShowCreateAdmin] = useState(false);
  const [adminForm, setAdminForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    inviteKey: ''
  });
  const [adminError, setAdminError] = useState('');
  const [adminSuccess, setAdminSuccess] = useState('');
  const [creating, setCreating] = useState(false);
  
  const { createAdmin } = useAuthStore();

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const response = await dashboardAPI.getStats();
      setStats(response.data);
    } catch (err) {
      console.error('Failed to load stats:', err);
      setError('Failed to load statistics');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    setAdminError('');
    setAdminSuccess('');
    
    if (adminForm.password !== adminForm.confirmPassword) {
      setAdminError('Passwords do not match');
      return;
    }

    if (adminForm.password.length < 6) {
      setAdminError('Password must be at least 6 characters');
      return;
    }

    try {
      setCreating(true);
      const result = await createAdmin(
        adminForm.name, 
        adminForm.email, 
        adminForm.password,
        adminForm.inviteKey || null
      );
      
      if (result.success) {
        setAdminSuccess(`Admin ${result.user.email} created successfully!`);
        setAdminForm({ name: '', email: '', password: '', confirmPassword: '', inviteKey: '' });
        setTimeout(() => setShowCreateAdmin(false), 2000);
      } else {
        setAdminError(result.error);
      }
    } catch (err) {
      setAdminError(err.response?.data?.error || 'Failed to create admin');
    } finally {
      setCreating(false);
    }
  };

  const StatCard = ({ title, value, icon: Icon, color }) => (
    <div className="bg-dark-800 rounded-xl border border-dark-700 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-dark-400 text-sm">{title}</p>
          <p className="text-3xl font-bold text-white mt-2">{value}</p>
        </div>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Admin Dashboard</h1>
          <p className="text-dark-400">Monitor your knowledge base and usage</p>
        </div>
        <button
          onClick={() => setShowCreateAdmin(!showCreateAdmin)}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
        >
          <UserPlus className="w-5 h-5" />
          Create Admin
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 mb-6 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      )}

      {/* Create Admin Modal */}
      {showCreateAdmin && (
        <div className="mb-6 bg-dark-800 border border-dark-700 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-primary-500/20 rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Create New Admin</h2>
              <p className="text-dark-400 text-sm">Add a new administrator to the system</p>
            </div>
          </div>

          {adminError && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {adminError}
            </div>
          )}

          {adminSuccess && (
            <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 text-sm">
              {adminSuccess}
            </div>
          )}

          <form onSubmit={handleCreateAdmin} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">Full Name</label>
                <input
                  type="text"
                  value={adminForm.name}
                  onChange={(e) => setAdminForm({...adminForm, name: e.target.value})}
                  className="w-full px-4 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white focus:outline-none focus:border-primary-500"
                  placeholder="Admin name"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">Email</label>
                <input
                  type="email"
                  value={adminForm.email}
                  onChange={(e) => setAdminForm({...adminForm, email: e.target.value})}
                  className="w-full px-4 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white focus:outline-none focus:border-primary-500"
                  placeholder="admin@company.com"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">Password</label>
                <input
                  type="password"
                  value={adminForm.password}
                  onChange={(e) => setAdminForm({...adminForm, password: e.target.value})}
                  className="w-full px-4 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white focus:outline-none focus:border-primary-500"
                  placeholder="Min 6 characters"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">Confirm Password</label>
                <input
                  type="password"
                  value={adminForm.confirmPassword}
                  onChange={(e) => setAdminForm({...adminForm, confirmPassword: e.target.value})}
                  className="w-full px-4 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white focus:outline-none focus:border-primary-500"
                  placeholder="Confirm password"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">
                Admin Invite Key (Optional)
                <span className="text-dark-500 ml-2 text-xs">(Required if creating first admin)</span>
              </label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
                <input
                  type="password"
                  value={adminForm.inviteKey}
                  onChange={(e) => setAdminForm({...adminForm, inviteKey: e.target.value})}
                  className="w-full pl-10 pr-4 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white focus:outline-none focus:border-primary-500"
                  placeholder="Enter admin invite key from .env"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={creating}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-600/50 text-white rounded-lg transition-colors"
              >
                {creating ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    Create Admin
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCreateAdmin(false);
                  setAdminForm({ name: '', email: '', password: '', confirmPassword: '', inviteKey: '' });
                  setAdminError('');
                  setAdminSuccess('');
                }}
                className="px-4 py-2 bg-dark-700 hover:bg-dark-600 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard 
          title="Total Documents" 
          value={stats?.documents?.total || 0} 
          icon={FileText}
          color="bg-primary-500/20 text-primary-400"
        />
        <StatCard 
          title="Indexed Chunks" 
          value={stats?.documents?.totalChunks || 0} 
          icon={TrendingUp}
          color="bg-green-500/20 text-green-400"
        />
        <StatCard 
          title="Total Chats" 
          value={stats?.chats?.total || 0} 
          icon={MessageSquare}
          color="bg-purple-500/20 text-purple-400"
        />
        <StatCard 
          title="Total Users" 
          value={stats?.users?.total || 0} 
          icon={Users}
          color="bg-yellow-500/20 text-yellow-400"
        />
      </div>

      {/* Document Status */}
      <div className="bg-dark-800 rounded-xl border border-dark-700">
        <div className="p-4 border-b border-dark-700">
          <h2 className="text-lg font-semibold text-white">Document Status</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto rounded-full bg-green-500/20 flex items-center justify-center mb-3">
                <CheckCircle className="w-8 h-8 text-green-400" />
              </div>
              <p className="text-2xl font-bold text-white">{stats?.documents?.completed || 0}</p>
              <p className="text-dark-400 text-sm">Completed</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 mx-auto rounded-full bg-yellow-500/20 flex items-center justify-center mb-3">
                <Loader className="w-8 h-8 text-yellow-400" />
              </div>
              <p className="text-2xl font-bold text-white">{stats?.documents?.processing || 0}</p>
              <p className="text-dark-400 text-sm">Processing</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 mx-auto rounded-full bg-red-500/20 flex items-center justify-center mb-3">
                <XCircle className="w-8 h-8 text-red-400" />
              </div>
              <p className="text-2xl font-bold text-white">{stats?.documents?.failed || 0}</p>
              <p className="text-dark-400 text-sm">Failed</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-dark-800 rounded-xl border border-dark-700 mt-6">
        <div className="p-4 border-b border-dark-700">
          <h2 className="text-lg font-semibold text-white">Recent Documents</h2>
        </div>
        <div className="divide-y divide-dark-700">
          {stats?.recentDocuments?.length > 0 ? (
            stats.recentDocuments.map((doc) => (
              <div key={doc._id} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <FileText className="w-5 h-5 text-primary-400" />
                  <div>
                    <p className="text-white">{doc.fileName}</p>
                    <p className="text-dark-500 text-sm">
                      {doc.totalChunks} chunks • {new Date(doc.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  doc.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                  doc.status === 'processing' ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-red-500/20 text-red-400'
                }`}>
                  {doc.status}
                </span>
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-dark-400">
              No documents uploaded yet
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
