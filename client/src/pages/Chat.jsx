import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { chatAPI } from '../services/api';
import { 
  Send, 
  Copy, 
  Check, 
  Plus, 
  Trash2, 
  MessageSquare,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

export default function Chat() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamedText, setStreamedText] = useState('');
  const [currentCitations, setCurrentCitations] = useState([]);
  const [copiedId, setCopiedId] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (chatId) {
      loadChat(chatId);
    }
  }, [chatId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadChat = async (id) => {
    try {
      const response = await chatAPI.getChat(id);
      setMessages(response.data.messages);
    } catch (err) {
      console.error('Failed to load chat:', err);
      setError('Failed to load chat');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setIsLoading(true);
    setError(null);
    setStreamedText('');
    setCurrentCitations([]);

    const newUserMessage = {
      role: 'user',
      content: userMessage,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, newUserMessage]);

    try {
      const response = await fetch('/api/chat/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ 
          question: userMessage, 
          chatId: chatId || null 
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      let citations = [];
      let currentChatId = chatId;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === 'chunk') {
                fullText += data.content;
                setStreamedText(fullText);
              } else if (data.type === 'citations') {
                citations = data.citations;
                setCurrentCitations(citations);
              } else if (data.type === 'done') {
                currentChatId = data.chatId;
                if (!chatId && currentChatId) {
                  navigate(`/chat/${currentChatId}`, { replace: true });
                }
              } else if (data.type === 'error') {
                setError(data.error);
                if (!fullText) {
                  fullText = 'I was not able to generate a response. Please check the AI provider configuration and try again.';
                  setStreamedText(fullText);
                }
              }
            } catch (err) {
              // Skip invalid JSON
            }
          }
        }
      }

      if (fullText.trim()) {
        const assistantMessage = {
          role: 'assistant',
          content: fullText,
          citations,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, assistantMessage]);
      }

    } catch (err) {
      console.error('Chat error:', err);
      setError('Failed to get response. Please try again.');
    } finally {
      setIsLoading(false);
      setStreamedText('');
      inputRef.current?.focus();
    }
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const startNewChat = () => {
    navigate('/chat');
    setMessages([]);
    setError(null);
  };

  const deleteChat = async () => {
    if (!chatId) return;
    if (!confirm('Are you sure you want to delete this chat?')) return;
    
    try {
      await chatAPI.deleteChat(chatId);
      navigate('/chat');
    } catch (err) {
      console.error('Failed to delete chat:', err);
    }
  };

  return (
    <div className="flex h-full -m-6">
      <div className="flex-1 flex flex-col bg-dark-950">
        <div className="h-16 border-b border-dark-700 flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold text-white">
              {chatId ? 'Chat' : 'New Chat'}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {chatId && (
              <button
                onClick={deleteChat}
                className="p-2 text-dark-400 hover:text-red-400 hover:bg-dark-700 rounded-lg transition-colors"
                title="Delete chat"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={startNewChat}
              className="p-2 text-dark-400 hover:text-white hover:bg-dark-700 rounded-lg transition-colors"
              title="New chat"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6 space-y-6">
          {messages.length === 0 && !isLoading && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <MessageSquare className="w-16 h-16 text-dark-600 mb-4" />
              <h2 className="text-2xl font-bold text-white mb-2">
                How can I help you today?
              </h2>
              <p className="text-dark-400 max-w-md">
                Ask me anything about your documents and I'll provide answers with citations
              </p>
            </div>
          )}

          {messages.map((message, index) => (
            <MessageBubble
              key={index}
              message={message}
              onCopy={copyToClipboard}
              copiedId={copiedId}
            />
          ))}

          {isLoading && (
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-white text-sm flex-shrink-0">
                AI
              </div>
              <div className="bg-dark-800 rounded-lg p-4 max-w-3xl">
                {streamedText ? (
                  <div className="prose prose-invert max-w-none">
                    <ReactMarkdown>{streamedText}</ReactMarkdown>
                  </div>
                ) : (
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-dark-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-dark-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-dark-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                )}
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div className="p-6 border-t border-dark-700">
          <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about your HR policy or any general question..."
                className="w-full px-6 py-4 bg-dark-800 border border-dark-600 rounded-xl text-white placeholder-dark-500 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 pr-14"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-primary-600 hover:bg-primary-700 disabled:bg-dark-700 text-white rounded-lg transition-colors"
              >
                {isLoading ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </div>
            <p className="text-center text-dark-500 text-sm mt-3">
              HR policy questions are answered from uploaded documents. General questions use the AI assistant.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message, onCopy, copiedId }) {
  const isUser = message.role === 'user';
  const messageId = `${message.timestamp}-${message.content.slice(0, 20)}`;

  return (
    <div className={`flex gap-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-white text-sm flex-shrink-0">
          AI
        </div>
      )}
      
      <div className={`max-w-3xl ${isUser ? 'text-right' : 'text-left'}`}>
        <div
          className={`inline-block rounded-lg p-4 ${
            isUser 
              ? 'bg-primary-600 text-white' 
              : 'bg-dark-800 text-dark-100'
          }`}
        >
          {!isUser ? (
            <div className="prose prose-invert max-w-none">
              <ReactMarkdown
                components={{
                  code({ node, inline, className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || '');
                    return !inline && match ? (
                      <SyntaxHighlighter
                        style={oneDark}
                        language={match[1]}
                        PreTag="div"
                        {...props}
                      >
                        {String(children).replace(/\n$/, '')}
                      </SyntaxHighlighter>
                    ) : (
                      <code className={className} {...props}>
                        {children}
                      </code>
                    );
                  }
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          ) : (
            <p className="whitespace-pre-wrap">{message.content}</p>
          )}
        </div>

        {/* Citations */}
        {!isUser && message.citations && message.citations.length > 0 && (
          <div className="mt-3 pt-3 border-t border-dark-700">
            <p className="text-xs text-dark-500 mb-2">Sources:</p>
            <div className="flex flex-wrap gap-2">
              {message.citations.map((citation, idx) => (
                <span 
                  key={idx}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-dark-700/50 rounded text-xs text-dark-400"
                >
                  <span className="text-primary-400">{citation.source}</span>
                  <span className="text-dark-500">- Page {citation.pageNumber}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Copy Button */}
        {!isUser && (
          <button
            onClick={() => onCopy(message.content, messageId)}
            className="mt-2 p-1.5 text-dark-500 hover:text-white hover:bg-dark-700 rounded transition-colors"
            title="Copy response"
          >
            {copiedId === messageId ? (
              <Check className="w-4 h-4 text-green-400" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}
