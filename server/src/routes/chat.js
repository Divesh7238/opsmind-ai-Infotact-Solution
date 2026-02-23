import express from 'express';
import Chat from '../models/Chat.js';
import { protect } from '../middleware/auth.js';
import { askQuestion } from '../services/ragService.js';

const router = express.Router();

// @route   POST /api/chat/ask
// @desc    Ask a question and get streaming response
// @access  Private
router.post('/ask', protect, async (req, res) => {
  try {
    const { question, chatId } = req.body;

    if (!question || question.trim().length === 0) {
      return res.status(400).json({ error: 'Question is required' });
    }

    // Sanitize input
    const sanitizedQuestion = question.trim().substring(0, 2000);

    // Set headers for streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    let fullAnswer = '';
    let citations = [];

    // Create or update chat
    let chat;
    if (chatId) {
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

    // Process question with RAG
    await askQuestion(
      sanitizedQuestion,
      (chunk) => {
        fullAnswer += chunk;
        res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
      },
      (sourceCitations) => {
        citations = sourceCitations;
        res.write(`data: ${JSON.stringify({ type: 'citations', citations })}\n\n`);
      },
      (error) => {
        console.error('RAG Error:', error);
        // Provide fallback response when AI fails
        fullAnswer = "I apologize, but I'm unable to process your question at the moment. Please ensure the GEMINI_API_KEY is configured in the server environment variables.";
        res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
      }
    );

    // Ensure we have a valid answer (fallback if AI returns empty)
    if (!fullAnswer || fullAnswer.trim().length === 0) {
      fullAnswer = "I don't have information about that in the provided documents, or the AI service is not properly configured.";
    }

    // Add assistant message
    chat.messages.push({
      role: 'assistant',
      content: fullAnswer,
      citations
    });
    chat.lastMessage = fullAnswer;
    await chat.save();

    // Send completion signal
    res.write(`data: ${JSON.stringify({ type: 'done', chatId: chat._id })}\n\n`);
    res.end();

  } catch (error) {
    console.error('Chat error:', error);
    res.write(`data: ${JSON.stringify({ type: 'error', error: 'Failed to process question' })}\n\n`);
    res.end();
  }
});

// @route   GET /api/chat/history
// @desc    Get chat history
// @access  Private
router.get('/history', protect, async (req, res) => {
  try {
    const chats = await Chat.find({ userId: req.user._id, isActive: true })
      .select('title messages lastMessage createdAt updatedAt')
      .sort({ updatedAt: -1 })
      .limit(50);

    res.json(chats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get chat history' });
  }
});

// @route   GET /api/chat/:id
// @desc    Get single chat
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const chat = await Chat.findOne({ _id: req.params.id, userId: req.user._id })
      .populate('userId', 'name email');

    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    res.json(chat);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get chat' });
  }
});

// @route   PUT /api/chat/:id
// @desc    Update chat (rename)
// @access  Private
router.put('/:id', protect, async (req, res) => {
  try {
    const { title } = req.body;

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
