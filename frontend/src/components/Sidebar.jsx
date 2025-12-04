import React, { useEffect, useState } from 'react';
import { api } from '../api';

// SVG Icons as components for clean, modern look
const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"></line>
    <line x1="5" y1="12" x2="19" y2="12"></line>
  </svg>
);

const EditIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
  </svg>
);

const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"></polyline>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
    <line x1="10" y1="11" x2="10" y2="17"></line>
    <line x1="14" y1="11" x2="14" y2="17"></line>
  </svg>
);

const ChatIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
  </svg>
);

const LogoutIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
    <polyline points="16 17 21 12 16 7"></polyline>
    <line x1="21" y1="12" x2="9" y2="12"></line>
  </svg>
);

export default function Sidebar({
  user,
  selected,
  onSelectThread,
  onNewPersonal,
  // Projects props - commented out for future use
  // onNewProject,
  // onInvite,
}) {
  // const [projects, setProjects] = useState([]);
  const [personalThreads, setPersonalThreads] = useState([]);
  // const [expanded, setExpanded] = useState({});

  // Load all personal threads (projects commented out for now)
  const load = async () => {
    try {
      const [/*proj,*/ personal] = await Promise.all([
        // api.get('/projects'),
        api.get('/threads'),
      ]);
      // setProjects(proj.data);
      setPersonalThreads(personal.data);
    } catch (e) {
      console.error('Sidebar load failed:', e);
    }
  };

  useEffect(() => {
    load();

    // Auto-refresh when Chat dispatches "refresh-threads"
    const handler = () => load();
    window.addEventListener('refresh-threads', handler);
    return () => window.removeEventListener('refresh-threads', handler);
  }, []);

  // Load threads belonging to a specific project (commented out for future)
  // const loadProjectThreads = async (projectId) => {
  //   try {
  //     const res = await api.get('/threads', { params: { project_id: projectId } });
  //     setExpanded((prev) => ({ ...prev, [projectId]: res.data }));
  //   } catch (e) {
  //     console.error('Failed to load project threads:', e);
  //   }
  // };

  return (
    <div className="w-72 sidebar h-screen flex flex-col">
      {/* Header with App Name */}
      <div className="p-4 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-3">
          {/* Logo/Icon */}
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--gradient-start)] to-[var(--gradient-mid)] flex items-center justify-center shadow-lg">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
              <path d="M2 17l10 5 10-5"></path>
              <path d="M2 12l10 5 10-5"></path>
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold gradient-text">PrivateGPT</h1>
            <p className="text-xs text-[var(--text-muted)]">Your AI Assistant with Memory</p>
          </div>
        </div> 
      </div>

      {/* Scrollable content */}
      <div className="p-3 space-y-4 flex-1 overflow-y-auto">
        {/* My Chats Section */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              My Chats
            </span>
            <button
              className="btn-primary px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5"
              onClick={() => onNewPersonal()}
            >
              <PlusIcon />
              New
            </button>
          </div>

          <div className="space-y-1">
            {personalThreads.length === 0 ? (
              <div className="text-sm text-[var(--text-muted)] text-center py-8 px-4">
                <ChatIcon />
                <p className="mt-2">No chats yet</p>
                <p className="text-xs mt-1">Start a new conversation!</p>
              </div>
            ) : (
              personalThreads.map((t) => (
                <div
                  key={t.id}
                  className={`group flex items-center gap-2 rounded-xl transition-smooth ${
                    selected?.id === t.id 
                      ? 'sidebar-item active' 
                      : 'sidebar-item'
                  }`}
                >
                  <button
                    onClick={() => onSelectThread(t)}
                    className="flex-1 text-left min-w-0 py-1"
                  >
                    <div className="truncate text-sm font-medium">{t.title}</div>
                    {t.active_model && (
                      <div className="text-xs text-[var(--text-muted)] truncate mt-0.5">
                        {t.active_model}
                      </div>
                    )}
                  </button>

                  {/* Action Buttons - appear on hover */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      className="icon-btn !w-7 !h-7"
                      onClick={async (e) => {
                        e.stopPropagation();
                        const newTitle = prompt('Rename chat:', t.title);
                        if (newTitle && newTitle !== t.title) {
                          await api.put(`/threads/${t.id}`, { title: newTitle });
                          load();
                        }
                      }}
                      title="Rename"
                    >
                      <EditIcon />
                    </button>

                    <button
                      className="icon-btn danger !w-7 !h-7"
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (confirm(`Delete chat "${t.title}"?`)) {
                          await api.delete(`/threads/${t.id}`);
                          load();
                        }
                      }}
                      title="Delete"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            PROJECTS SECTION -  for future implementation
            ══════════════════════════════════════════════════════════════════ */}
        {/* 
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Projects
            </span>
            <button
              className="btn-primary px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5"
              onClick={onNewProject}
            >
              <PlusIcon />
              New
            </button>
          </div>

          <div className="space-y-2">
            {projects.map((p) => (
              <div key={p.id} className="rounded-xl overflow-hidden">
                <div className="flex items-center justify-between sidebar-item">
                  <button
                    className="text-left flex-1"
                    onClick={() => loadProjectThreads(p.id)}
                  >
                    {p.name}
                  </button>

                  <button
                    className="text-xs px-2 py-1 btn-secondary rounded-lg"
                    onClick={() => onInvite(p)}
                  >
                    Invite
                  </button>

                  <button
                    className="text-xs px-2 py-1 btn-primary rounded-lg ml-1"
                    onClick={() => onNewPersonal(p.id)}
                  >
                    + Chat
                  </button>
                </div>

                <div className="mt-1 space-y-1 pl-3">
                  {(expanded[p.id] || []).map((t) => (
                    <div
                      key={t.id}
                      className={`group flex items-center gap-2 rounded-xl transition-smooth ${
                        selected?.id === t.id 
                          ? 'sidebar-item active' 
                          : 'sidebar-item'
                      }`}
                    >
                      <button
                        onClick={() => onSelectThread(t)}
                        className="flex-1 text-left min-w-0"
                      >
                        <div className="truncate text-sm">{t.title}</div>
                        {t.active_model && (
                          <div className="text-xs text-[var(--text-muted)] truncate">
                            {t.active_model}
                          </div>
                        )}
                      </button>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          className="icon-btn !w-7 !h-7"
                          onClick={async (e) => {
                            e.stopPropagation();
                            const newTitle = prompt('Rename chat:', t.title);
                            if (newTitle && newTitle !== t.title) {
                              await api.put(`/threads/${t.id}`, { title: newTitle });
                              loadProjectThreads(p.id);
                            }
                          }}
                          title="Rename"
                        >
                          <EditIcon />
                        </button>

                        <button
                          className="icon-btn danger !w-7 !h-7"
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (confirm(`Delete chat "${t.title}"?`)) {
                              await api.delete(`/threads/${t.id}`);
                              loadProjectThreads(p.id);
                            }
                          }}
                          title="Delete"
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        */}
      </div>

      {/* Footer with Powered By and User Info */}
      <div className="p-3 border-t border-[var(--border-subtle)] space-y-3">
        {/* Powered by MemMachine */}
        <div className="powered-badge flex items-center justify-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--gradient-mid)]">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M12 1v4"></path>
            <path d="M12 19v4"></path>
            <path d="M4.22 4.22l2.83 2.83"></path>
            <path d="M16.95 16.95l2.83 2.83"></path>
            <path d="M1 12h4"></path>
            <path d="M19 12h4"></path>
            <path d="M4.22 19.78l2.83-2.83"></path>
            <path d="M16.95 7.05l2.83-2.83"></path>
          </svg>
          <span className="text-xs text-[var(--text-muted)]">
            Powered by <span className="text-[var(--gradient-mid)] font-medium">MemMachine</span>
          </span>
        </div>

        {/* User Info */}
        {/* User Info */}
        <div className="flex items-center gap-3 px-2">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[var(--gradient-start)] to-[var(--gradient-mid)] flex items-center justify-center text-white font-semibold text-sm">
            {user.name ? user.name.charAt(0).toUpperCase() : (user.email?.charAt(0).toUpperCase() || 'U')}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate text-[var(--text-primary)]">
              {user.name || user.email}
            </div>
            {user.name && user.email && (
              <div className="text-xs text-[var(--text-muted)] truncate">
                {user.email}
              </div>
            )}
          </div>
        </div>

        {/* Logout Button */}
        <button
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 btn-danger rounded-xl text-sm font-medium"
          onClick={() => {
            localStorage.removeItem('token');
            delete api.defaults.headers.common['Authorization'];
            window.location.reload();
          }}
        >
          <LogoutIcon />
          Logout
        </button>
      </div>
    </div>
  );
}