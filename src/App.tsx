/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Home, User, RefreshCw } from 'lucide-react';
import { useState, useEffect } from 'react';
import { NewsFeed } from './components/NewsFeed';
import { DeepDive } from './components/DeepDive';

export interface NewsItem {
  id: string;
  date: string;
  createdAt: string;
  source: string;
  sourceType: 'website' | 'instagram';
  title: string;
  summary: string;
  tags: { label: string; type: 'positive' | 'negative' | 'neutral' }[];
  url: string;
}

function mapDbItem(item: any): NewsItem {
  return {
    id: item.id,
    title: item.title,
    source: item.source,
    sourceType: item.source_type === 'instagram' ? 'instagram' : 'website',
    date: item.date,
    createdAt: item.created_at,
    summary: item.summary,
    tags: Array.isArray(item.tags) ? item.tags : [],
    url: item.url,
  };
}

export default function App() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeNewsItem, setActiveNewsItem] = useState<NewsItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newCount, setNewCount] = useState<number | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const loadFromDb = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/news');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setNews((data.items || []).map(mapDbItem));
      setLastUpdated(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    } catch (err: any) {
      console.error('Failed to load news from DB', err);
      setError('Erro ao carregar not\u00edcias. Verifique se o servidor backend est\u00e1 rodando.');
    } finally {
      setIsLoading(false);
    }
  };

  const refreshNews = async () => {
    setIsRefreshing(true);
    setError(null);
    setNewCount(null);
    try {
      const response = await fetch('/api/news/refresh', { method: 'POST' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setNews((data.items || []).map(mapDbItem));
      setNewCount(data.newCount ?? 0);
      setLastUpdated(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    } catch (err: any) {
      console.error('Failed to refresh news', err);
      setError('Erro ao buscar not\u00edcias. Verifique se o servidor backend est\u00e1 rodando.');
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadFromDb();
  }, []);

  const statusText = lastUpdated
    ? newCount !== null
      ? `${newCount} nova${newCount !== 1 ? 's' : ''} \u2022 atualizado ${lastUpdated}`
      : `atualizado ${lastUpdated}`
    : null;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#e5e5e5] font-sans pb-20">
      <header className="p-6 border-b border-[#1a1a1a] flex justify-between items-center">
        <div className="flex items-center">
          <svg height="28" viewBox="0 0 140 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-white">
            <path d="M 26 7 A 13 13 0 1 0 26 25" stroke="currentColor" strokeWidth="3.5" />
            <path d="M 13 12.5 L 26 12.5" stroke="currentColor" strokeWidth="3.5" />
            <path d="M 10 19.5 L 26 19.5" stroke="currentColor" strokeWidth="3.5" />
            <text x="36" y="25" fontFamily="sans-serif" fontWeight="800" fontSize="26" fill="currentColor" letterSpacing="-0.5">elleven</text>
          </svg>
        </div>
        <div className="flex items-center gap-3">
          {statusText && !isRefreshing && (
            <span className="text-xs text-gray-500">{statusText}</span>
          )}
          <button
            onClick={refreshNews}
            disabled={isRefreshing || isLoading}
            className="bg-transparent border border-[#2a2a2a] text-gray-400 px-4 py-2 rounded-lg text-sm hover:border-[#404040] hover:text-white transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Buscando...' : 'Atualizar'}
          </button>
        </div>
      </header>

      <main>
        {error && (
          <div className="max-w-3xl mx-auto px-6 mt-6">
            <div className="bg-red-900/30 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          </div>
        )}
        {activeNewsItem ? (
          <DeepDive item={activeNewsItem} onBack={() => setActiveNewsItem(null)} />
        ) : (
          <NewsFeed news={news} isLoading={isLoading || isRefreshing} onDeepDive={setActiveNewsItem} />
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-[#0a0a0a] border-t border-[#1a1a1a] flex justify-around py-3 z-20">
        <button
          onClick={() => setActiveNewsItem(null)}
          className="flex flex-col items-center gap-1 text-xs font-medium transition-colors text-white"
        >
          <Home className="w-6 h-6" />
          RESUMO
        </button>
        <button
          onClick={() => alert('Perfil em desenvolvimento')}
          className="flex flex-col items-center gap-1 text-gray-500 text-xs font-medium transition-colors hover:text-gray-300"
        >
          <User className="w-6 h-6" />
          PERFIL
        </button>
      </nav>
    </div>
  );
}
