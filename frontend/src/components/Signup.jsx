import React, { useState } from 'react';
import { api } from '../api';

export default function Signup({ onSignedUp }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState(null);
  const [ok, setOk] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);

    // Validate API key format
    if (!apiKey.startsWith('sk-')) {
      setError('Invalid API key format. OpenAI API keys start with "sk-"');
      return;
    }

    if (apiKey.length < 20) {
      setError('API key seems too short. Please check your key.');
      return;
    }

    try {
      await api.post('/auth/signup', { 
        email, 
        password,
        openai_api_key: apiKey 
      });
      setOk(true);
      setTimeout(() => onSignedUp(), 800);
    } catch (e) {
      setError(e.response?.data?.detail || 'Signup failed');
    }
  };

  return (
    <form onSubmit={submit} className="bg-neutral-800 rounded-lg p-6 space-y-4">
      <h1 className="text-xl font-semibold">Create account</h1>
      
      <div className="space-y-2">
        <label className="text-sm text-neutral-300">Email</label>
        <input 
          className="w-full p-2 rounded bg-neutral-900" 
          placeholder="your@email.com" 
          type="email"
          value={email} 
          onChange={e => setEmail(e.target.value)} 
          required
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm text-neutral-300">Password</label>
        <input 
          className="w-full p-2 rounded bg-neutral-900" 
          placeholder="Min 6 characters" 
          type="password" 
          value={password} 
          onChange={e => setPassword(e.target.value)} 
          required
          minLength={6}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm text-neutral-300 flex items-center justify-between">
          <span>OpenAI API Key</span>
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
            className="w-full p-2 pr-10 rounded bg-neutral-900 font-mono text-sm" 
            placeholder="sk-..." 
            type={showApiKey ? "text" : "password"}
            value={apiKey} 
            onChange={e => setApiKey(e.target.value)} 
            required
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
          Your API key is encrypted and stored securely. We never see or store your key in plain text.
        </p>
      </div>

      {error && <div className="text-red-400 text-sm bg-red-900/20 p-3 rounded">{error}</div>}
      {ok && <div className="text-green-400 text-sm bg-green-900/20 p-3 rounded">Account created! Redirecting to login...</div>}
      
      <button 
        type="submit"
        className="w-full py-2 bg-blue-600 rounded hover:bg-blue-700 transition"
      >
        Sign up
      </button>

      <div className="text-xs text-neutral-400 bg-neutral-900 p-3 rounded">
        <strong>Why do we need your API key?</strong>
        <ul className="mt-2 space-y-1 list-disc list-inside">
          <li>You control your own OpenAI usage and costs</li>
          <li>Choose which models you want to use</li>
          <li>Your conversations are private to you</li>
          <li>We don't charge any markup on API usage</li>
        </ul>
      </div>
    </form>
  );
}