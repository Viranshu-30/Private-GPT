import React, { useEffect, useState } from 'react';
import { api } from '../api';

export default function SettingsModal({ open, onClose, settings, onSave, user }) {
  const [models, setModels] = useState([]);
  const [model, setModel] = useState(settings.model || 'gpt-4o-mini');
  const [temperature, setTemperature] = useState(settings.temperature ?? 1.0);
  const [systemPrompt, setSystemPrompt] = useState(settings.system_prompt || '');
  const [loading, setLoading] = useState(false);
  
  // API Key management
  const [showApiKeySection, setShowApiKeySection] = useState(false);
  const [newApiKey, setNewApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeyStatus, setApiKeyStatus] = useState(null);
  const [updatingApiKey, setUpdatingApiKey] = useState(false);

  useEffect(() => {
    if (open) {
      setLoading(true);
      api.get('/models')
        .then(res => {
          if (res.data && res.data.length > 0) {
            setModels(res.data);
          } else {
            // Fallback
            setModels([
              { id: 'gpt-4o-mini', name: 'GPT-4o mini' },
              { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' }
            ]);
          }
        })
        .catch(err => {
          console.error('Failed to load models:', err);
          setModels([
            { id: 'gpt-4o-mini', name: 'GPT-4o mini' },
            { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' }
          ]);
        })
        .finally(() => setLoading(false));
    }
  }, [open]);

  const save = () => {
    onSave({ model, temperature, system_prompt: systemPrompt });
    onClose();
  };

  const updateApiKey = async () => {
    if (!newApiKey.startsWith('sk-') || newApiKey.length < 20) {
      setApiKeyStatus({ type: 'error', message: 'Invalid API key format' });
      return;
    }

    setUpdatingApiKey(true);
    setApiKeyStatus(null);

    try {
      await api.put('/auth/api-key', { openai_api_key: newApiKey });
      setApiKeyStatus({ type: 'success', message: 'API key updated successfully!' });
      setNewApiKey('');
      setShowApiKeySection(false);
      
      // Refresh models list with new API key
      setTimeout(() => {
        setApiKeyStatus(null);
        window.location.reload(); // Reload to use new API key
      }, 1500);
    } catch (err) {
      setApiKeyStatus({ 
        type: 'error', 
        message: err.response?.data?.detail || 'Failed to update API key' 
      });
    } finally {
      setUpdatingApiKey(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-neutral-900 w-full max-w-xl rounded-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center sticky top-0 bg-neutral-900 pb-4 border-b border-neutral-800">
          <h2 className="text-lg font-semibold">Settings and Configuration</h2>
          <button onClick={onClose} className="text-2xl hover:text-red-400">✕</button>
        </div>

        {/* API Key Section */}
        <div className="bg-neutral-800 p-4 rounded-lg space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">OpenAI API Key</h3>
              <p className="text-xs text-neutral-400 mt-1">
                {user?.has_api_key ? '✅ API key configured' : '⚠️ No API key set'}
              </p>
            </div>
            <button
              onClick={() => setShowApiKeySection(!showApiKeySection)}
              className="px-3 py-1 bg-neutral-700 rounded hover:bg-neutral-600 text-sm"
            >
              {showApiKeySection ? 'Cancel' : 'Update Key'}
            </button>
          </div>

          {showApiKeySection && (
            <div className="space-y-3 pt-3 border-t border-neutral-700">
              <div className="space-y-2">
                <label className="text-sm text-neutral-300 flex items-center justify-between">
                  <span>New API Key</span>
                  <a 
                    href="https://platform.openai.com/api-keys" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:text-blue-300"
                  >
                    Get your key →
                  </a>
                </label>
                <div className="relative">
                  <input
                    type={showApiKey ? "text" : "password"}
                    value={newApiKey}
                    onChange={e => setNewApiKey(e.target.value)}
                    placeholder="sk-..."
                    className="w-full p-2 pr-10 rounded bg-neutral-900 font-mono text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-200"
                  >
                    {showApiKey ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
                <p className="text-xs text-neutral-400">
                  Your key is encrypted before storage. We never see it in plain text.
                </p>
              </div>

              {apiKeyStatus && (
                <div className={`text-sm p-3 rounded ${
                  apiKeyStatus.type === 'success' 
                    ? 'bg-green-900/20 text-green-400' 
                    : 'bg-red-900/20 text-red-400'
                }`}>
                  {apiKeyStatus.message}
                </div>
              )}

              <button
                onClick={updateApiKey}
                disabled={updatingApiKey || !newApiKey}
                className="w-full py-2 bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {updatingApiKey ? 'Updating...' : 'Update API Key'}
              </button>
            </div>
          )}
        </div>

        {/* Model Selection */}
        <div className="space-y-2">
          <label className="text-sm opacity-80">Model</label>
          {loading ? (
            <div className="w-full bg-neutral-800 p-2 rounded text-center opacity-60">
              Loading models...
            </div>
          ) : (
            <select 
              className="w-full bg-neutral-800 p-2 rounded" 
              value={model} 
              onChange={e => setModel(e.target.value)}
            >
              {models.map(m => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          )}
          {models.length > 0 && (
            <div className="text-xs opacity-60">
              {models.length} model{models.length !== 1 ? 's' : ''} available to your API key
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="space-y-2">
          <label className="text-sm opacity-80">Instructions</label>
          <textarea 
            className="w-full bg-neutral-800 p-2 rounded min-h-[120px]" 
            placeholder="Enter your custom instructions..." 
            value={systemPrompt} 
            onChange={e => setSystemPrompt(e.target.value)} 
          />
        </div>

        {/* Temperature */}
        <div className="space-y-2">
          <label className="text-sm opacity-80">Temperature</label>
          <input 
            type="range" 
            min="0.2" 
            max="1.5" 
            step="0.05" 
            value={temperature} 
            onChange={e => setTemperature(parseFloat(e.target.value))} 
            className="w-full" 
          />
          <div className="text-right text-sm opacity-70">{temperature.toFixed(2)}</div>
        </div>

        {/* Save/Cancel */}
        <div className="flex justify-end gap-2 pt-4 border-t border-neutral-800">
          <button className="px-4 py-2 bg-neutral-700 rounded hover:bg-neutral-600" onClick={onClose}>
            Cancel
          </button>
          <button className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-700" onClick={save}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}