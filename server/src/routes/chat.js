import express from 'express';
import Chat from '../models/Chat.js';
import { protect } from '../middleware/auth.js';
import { askQuestion } from '../services/ragService.js';

const router = express.Router();

// Demo mode: in-memory storage for chats when DB is not available
let demoChats = [];
let demoChatIdCounter = 1;

// Helper to check if we're in demo mode (no valid ObjectId)
const isDemoId = (id) => {
  return id === 'demo-admin-id' || id === 'demo-employee-id' || id.startsWith('demo-');
};

// @route   POST /api/chat/ask
// @desc    Ask a question and get streaming response
// @access  Private
router.post('/ask', protect, async (req, res) => {
  let chat = null;
  let isDemoChat = false;
  
  // Cleanup function to ensure stream is properly closed
  const cleanup = () => {
    if (!res.writableEnded) {
      try {
        res.end();
      } catch (e) {
        // Ignore errors during cleanup
      }
    }
  };
  
  // Handle client disconnection
  req.on('close', cleanup);
  
  try {
    const { question, chatId } = req.body;

    if (!question || question.trim().length === 0) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(400).json({ error: 'Question is required' });
    }

    // Sanitize input
    const sanitizedQuestion = question.trim().substring(0, 2000);

    // Set headers for streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    let fullAnswer = '';
    let citations = [];

    // Try to use database, fall back to demo mode
    try {
      if (chatId && !chatId.startsWith('demo-')) {
        chat = await Chat.findOne({ _id: chatId, userId: req.user._id });
      }

      if (!chat) {
        chat = await Chat.create({
          userId: req.user._id,
          title: sanitizedQuestion.substring(0, 50) + (sanitizedQuestion.length > 50 ? '...' : ''),
          messages: []
        });
      }

      // Add user message
      chat.messages.push({
        role: 'user',
        content: sanitizedQuestion
      });
    } catch (dbError) {
      console.warn('Chat save skipped (demo mode):', dbError.message);
      // Create demo chat object
      isDemoChat = true;
      chat = {
        _id: `demo-${demoChatIdCounter++}`,
        title: sanitizedQuestion.substring(0, 50),
        messages: [{
          role: 'user',
          content: sanitizedQuestion
        }]
      };
    }

    // Process question with RAG
    await askQuestion(
      sanitizedQuestion,
      (chunk) => {
        if (!res.writableEnded) {
          fullAnswer += chunk;
          res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
        }
      },
      (sourceCitations) => {
        if (!res.writableEnded) {
          citations = sourceCitations;
          res.write(`data: ${JSON.stringify({ type: 'citations', citations })}\n\n`);
        }
      },
      (error) => {
        console.error('RAG Error:', error);
        if (!res.writableEnded) {
          fullAnswer = "I apologize, but I'm unable to process your question right now. Please verify your AI API keys, quotas, and provider settings in server/.env.";
          res.write(`data: ${JSON.stringify({ type: 'chunk', content: fullAnswer })}\n\n`);
          res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
        }
      }
    );

    // Ensure we have a valid answer
    if (!fullAnswer || fullAnswer.trim().length === 0) {
      fullAnswer = "I couldn't generate a response. Please check whether at least one AI provider key is valid and whether the service has available quota.";
    }

    // Save chat if using database
    if (!isDemoChat && chat && chat._id) {
      try {
        chat.messages.push({
          role: 'assistant',
          content: fullAnswer,
          citations
        });
        chat.lastMessage = fullAnswer;
        await chat.save();
      } catch (saveError) {
        console.warn('Chat save failed:', saveError.message);
      }
    } else if (isDemoChat) {
      // Save to demo storage
      chat.messages.push({
        role: 'assistant',
        content: fullAnswer,
        citations
      });
      chat.lastMessage = fullAnswer;
      
      // Add to demoChats array
      const existingIndex = demoChats.findIndex(c => c._id === chat._id);
      if (existingIndex >= 0) {
        demoChats[existingIndex] = chat;
      } else {
        demoChats.push(chat);
      }
    }

    // Send completion signal
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({ type: 'done', chatId: chat._id })}\n\n`);
      res.end();
    }

  } catch (error) {
    console.error('Chat error:', error);
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'Failed to process question' })}\n\n`);
      res.end();
    }
  }
});

// @route   GET /api/chat/history
// @desc    Get chat history
// @access  Private
router.get('/history', protect, async (req, res) => {
  try {
    // Try database first
    const chats = await Chat.find({ userId: req.user._id, isActive: true })
      .select('title messages lastMessage createdAt updatedAt')
      .sort({ updatedAt: -1 })
      .limit(50);

    res.json(chats);
  } catch (error) {
    // Fall back to demo mode
    console.warn('Chat history fallback to demo mode:', error.message);
    const userEmail = req.user.email || '';
    const userDemoChats = demoChats.filter(c => 
      userEmail.includes('admin') || c._id.includes(req.user.id?.slice(-6) || '')
    );
    res.json(userDemoChats.length > 0 ? userDemoChats : []);
  }
});

// @route   GET /api/chat/:id
// @desc    Get single chat
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    // Check if it's a demo chat ID
    if (req.params.id.startsWith('demo-')) {
      const demoChat = demoChats.find(c => c._id === req.params.id);
      if (demoChat) {
        return res.json(demoChat);
      }
      return res.status(404).json({ error: 'Chat not found' });
    }

    const chat = await Chat.findOne({ _id: req.params.id, userId: req.user._id })
      .populate('userId', 'name email');

    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    res.json(chat);
  } catch (error) {
    // Fall back to demo mode
    console.warn('Get chat fallback to demo mode:', error.message);
    const demoChat = demoChats.find(c => c._id === req.params.id);
    if (demoChat) {
      return res.json(demoChat);
    }
    res.status(500).json({ error: 'Failed to get chat' });
  }
});

// @route   PUT /api/chat/:id
// @desc    Update chat (rename)
// @access  Private
router.put('/:id', protect, async (req, res) => {
  try {
    const { title } = req.body;

    // Check if it's a demo chat ID
    if (req.params.id.startsWith('demo-')) {
      const demoChat = demoChats.find(c => c._id === req.params.id);
      if (demoChat) {
        demoChat.title = title;
        return res.json(demoChat);
      }
      return res.status(404).json({ error: 'Chat not found' });
    }

    const chat = await Chat.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { title },
      { new: true }
    );

    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    res.json(chat);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update chat' });
  }
});

// @route   DELETE /api/chat/:id
// @desc    Delete chat
// @access  Private
router.delete('/:id', protect, async (req, res) => {
  try {
    // Check if it's a demo chat ID
    if (req.params.id.startsWith('demo-')) {
      const index = demoChats.findIndex(c => c._id === req.params.id);
      if (index >= 0) {
        demoChats.splice(index, 1);
        return res.json({ message: 'Chat deleted successfully' });
      }
      return res.status(404).json({ error: 'Chat not found' });
    }

    const chat = await Chat.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { isActive: false },
      { new: true }
    );

    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    res.json({ message: 'Chat deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete chat' });
  }
});

export default router;

