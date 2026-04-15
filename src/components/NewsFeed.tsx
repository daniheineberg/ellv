import { Search, Loader2, ArrowRight, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { NewsItem } from '../App';

interface NewsFeedProps {
  news: NewsItem[];
  isLoading: boolean;
  onDeepDive: (item: NewsItem) => void;
}

function parseDateBR(dateStr: string): number {
  if (!dateStr || dateStr.toLowerCase().includes('n\u00e3o achei')) return 0;
  const parts = dateStr.split('/');
  if (parts.length !== 3) return 0;
  const [d, m, y] = parts;
  const ts = new Date(+y, +m - 1, +d).getTime();
  return isNaN(ts) ? 0 : ts;
}

export function NewsFeed({ news, isLoading, onDeepDive }: NewsFeedProps) {
  const [activeTab, setActiveTab] = useState('Website');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const filteredNews = news
    .filter(item => {
      const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            item.summary.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesTab = activeTab === 'Website' ? item.sourceType === 'website' : item.sourceType === 'instagram';
      const matchesTag = activeTag ? item.tags.some(t => t.label === activeTag) : true;
      return matchesSearch && matchesTab && matchesTag;
    })
    .sort((a, b) => {
      const ta = parseDateBR(a.date);
      const tb = parseDateBR(b.date);
      if (ta !== 0 || tb !== 0) {
        if (ta === 0) return 1;
        if (tb === 0) return -1;
        if (tb !== ta) return tb - ta;
      }
      // tiebreaker: mais recentemente adicionado ao banco primeiro
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  return (
    <div className="max-w-3xl mx-auto p-6 pb-32">
      <h1 className="text-4xl font-bold mb-8 tracking-tight text-white">headlines</h1>

      <div className="flex gap-6 mb-8 border-b border-[#1a1a1a]">
        {['Website', 'Instagram'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`bg-transparent border-none text-base font-medium py-3 relative transition-colors hover:text-gray-300 ${
              activeTab === tab 
                ? 'text-white after:content-[""] after:absolute after:bottom-[-1px] after:left-0 after:right-0 after:h-[2px] after:bg-white' 
                : 'text-gray-500'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#404040] w-5 h-5" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar not\u00edcias..."
          className="w-full bg-[#111] border border-[#1a1a1a] rounded-xl py-3.5 pl-11 pr-4 text-white text-sm outline-none focus:border-[#2a2a2a] transition-colors placeholder:text-[#404040]"
        />
      </div>

      {activeTag && (
        <div className="mb-6 flex items-center gap-2">
          <span className="text-sm text-gray-400">Filtrando por tag:</span>
          <button 
            onClick={() => setActiveTag(null)}
            className="bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 hover:bg-indigo-500/30 transition-colors"
          >
            {activeTag} <span className="text-lg leading-none">&times;</span>
          </button>
        </div>
      )}

      <div className="space-y-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500 gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            <p>Analisando mercado e gerando intelig\u00eancia competitiva...</p>
          </div>
        ) : filteredNews.length > 0 ? (
          filteredNews.map((item) => (
            <div 
              key={item.id} 
              className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-6 cursor-pointer transition-all hover:border-[#2a2a2a] hover:-translate-y-0.5 relative group"
              onClick={() => onDeepDive(item)}
            >
              <div className="text-sm text-gray-500 mb-3 flex items-center gap-2">
                {item.date} \u2022 {item.source}
              </div>
              <div className="text-xl font-semibold leading-snug mb-4 text-white pr-20">
                {item.title}
              </div>
              <div className="flex flex-wrap gap-2">
                {item.tags.map((tag, index) => (
                  <span 
                    key={index} 
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveTag(activeTag === tag.label ? null : tag.label);
                    }}
                    className={`border px-3 py-1.5 rounded-md text-xs font-medium uppercase tracking-wide cursor-pointer hover:opacity-80 transition-all ${
                      tag.type === 'positive' ? 'bg-green-500/10 border-green-500/30 text-green-500' :
                      tag.type === 'negative' ? 'bg-red-500/10 border-red-500/30 text-red-500' :
                      'bg-[#1a1a1a] border-[#2a2a2a] text-gray-400'
                    } ${activeTag === tag.label ? 'ring-2 ring-indigo-500 ring-offset-1 ring-offset-[#111]' : ''}`}
                  >
                    {tag.label}
                  </span>
                ))}
              </div>
              
              <div className="absolute right-6 top-6 flex items-center gap-3">
                <a 
                  href={item.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-[#404040] hover:text-indigo-400 transition-colors p-2 -m-2"
                  title="Acessar fonte original"
                >
                  <ExternalLink className="w-5 h-5" />
                </a>
                <div className="text-[#404040] group-hover:text-white transition-colors p-2 -m-2">
                  <ArrowRight className="w-5 h-5" />
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center text-gray-500 py-12">
            Nenhuma not\u00edcia encontrada para os filtros atuais.
          </div>
        )}
      </div>
    </div>
  );
}
