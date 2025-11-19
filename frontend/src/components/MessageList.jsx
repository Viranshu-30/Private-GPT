import React, { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css';

export default function MessageList({ messages }) {
  const scrollRef = useRef(null);
  
  useEffect(() => { 
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); 
  }, [messages]);

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4 bg-neutral-900">
      {messages.map((m, i) => (
        <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
          <div className={`max-w-[80%] px-4 py-3 rounded-2xl shadow ${m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-neutral-800 text-neutral-100'}`}>
            {m.type === 'file' ? (
              <div className="flex items-center gap-3 bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2">
                <div className="text-xl">📄</div>
                <div className="text-left">
                  <div className="font-semibold text-sm">{m.filename}</div>
                  <div className="text-xs text-neutral-400">Stored in memory ✓</div>
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
                        <div className="relative">
                          <pre className="!bg-neutral-900 !p-4 !rounded-lg !my-2 overflow-x-auto">
                            <code className={className} {...props}>
                              {children}
                            </code>
                          </pre>
                        </div>
                      ) : (
                        <code className="bg-neutral-700 px-1.5 py-0.5 rounded text-sm" {...props}>
                          {children}
                        </code>
                      );
                    },
                    p({ children }) {
                      return <p className="mb-2 last:mb-0">{children}</p>;
                    },
                    ul({ children }) {
                      return <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>;
                    },
                    ol({ children }) {
                      return <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>;
                    },
                    li({ children }) {
                      return <li className="ml-2">{children}</li>;
                    },
                    h1({ children }) {
                      return <h1 className="text-2xl font-bold mb-2 mt-4">{children}</h1>;
                    },
                    h2({ children }) {
                      return <h2 className="text-xl font-bold mb-2 mt-3">{children}</h2>;
                    },
                    h3({ children }) {
                      return <h3 className="text-lg font-bold mb-2 mt-2">{children}</h3>;
                    },
                    blockquote({ children }) {
                      return <blockquote className="border-l-4 border-neutral-600 pl-4 italic my-2">{children}</blockquote>;
                    },
                    a({ children, href }) {
                      return <a href={href} className="text-blue-400 hover:underline" target="_blank" rel="noopener noreferrer">{children}</a>;
                    },
                  }}
                >
                  {m.content}
                </ReactMarkdown>
                {m.streaming && (
                  <span className="inline-block w-2 h-4 bg-neutral-100 ml-1 animate-pulse"></span>
                )}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}