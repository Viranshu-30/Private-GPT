import React, { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css';

const BotIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="10" rx="2"></rect>
    <circle cx="12" cy="5" r="2"></circle>
    <path d="M12 7v4"></path>
    <line x1="8" y1="16" x2="8" y2="16"></line>
    <line x1="16" y1="16" x2="16" y2="16"></line>
  </svg>
);

const UserIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
    <circle cx="12" cy="7" r="4"></circle>
  </svg>
);

const FileIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
    <polyline points="14 2 14 8 20 8"></polyline>
    <line x1="16" y1="13" x2="8" y2="13"></line>
    <line x1="16" y1="17" x2="8" y2="17"></line>
    <polyline points="10 9 9 9 8 9"></polyline>
  </svg>
);

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"></polyline>
  </svg>
);

export default function MessageList({ messages }) {
  const scrollRef = useRef(null);
  
  useEffect(() => { 
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div 
      ref={scrollRef} 
      className="h-full overflow-y-auto p-6 space-y-6"
      style={{ scrollBehavior: 'smooth' }}
    >
      {messages.length === 0 ? (
        <div className="flex items-center justify-center h-full">
          <div className="text-center max-w-md">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[var(--gradient-start)] to-[var(--gradient-mid)] flex items-center justify-center mx-auto mb-6 shadow-lg">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
            </div>
            <h2 className="text-2xl font-bold gradient-text mb-3">Start a Conversation</h2>
            <p className="text-[var(--text-muted)]">
              Send a message to begin chatting with your AI assistant. Your conversation will be saved automatically.
            </p>
          </div>
        </div>
      ) : (
        messages.map((m, i) => (
          <div 
            key={i} 
            className={`flex gap-4 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {/* Avatar for Assistant */}
            {m.role !== 'user' && (
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--gradient-start)] to-[var(--gradient-mid)] flex items-center justify-center text-white shadow-md">
                <BotIcon />
              </div>
            )}
            
            {/* Message Bubble */}
            <div 
              className={`max-w-[75%] ${
                m.role === 'user' 
                  ? 'message-user px-5 py-3' 
                  : 'message-assistant px-5 py-4'
              }`}
            >
              {m.type === 'file' ? (
                <div className="flex items-center gap-3 bg-[var(--surface-light)] border border-[var(--border-subtle)] rounded-xl px-4 py-3">
                  <div className="w-10 h-10 rounded-lg bg-[var(--bg-secondary)] flex items-center justify-center text-[var(--gradient-mid)]">
                    <FileIcon />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-[var(--text-primary)] truncate">
                      {m.filename}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-[var(--accent-success)] mt-0.5">
                      <CheckIcon />
                      <span>Stored in memory</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="markdown-content text-left">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeHighlight]}
                    components={{
                      code({ node, inline, className, children, ...props }) {
                        const match = /language-(\w+)/.exec(className || '');
                        return !inline ? (
                          <div className="relative my-3">
                            {match && (
                              <div className="absolute top-0 right-0 px-3 py-1 text-xs text-[var(--text-muted)] bg-[var(--bg-secondary)] rounded-bl-lg rounded-tr-xl border-b border-l border-[var(--border-subtle)]">
                                {match[1]}
                              </div>
                            )}
                            <pre className="!bg-[var(--bg-primary)] !p-4 !pt-8 !rounded-xl overflow-x-auto border border-[var(--border-subtle)]">
                              <code className={className} {...props}>
                                {children}
                              </code>
                            </pre>
                          </div>
                        ) : (
                          <code className="bg-[var(--surface-light)] px-1.5 py-0.5 rounded text-sm text-[var(--gradient-end)]" {...props}>
                            {children}
                          </code>
                        );
                      },
                      p({ children }) {
                        return <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>;
                      },
                      ul({ children }) {
                        return <ul className="list-disc list-inside mb-3 space-y-1.5">{children}</ul>;
                      },
                      ol({ children }) {
                        return <ol className="list-decimal list-inside mb-3 space-y-1.5">{children}</ol>;
                      },
                      li({ children }) {
                        return <li className="ml-2 text-[var(--text-secondary)]">{children}</li>;
                      },
                      h1({ children }) {
                        return <h1 className="text-2xl font-bold mb-3 mt-6 text-[var(--text-primary)]">{children}</h1>;
                      },
                      h2({ children }) {
                        return <h2 className="text-xl font-bold mb-3 mt-5 text-[var(--text-primary)]">{children}</h2>;
                      },
                      h3({ children }) {
                        return <h3 className="text-lg font-bold mb-2 mt-4 text-[var(--text-primary)]">{children}</h3>;
                      },
                      blockquote({ children }) {
                        return (
                          <blockquote className="border-l-3 border-[var(--gradient-mid)] pl-4 italic my-4 text-[var(--text-secondary)]">
                            {children}
                          </blockquote>
                        );
                      },
                      a({ children, href }) {
                        return (
                          <a 
                            href={href} 
                            className="text-[var(--gradient-mid)] hover:text-[var(--gradient-end)] underline decoration-[var(--gradient-mid)]/30 hover:decoration-[var(--gradient-end)] transition-colors" 
                            target="_blank" 
                            rel="noopener noreferrer"
                          >
                            {children}
                          </a>
                        );
                      },
                    }}
                  >
                    {m.content}
                  </ReactMarkdown>
                  {m.streaming && (
                    <span className="loading-cursor"></span>
                  )}
                </div>
              )}
            </div>
            
            {/* Avatar for User */}
            {m.role === 'user' && (
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-[var(--surface-hover)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-secondary)]">
                <UserIcon />
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}