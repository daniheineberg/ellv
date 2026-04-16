import { useState, useEffect } from 'react';
import { X, Trash2, Plus, Instagram } from 'lucide-react';

interface Handle {
  id: string;
  handle: string;
  name: string;
}

interface SettingsProps {
  onClose: () => void;
}

export function Settings({ onClose }: SettingsProps) {
  const [handles, setHandles] = useState<Handle[]>([]);
  const [loading, setLoading] = useState(true);
  const [newHandle, setNewHandle] = useState('');
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/handles')
      .then(r => r.json())
      .then(data => { setHandles(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const add = async () => {
    if (!newHandle.trim() || !newName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/handles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle: newHandle.trim(), name: newName.trim() }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      const created = await res.json();
      setHandles(h => [...h, created].sort((a, b) => a.name.localeCompare(b.name)));
      setNewHandle('');
      setNewName('');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    const res = await fetch(`/api/handles/${id}`, { method: 'DELETE' });
    if (res.ok) setHandles(h => h.filter(x => x.id !== id));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
      <div
        className="bg-[#111] border border-[#2a2a2a] rounded-2xl w-full max-w-md mx-4 p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Instagram className="w-5 h-5 text-indigo-400" />
            <h2 className="text-white font-semibold text-lg">Handles do Instagram</h2>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <p className="text-gray-500 text-sm text-center py-4">Carregando...</p>
        ) : (
          <ul className="space-y-2 mb-6 max-h-64 overflow-y-auto">
            {handles.map(h => (
              <li key={h.id} className="flex items-center justify-between bg-[#1a1a1a] rounded-xl px-4 py-2.5">
                <div>
                  <span className="text-white text-sm font-medium">{h.name}</span>
                  <span className="text-gray-500 text-xs ml-2">@{h.handle}</span>
                </div>
                <button
                  onClick={() => remove(h.id)}
                  className="text-gray-600 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="border-t border-[#2a2a2a] pt-4">
          <p className="text-xs text-gray-500 mb-3 uppercase tracking-wide">Adicionar concorrente</p>
          <div className="flex gap-2 mb-2">
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Nome (ex: Sense)"
              className="flex-1 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-indigo-500 placeholder:text-[#404040]"
            />
            <input
              value={newHandle}
              onChange={e => setNewHandle(e.target.value)}
              placeholder="@handle"
              className="flex-1 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-indigo-500 placeholder:text-[#404040]"
              onKeyDown={e => e.key === 'Enter' && add()}
            />
          </div>
          {error && <p className="text-red-400 text-xs mb-2">{error}</p>}
          <button
            onClick={add}
            disabled={saving || !newHandle.trim() || !newName.trim()}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium py-2 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            {saving ? 'Salvando...' : 'Adicionar'}
          </button>
        </div>
      </div>
    </div>
  );
}
