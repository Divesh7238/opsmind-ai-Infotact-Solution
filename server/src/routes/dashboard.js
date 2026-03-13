import express from 'express';
import Document from '../models/Document.js';
import Chat from '../models/Chat.js';
import User from '../models/User.js';
import { protect, authorize } from '../middleware/auth.js';
import { requireDB } from '../index.js';

const router = express.Router();

// Demo mode stats
const getDemoStats = (isAdmin) => {
  return {
    totalChats: 0,
    totalMessages: 0,
    documentsCount: 0,
    chunksCount: 0,
    recentChats: []
  };
};

// @route   GET /api/dashboard/stats
// @desc    Get dashboard statistics
// @access  Private
router.get('/stats', protect, async (req, res) => {
  const userId = req.user._id;
  const isAdmin = req.user.role === 'admin';
  if (!requireDB) {
    return res.json(getDemoStats(isAdmin));
  }

  let stats = {
    totalChats: 0,
    totalMessages: 0,
    documentsCount: 0,
    chunksCount: 0,
    recentChats: []
  };

  try {
    // Get user's chat stats
    const chatStats = await Chat.aggregate([
      { $match: { userId: userId, isActive: true } },
      { $project: { messageCount: { $size: '$messages' } } },
      { $group: { _id: null, totalChats: { $sum: 1 }, totalMessages: { $sum: '$messageCount' } } }
    ]);

    if (chatStats.length > 0) {
      stats.totalChats = chatStats[0].totalChats;
      stats.totalMessages = chatStats[0].totalMessages;
    }

    // Get document stats (admin only)
    if (isAdmin) {
      const docStats = await Document.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: null, count: { $sum: 1 }, totalChunks: { $sum: '$totalChunks' } } }
      ]);

      if (docStats.length > 0) {
        stats.documentsCount = docStats[0].count;
        stats.chunksCount = docStats[0].totalChunks;
      }
    }

    // Get recent chats
    const recentChats = await Chat.find({ userId: userId, isActive: true })
      .select('title lastMessage createdAt')
      .sort({ updatedAt: -1 })
      .limit(5);

    stats.recentChats = recentChats;
    res.json(stats);
  } catch (error) {
    console.warn('Dashboard stats (demo mode):', error.message);
    res.json(getDemoStats(isAdmin));
  }
});

// @route   GET /api/dashboard/analytics
// @desc    Get analytics data (Admin only)
// @access  Private (Admin)
router.get('/analytics', protect, authorize('admin'), async (req, res) => {
  if (!requireDB) {
    return res.json({ totalUsers: 0, totalDocuments: 0, totalChats: 0, documentsByStatus: [], recentUploads: [], usersByRole: [] });
  }
  try {
    const totalUsers = await User.countDocuments({ isActive: true });
    const totalDocuments = await Document.countDocuments();
    const totalChats = await Chat.countDocuments({ isActive: true });

    const documentsByStatus = await Document.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const recentUploads = await Document.find()
      .populate('uploadedBy', 'name')
      .sort({ createdAt: -1 })
      .limit(10)
      .select('fileName status totalChunks createdAt uploadedBy');

    const usersByRole = await User.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } }
    ]);

    res.json({
      totalUsers,
      totalDocuments,
      totalChats,
      documentsByStatus,
      recentUploads,
      usersByRole
    });
  } catch (error) {
    console.warn('Analytics (demo mode):', error.message);
    res.json({
      totalUsers: 0,
      totalDocuments: 0,
      totalChats: 0,
      documentsByStatus: [],
      recentUploads: [],
      usersByRole: []
    });
  }
});

// @route   GET /api/dashboard/users
// @desc    Get all users (Admin only)
// @access  Private (Admin)
router.get('/users', protect, authorize('admin'), async (req, res) => {
  if (!requireDB) {
    return res.json([]);
  }
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    console.warn('Get users (demo mode):', error.message);
    res.json([]);
  }
});

// @route   PUT /api/dashboard/users/:id/role
// @desc    Update user role (Admin only)
// @access  Private (Admin)
router.put('/users/:id/role', protect, authorize('admin'), async (req, res) => {
  try {
    const { role } = req.body;

    if (!['admin', 'employee'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role: role },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user role' });
  }
});

export default router;

