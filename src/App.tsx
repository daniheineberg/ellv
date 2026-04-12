/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Home, User, RefreshCw } from 'lucide-react';
import { useState, useEffect } from 'react';
import { NewsFeed } from './components/NewsFeed';
import { DeepDive } from './components/DeepDive';
import { generateSummary } from './lib/gemini';

export interface NewsItem {
  id: string;
  date: string;
  source: string;
  sourceType: 'website' | 'instagram';
  title: string;
  summary: string;
  tags: { label: string; type: 'positive' | 'negative' | 'neutral' }[];
  url: string;
}

function parseNewsMarkdown(markdown: string): NewsItem[] {
  const items: NewsItem[] = [];
  const sections = markdown.split('### ');
  
  for (let i = 1; i < sections.length; i++) {
    const section = sections[i];
    const lines = section.split('\n').map(l => l.trim()).filter(l => l);
    
    if (lines.length === 0) continue;
    
    const title = lines[0].replace(/^\*+|\*+$/g, '').trim();
    
    let source = '';
    let date = '';
    let sourceType: 'website' | 'instagram' = 'website';
    
    const sourceLine = lines.find(l => l.startsWith('**Fonte:**') || l.startsWith('Fonte:'));
    if (sourceLine) {
      const sourceRaw = sourceLine.replace(/\*?Fonte:\*?\s*/i, '').replace(/\*/g, '');
      const parts = sourceRaw.split('•').map(p => p.trim());
      
      const datePartIndex = parts.findIndex(p => p.includes('/'));
      if (datePartIndex !== -1) {
        date = parts[datePartIndex];
        source = parts.filter((_, i) => i !== datePartIndex).join(' • ');
      } else {
        source = parts[0] || '';
        date = parts[1] || '';
      }

      if (source.toLowerCase().includes('instagram') || source.includes('@')) {
        sourceType = 'instagram';
      }
    }

    let url = '';
    const linkLine = lines.find(l => l.startsWith('**Link:**') || l.startsWith('Link:'));
    if (linkLine) {
      const parsedUrl = linkLine.replace(/\*?Link:\*?\s*/i, '').trim();
      if (parsedUrl.startsWith('http')) {
        url = parsedUrl;
      }
    }

    if (!url) {
      if (source.toLowerCase().includes('instagram')) {
        const handleMatch = source.match(/@([\w.]+)/);
        if (handleMatch) {
          url = `https://instagram.com/${handleMatch[1]}`;
        } else {
          url = `https://instagram.com/explore/tags/${encodeURIComponent(title.split(' ')[0])}`;
        }
      } else {
        url = `https://google.com/search?q=${encodeURIComponent(title + ' ' + source)}`;
      }
    }
    
    const tagsLine = lines.find(l => l.toLowerCase().includes('tags:'));
    const tags: { label: string; type: 'positive' | 'negative' | 'neutral' }[] = [];
    if (tagsLine) {
      const tagsRaw = tagsLine.replace(/.*tags:\s*/i, '').split('|').map(t => t.trim());
      tagsRaw.forEach(t => {
        let type: 'positive' | 'negative' | 'neutral' = 'neutral';
        const lowerT = t.toLowerCase();
        if (lowerT.includes('positivo') || lowerT.includes('🟢')) type = 'positive';
        else if (lowerT.includes('negativo') || lowerT.includes('🔴')) type = 'negative';
        else if (lowerT.includes('neutro') || lowerT.includes('🟡')) type = 'neutral';
        
        const label = t.replace(/[🟢🔴🟡*]/g, '').trim();
        if (label) {
          tags.push({ label, type });
        }
      });
    }
    
    const summaryStartIndex = lines.findIndex(l => l.startsWith('**Concorrente:**') || l.startsWith('Concorrente:')) + 1;
    let summaryEndIndex = lines.findIndex(l => l.toLowerCase().includes('tags:'));
    if (summaryEndIndex === -1) summaryEndIndex = lines.length;
    
    const summary = lines.slice(summaryStartIndex, summaryEndIndex).join('\n');
    
    items.push({
      id: Math.random().toString(36).substring(7),
      title,
      source,
      sourceType,
      date,
      summary,
      tags,
      url
    });
  }
  
  return items;
}

export default function App() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeNewsItem, setActiveNewsItem] = useState<NewsItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchNews = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const today = new Date().toLocaleDateString('pt-BR');
      const markdown = await generateSummary(`Gerar resumo diário de notícias dos concorrentes da Elleven para ${today}. Por favor, invente 4-5 notícias realistas para o dia de hoje para fins de demonstração.`);
      const parsedNews = parseNewsMarkdown(markdown);
      if (parsedNews.length > 0) {
        setNews(parsedNews);
      } else {
        setNews([]);
      }
    } catch (err: any) {
      console.error("Failed to fetch news", err);
      if (err?.status === 429 || err?.message?.includes('429') || err?.message?.includes('RESOURCE_EXHAUSTED')) {
        setError('Limite de requisições da API atingido. Tente novamente mais tarde.');
      } else {
        setError('Erro ao buscar notícias. Tente novamente mais tarde.');
      }
      setNews([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNews();
  }, []);

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
        <button 
          onClick={fetchNews}
          disabled={isLoading}
          className="bg-transparent border border-[#2a2a2a] text-gray-400 px-4 py-2 rounded-lg text-sm hover:border-[#404040] hover:text-white transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
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
          <NewsFeed news={news} isLoading={isLoading} onDeepDive={setActiveNewsItem} />
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

