import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import SettingsModal from './SettingsModal';
import Sidebar from './Sidebar';

export default function Chat({ user }) {
  const [messages, setMessages] = useState([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [config, setConfig] = useState(() => {
    const saved = localStorage.getItem('chat-settings');
    return saved
      ? JSON.parse(saved)
      : { model: 'gpt-4o-mini', temperature: 1.0, system_prompt: '' };
  });
  const [thread, setThread] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isStreaming, setIsStreaming] = useState(false);

  const sessionId = useMemo(() => `sess-${user.id}`, [user.id]);

  useEffect(() => {
    localStorage.setItem('chat-settings', JSON.stringify(config));
  }, [config]);

  useEffect(() => {
    const initializeThread = async () => {
      setLoading(true);
      try {
        const savedThreadId = localStorage.getItem('last-thread-id');
        
        if (savedThreadId) {
          try {
            const res = await api.get('/threads');
            const threads = res.data;
            const lastThread = threads.find(t => t.id === parseInt(savedThreadId));
            
            if (lastThread) {
              await selectThread(lastThread);
              setLoading(false);
              return;
            }
          } catch (err) {
            console.warn('Could not restore last thread:', err);
          }
        }

        const res = await api.get('/threads');
        if (res.data && res.data.length > 0) {
          await selectThread(res.data[0]);
        } else {
          await newPersonal();
        }
      } catch (err) {
        console.error('Failed to initialize thread:', err);
        await newPersonal();
      } finally {
        setLoading(false);
      }
    };

    initializeThread();
  }, [user.id]);

  const loadMessages = async (t) => {
    if (!t) return;
    try {
      const res = await api.get(`/threads/${t.id}/messages`);
      const ms = res.data.map((m) => {
        if (m.type === 'file') {
          return { role: 'user', type: 'file', filename: m.filename };
        }
        return {
          role: m.sender === 'user' ? 'user' : 'assistant',
          content: m.content,
          model_used: m.model_used,
        };
      });
      setMessages(ms);
    } catch (e) {
      console.error('Failed to load messages:', e);
    }
  };

  const selectThread = async (t) => {
    setThread(t);
    localStorage.setItem('last-thread-id', String(t.id));
    await loadMessages(t);
    
    if (t.active_model && t.active_model !== config.model) {
      setConfig(prev => ({ ...prev, model: t.active_model }));
    }
  };

  const newPersonal = async (projectId = null) => {
    try {
      console.log('Creating new chat...', { projectId });
      
      const payload = { title: 'New chat' };
      if (projectId) payload.project_id = projectId;
      
      console.log('Sending POST /threads with payload:', payload);
      
      const res = await api.post('/threads', payload);
      
      console.log('Thread created successfully:', res.data);
      
      const newThread = res.data;
      
      setThread(newThread);
      localStorage.setItem('last-thread-id', String(newThread.id));
      setMessages([]);
      
      window.dispatchEvent(new Event('refresh-threads'));
      
      console.log('New chat created with ID:', newThread.id);
    } catch (error) {
      console.error('Failed to create new chat:', error);
      
      if (error.response) {
        console.error('Error response:', {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data,
          headers: error.response.headers
        });
        
        alert(`Failed to create new chat: ${error.response.data?.detail || error.response.statusText}`);
      } else if (error.request) {
        console.error('No response received:', error.request);
        alert('Failed to create new chat: No response from server');
      } else {
        console.error('Error message:', error.message);
        alert(`Failed to create new chat: ${error.message}`);
      }
    }
  };

  const renameChat = async () => {
    if (!thread) return alert('No chat selected');
    const newTitle = prompt('Rename chat:', thread.title);
    if (!newTitle || newTitle === thread.title) return;
    try {
      await api.put(`/threads/${thread.id}`, { title: newTitle });
      const updated = { ...thread, title: newTitle };
      setThread(updated);
      window.dispatchEvent(new Event('refresh-threads'));
      alert('Chat renamed');
    } catch {
      alert('Rename failed');
    }
  };

  const deleteChat = async () => {
    if (!thread) return alert('No chat selected');
    if (!window.confirm(`Delete chat "${thread.title}"?`)) return;
    try {
      await api.delete(`/threads/${thread.id}`);
      
      const res = await api.get('/threads');
      if (res.data && res.data.length > 0) {
        await selectThread(res.data[0]);
      } else {
        await newPersonal();
      }
      
      window.dispatchEvent(new Event('refresh-threads'));
      alert('Chat deleted');
    } catch {
      alert('Delete failed');
    }
  };

  const send = async ({ text, file }) => {
    if (isStreaming) return; // Prevent sending while streaming
    
    let t = thread;

    if (!t) {
      const res = await api.post('/threads', { title: 'New chat' });
      t = res.data;
      setThread(t);
      localStorage.setItem('last-thread-id', String(t.id));
    }

    if (text)
      setMessages((m) => [...m, { role: 'user', content: text, model_used: config.model }]);
    if (file)
      setMessages((m) => [
        ...m,
        { role: 'user', type: 'file', filename: file.name, model_used: config.model },
      ]);

    // Add empty assistant message that will be filled during streaming
    const assistantMessageIndex = messages.length + (text ? 1 : 0) + (file ? 1 : 0);
    setMessages((m) => [...m, { role: 'assistant', content: '', model_used: config.model, streaming: true }]);
    setIsStreaming(true);

    const form = new FormData();
    form.append('thread_id', String(t.id));
    form.append('message', text || '');
    form.append('model', config.model);
    form.append('temperature', String(config.temperature));
    form.append('system_prompt', config.system_prompt || '');
    if (file) form.append('file', file);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${api.defaults.baseURL}/chat/stream`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: form,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedContent = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              break;
            }
            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                accumulatedContent += parsed.content;
                setMessages((prevMessages) => {
                  const newMessages = [...prevMessages];
                  newMessages[assistantMessageIndex] = {
                    role: 'assistant',
                    content: accumulatedContent,
                    model_used: config.model,
                    streaming: true,
                  };
                  return newMessages;
                });
              }
            } catch (e) {
              console.error('Error parsing SSE data:', e);
            }
          }
        }
      }

      // Mark streaming as complete
      setMessages((prevMessages) => {
        const newMessages = [...prevMessages];
        newMessages[assistantMessageIndex] = {
          role: 'assistant',
          content: accumulatedContent,
          model_used: config.model,
          streaming: false,
        };
        return newMessages;
      });
      
      if (t.active_model !== config.model) {
        const updatedThread = { ...t, active_model: config.model };
        setThread(updatedThread);
      }

      if (t.title === 'New chat' && messages.length === 0 && text) {
        autoRenameThread(t.id, text);
      }
      
      window.dispatchEvent(new Event('refresh-threads'));
    } catch (e) {
      console.error('Streaming error:', e);
      setMessages((prevMessages) => {
        const newMessages = [...prevMessages];
        newMessages[assistantMessageIndex] = {
          role: 'assistant',
          content: '⚠️ Error processing your message.',
          model_used: config.model,
          streaming: false,
        };
        return newMessages;
      });
    } finally {
      setIsStreaming(false);
    }
  };

  const autoRenameThread = async (threadId, firstMessage) => {
    try {
      let title = firstMessage.trim();
      
      const firstSentence = title.match(/^[^.!?]+[.!?]/);
      if (firstSentence) {
        title = firstSentence[0];
      }
      
      if (title.length > 50) {
        title = title.substring(0, 47) + '...';
      }
      
      await api.put(`/threads/${threadId}`, { title });
      
      setThread(prev => ({ ...prev, title }));
      
      window.dispatchEvent(new Event('refresh-threads'));
    } catch (err) {
      console.error('Failed to auto-rename thread:', err);
    }
  };

  const handleModelChange = (newConfig) => {
    setConfig(newConfig);
    
    if (thread && newConfig.model !== thread.active_model) {
      const updatedThread = { ...thread, active_model: newConfig.model };
      setThread(updatedThread);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading your chat...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      <Sidebar
        user={user}
        selected={thread}
        onSelectThread={selectThread}
        onNewPersonal={newPersonal}
      />

      <div className="flex-1 flex flex-col">
        <header className="border-b border-neutral-800 p-3 flex items-center justify-between">
          <div className="flex flex-col">
            <div className="font-semibold">
              {thread ? thread.title : 'MemoryChat'}
            </div>
            {thread && (
              <div className="text-xs opacity-60">
                Active Model: {config.model}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              className="px-3 py-1 bg-neutral-800 rounded hover:bg-neutral-700"
              onClick={renameChat}
              disabled={!thread}
            >
              Rename
            </button>
            <button
              className="px-3 py-1 bg-red-600 rounded text-white hover:bg-red-700"
              onClick={deleteChat}
              disabled={!thread}
            >
              Delete
            </button>
            <button
              className="px-3 py-1 bg-blue-600 rounded hover:bg-blue-700"
              onClick={() => setSettingsOpen(true)}
            >
              Settings
            </button>
          </div>
        </header>

        <MessageList messages={messages} />
        <MessageInput onSend={send} disabled={isStreaming} />

        <SettingsModal
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          settings={config}
          onSave={handleModelChange}
        />
      </div>
    </div>
  );
}