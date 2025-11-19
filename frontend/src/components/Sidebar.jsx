import React, { useEffect, useState } from 'react';
import { api } from '../api';

export default function Sidebar({
  user,
  selected,
  onSelectThread,
  onNewPersonal,
  onNewProject,
  onInvite,
}) {
  const [projects, setProjects] = useState([]);
  const [personalThreads, setPersonalThreads] = useState([]);
  const [expanded, setExpanded] = useState({});

  // Load all projects and personal threads
  const load = async () => {
    try {
      const [proj, personal] = await Promise.all([
        api.get('/projects'),
        api.get('/threads'),
      ]);
      setProjects(proj.data);
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

  // Load threads belonging to a specific project
  const loadProjectThreads = async (projectId) => {
    try {
      const res = await api.get('/threads', { params: { project_id: projectId } });
      setExpanded((prev) => ({ ...prev, [projectId]: res.data }));
    } catch (e) {
      console.error('Failed to load project threads:', e);
    }
  };

  return (
    <div className="w-72 bg-neutral-900 border-r border-neutral-800 h-screen flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-neutral-800 flex items-center justify-between">
        <div className="font-semibold text-lg">Workspace</div>
        <button
          className="text-xs px-2 py-1 bg-neutral-800 rounded"
          onClick={load}
        >
          ↻
        </button>
      </div>

      {/* Scrollable content */}
      <div className="p-3 space-y-4 flex-1 overflow-y-auto">
        {/* Personal Chats */}
        <div>
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase opacity-70">My Chats</div>
            <button
              className="text-xs px-2 py-1 bg-blue-600 rounded"
              onClick={() => onNewPersonal()}
            >
              New
            </button>
          </div>

          <div className="mt-2 space-y-1">
            {personalThreads.map((t) => (
              <div
                key={t.id}
                className={`flex items-center justify-between px-2 py-1 rounded ${
                  selected?.id === t.id ? 'bg-neutral-800' : 'hover:bg-neutral-800'
                }`}
              >
                <button
                  onClick={() => onSelectThread(t)}
                  className="flex-1 text-left truncate"
                >
                  <div>{t.title}</div>
                  {/* Show model currently active for this chat */}
                  {t.active_model && (
                    <div className="text-xs opacity-60">
                      model: {t.active_model}
                    </div>
                  )}
                </button>

                {/* Rename chat */}
                <button
                  className="text-xs px-1 text-blue-400 hover:text-blue-300"
                  onClick={async (e) => {
                    e.stopPropagation();
                    const newTitle = prompt('Rename chat:', t.title);
                    if (newTitle && newTitle !== t.title) {
                      await api.put(`/threads/${t.id}`, { title: newTitle });
                      alert('Chat renamed');
                      load();
                    }
                  }}
                >
                  ✏️
                </button>

                {/* Delete chat */}
                <button
                  className="text-xs px-1 text-red-400 hover:text-red-300"
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (confirm(`Delete chat "${t.title}"?`)) {
                      await api.delete(`/threads/${t.id}`);
                      alert('Deleted');
                      load();
                    }
                  }}
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Projects Section */}
        <div className="mt-4">
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase opacity-70">Projects</div>
            <button
              className="text-xs px-2 py-1 bg-blue-600 rounded"
              onClick={onNewProject}
            >
              New
            </button>
          </div>

          <div className="mt-2 space-y-2">
            {projects.map((p) => (
              <div key={p.id} className="bg-neutral-900">
                <div className="flex items-center justify-between px-2 py-1 rounded hover:bg-neutral-800">
                  <button
                    className="text-left flex-1"
                    onClick={() => loadProjectThreads(p.id)}
                  >
                    {p.name}
                  </button>

                  {/* Invite user */}
                  <button
                    className="text-xs px-2 py-1 bg-neutral-800 rounded"
                    onClick={() => onInvite(p)}
                  >
                    Invite
                  </button>

                  {/* New chat inside project */}
                  <button
                    className="text-xs px-2 py-1 bg-blue-600 rounded ml-1"
                    onClick={() => onNewPersonal(p.id)}
                  >
                    + Chat
                  </button>
                </div>

                {/* Threads inside project */}
                <div className="mt-1 space-y-1">
                  {(expanded[p.id] || []).map((t) => (
                    <div
                      key={t.id}
                      className={`flex items-center justify-between px-3 py-1 rounded ${
                        selected?.id === t.id
                          ? 'bg-neutral-800'
                          : 'hover:bg-neutral-800'
                      }`}
                    >
                      <button
                        onClick={() => onSelectThread(t)}
                        className="flex-1 text-left truncate"
                      >
                        <div>{t.title}</div>
                        {t.active_model && (
                          <div className="text-xs opacity-60">
                            model: {t.active_model}
                          </div>
                        )}
                      </button>

                      {/* Rename chat */}
                      <button
                        className="text-xs px-1 text-blue-400 hover:text-blue-300"
                        onClick={async (e) => {
                          e.stopPropagation();
                          const newTitle = prompt('Rename chat:', t.title);
                          if (newTitle && newTitle !== t.title) {
                            await api.put(`/threads/${t.id}`, { title: newTitle });
                            alert('Chat renamed');
                            loadProjectThreads(p.id);
                          }
                        }}
                      >
                        ✏️
                      </button>

                      {/* Delete chat */}
                      <button
                        className="text-xs px-1 text-red-400 hover:text-red-300"
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (confirm(`Delete chat "${t.title}"?`)) {
                            await api.delete(`/threads/${t.id}`);
                            alert('Deleted');
                            loadProjectThreads(p.id);
                          }
                        }}
                      >
                        🗑️
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-neutral-800 text-sm">
        <div className="opacity-80">{user.email}</div>
        <button
          className="mt-2 w-full px-3 py-2 bg-red-600 rounded"
          onClick={() => {
            localStorage.removeItem('token');
            delete api.defaults.headers.common['Authorization'];
            window.location.reload();
          }}
        >
          Logout
        </button>
      </div>
    </div>
  );
}