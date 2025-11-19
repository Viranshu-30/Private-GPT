import React, { useRef, useState } from 'react';

export default function MessageInput({ onSend, disabled }) {
  const [value, setValue] = useState('');
  const [attachedFile, setAttachedFile] = useState(null);
  const fileRef = useRef(null);

  const send = () => {
    if (disabled) return;
    const text = value.trim();
    if (!text && !attachedFile) return;
    onSend({ text, file: attachedFile });
    setValue('');
    setAttachedFile(null);
  };

  const onFile = (e) => {
    const file = e.target.files?.[0];
    if (file) setAttachedFile(file);
    e.target.value = '';
  };

  return (
    <div className="p-4 flex items-center gap-2 border-t border-neutral-800">
      <button 
        className={`px-3 py-2 rounded ${disabled ? 'bg-neutral-700 cursor-not-allowed' : 'bg-neutral-800 hover:bg-neutral-700'}`}
        onClick={() => !disabled && fileRef.current?.click()}
        title="Attach file"
        disabled={disabled}
      >
        📎
      </button>
      <input ref={fileRef} type="file" className="hidden" onChange={onFile} disabled={disabled} />
      
      <input
        className={`flex-1 p-2 rounded ${disabled ? 'bg-neutral-700 cursor-not-allowed' : 'bg-neutral-800'}`}
        placeholder={disabled ? "AI is responding..." : "Send a message..."}
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !disabled) { e.preventDefault(); send(); }}}
        disabled={disabled}
      />
      
      {attachedFile && (
        <div className="text-sm opacity-70 flex items-center gap-2">
          <span>{attachedFile.name}</span>
          <button
            onClick={() => setAttachedFile(null)}
            className="text-red-400 hover:text-red-300"
            disabled={disabled}
          >
            ✕
          </button>
        </div>
      )}

      <button 
        className={`px-4 py-2 rounded ${disabled ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
        onClick={send}
        disabled={disabled}
      >
        {disabled ? 'Sending...' : 'Send'}
      </button>
    </div>
  );
}