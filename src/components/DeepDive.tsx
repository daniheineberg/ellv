import { ArrowLeft, ExternalLink } from 'lucide-react';
import { NewsItem } from '../App';

interface DeepDiveProps {
  item: NewsItem;
  onBack: () => void;
}

export function DeepDive({ item, onBack }: DeepDiveProps) {
  return (
    <div className="max-w-3xl mx-auto p-6 pb-32 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <button 
        onClick={onBack}
        className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-8"
      >
        <ArrowLeft className="w-5 h-5" />
        Voltar para o feed
      </button>

      <div className="text-sm text-indigo-400 mb-3 flex items-center gap-2 font-medium">
        {item.date} • {item.source}
      </div>
      
      <h1 className="text-3xl font-bold leading-tight mb-6 text-white">
        {item.title}
      </h1>

      <div className="flex flex-wrap gap-2 mb-8">
        {item.tags.map((tag, index) => (
          <span 
            key={index} 
            className={`border px-3 py-1.5 rounded-md text-xs font-medium uppercase tracking-wide ${
              tag.type === 'positive' ? 'bg-green-500/10 border-green-500/30 text-green-500' :
              tag.type === 'negative' ? 'bg-red-500/10 border-red-500/30 text-red-500' :
              'bg-[#1a1a1a] border-[#2a2a2a] text-gray-400'
            }`}
          >
            {tag.label}
          </span>
        ))}
      </div>

      <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-6 mb-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
        <h2 className="text-lg font-semibold text-white mb-4">Análise de Impacto (Deep Dive)</h2>
        <div className="text-gray-300 leading-relaxed whitespace-pre-wrap">
          {item.summary}
        </div>
      </div>

      <a 
        href={item.url} 
        target="_blank" 
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 bg-[#1a1a1a] border border-[#2a2a2a] text-white px-6 py-3 rounded-xl hover:bg-[#2a2a2a] transition-colors font-medium"
      >
        Acessar fonte original
        <ExternalLink className="w-4 h-4" />
      </a>
    </div>
  );
}
