import express from 'express';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

const COMPETITORS = [
  { name: 'Absolute', baseUrl: 'https://absolutebikes.com.br', extraPaths: ['/blog', '/noticias', '/novidades', '/lancamentos', '/bicicletas', '/produtos'] },
  { name: 'Isapa', baseUrl: 'https://isapa.com.br', extraPaths: ['/blog', '/noticias', '/novidades', '/lancamentos', '/bicicletas', '/produtos'] },
  { name: 'GTA', baseUrl: 'https://gtabikes.com.br', extraPaths: ['/blog', '/noticias', '/novidades', '/lancamentos', '/bicicletas', '/produtos'] },
  { name: 'TSW', baseUrl: 'https://tswbicycle.com.br', extraPaths: ['/blog', '/noticias', '/novidades', '/lancamentos', '/bicicletas', '/produtos'] },
  { name: 'Sense', baseUrl: 'https://sensebikes.com.br', extraPaths: ['/blog', '/noticias', '/novidades', '/lancamentos', '/bicicletas', '/produtos'] },
  { name: 'LM Bikes', baseUrl: 'https://lmbikes.com.br', extraPaths: ['/blog', '/noticias', '/novidades', '/lancamentos', '/bicicletas', '/produtos'] },
  { name: 'Wip Bikes', baseUrl: 'https://wipbikes.com.br', extraPaths: ['/blog', '/noticias', '/novidades', '/lancamentos', '/bicicletas', '/produtos'] },
  { name: 'Clube B2B', baseUrl: 'https://clubeb2b.com.br', extraPaths: ['/blog', '/noticias', '/novidades', '/lancamentos', '/produtos'] },
];

const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8',
};

const SYSTEM_INSTRUCTION = `Você é um assistente de inteligência competitiva para a Elleven, empresa de bicicletas brasileira (faixa R$ 800-3000, foco em iniciantes e entusiastas no Brasil).

Analise o conteúdo HTML extraído dos sites dos concorrentes e gere um resumo executivo. Use APENAS fatos concretos presentes no conteúdo fornecido.

Para cada informação relevante encontrada (produto novo, promoção, preço, lançamento), use EXATAMENTE este formato:

### [Título objetivo]
**Fonte:** [Nome do site] • [Data REAL encontrada no conteúdo - use formato DD/MM/AAAA. Se não encontrar data real, deixe em branco]
**Link:** [URL exata indicada em PAGINA_URL da seção onde encontrou a informação]
**Concorrente:** [Nome da marca]

[2-3 frases: O QUE foi encontrado, IMPACTO potencial para Elleven, CONTEXTO relevante]

**Tags:** [🟢 POSITIVO / 🔴 NEGATIVO / 🟡 NEUTRO] | [CATEGORIA] | [SEGMENTO]

---

CATEGORIAS: PRODUTO | PREÇO | MARKETING | DISTRIBUIÇÃO | PARCERIA | OPERAÇÕES | TECH | PERFORMANCE
SEGMENTOS: MTB | URBANO | GRAVEL | INFANTIL | SPEED | E-BIKE | PEÇAS

REGRAS:
- Use APENAS informações presentes no conteúdo fornecido - nunca invente
- Para datas: use SOMENTE datas do conteúdo HTML. NUNCA use a data de hoje como data de publicação
- Para Link: use SEMPRE a URL exata do [PAGINA_URL] da seção correspondente
- Se não encontrar nada relevante em um site, não inclua aquele site`;

function extractDates(html: string): string {
  const dates: string[] = [];
  const jsonLdMatches = html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
  for (const match of jsonLdMatches) {
    try {
      const data = JSON.parse(match[1]);
      for (const field of ['datePublished', 'dateModified', 'dateCreated']) {
        if (data[field]) dates.push(`[JSON-LD ${field}]: ${data[field]}`);
      }
    } catch {}
  }
  const metaPattern = /meta[^>]*(?:property|name)="(?:article:published_time|date|pubdate)"[^>]*content="([^"]+)"/gi;
  for (const m of html.matchAll(metaPattern)) dates.push(`[meta date]: ${m[1]}`);
  const textMatches = [...html.matchAll(/\b(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})\b/g)].slice(0, 5);
  for (const m of textMatches) dates.push(`[text date]: ${m[0]}`);
  return dates.length > 0 ? `\nDATAS:\n${dates.join('\n')}` : '';
}

function extractText(html: string, maxChars = 2500): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, maxChars);
}

async function fetchPage(url: string): Promise<{ text: string; dates: string } | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000), headers: FETCH_HEADERS });
    if (!res.ok) return null;
    const html = await res.text();
    const text = extractText(html);
    return text.length > 150 ? { text, dates: extractDates(html) } : null;
  } catch { return null; }
}

async function scrapeCompetitor(c: { name: string; baseUrl: string; extraPaths: string[] }): Promise<string> {
  const urls = [c.baseUrl, ...c.extraPaths.map(p => c.baseUrl + p)];
  const results = await Promise.all(urls.map(url => fetchPage(url)));
  const sections: string[] = [];
  results.forEach((result, i) => {
    if (result) {
      const fullUrl = i === 0 ? c.baseUrl : c.baseUrl + c.extraPaths[i - 1];
      sections.push(`[PAGINA_URL: ${fullUrl}]\n${result.text}${result.dates}`);
    }
  });
  if (sections.length === 0) return `=== ${c.name} ===\nSite inacessível.`;
  return `=== ${c.name} (${c.baseUrl}) ===\n${sections.slice(0, 3).join('\n\n')}`;
}

function parseNewsMarkdown(markdown: string): any[] {
  const items: any[] = [];
  const sections = markdown.split('### ');
  for (let i = 1; i < sections.length; i++) {
    const lines = sections[i].split('\n').map(l => l.trim()).filter(l => l);
    if (!lines.length) continue;
    const title = lines[0].replace(/^\*+|\*+$/g, '').trim();
    let source = '', date = '', sourceType = 'website', url = '';

    const sourceLine = lines.find(l => l.startsWith('**Fonte:**'));
    if (sourceLine) {
      const raw = sourceLine.replace(/\*?Fonte:\*?\s*/i, '').replace(/\*/g, '');
      const parts = raw.split('•').map(p => p.trim());
      const dateIdx = parts.findIndex(p => p.includes('/'));
      if (dateIdx !== -1) { date = parts[dateIdx]; source = parts.filter((_, j) => j !== dateIdx).join(' • '); }
      else { source = parts[0] || ''; date = parts[1] || ''; }
      if (source.toLowerCase().includes('instagram') || source.includes('@')) sourceType = 'instagram';
    }

    const linkLine = lines.find(l => l.startsWith('**Link:**'));
    if (linkLine) {
      let parsedUrl = linkLine.replace(/\*?Link:\*?\s*/i, '').trim();
      const mdUrl = parsedUrl.match(/\[.*?\]\((.*?)\)/);
      if (mdUrl) parsedUrl = mdUrl[1];
      if (parsedUrl && !parsedUrl.startsWith('http') && parsedUrl.includes('.')) parsedUrl = 'https://' + parsedUrl;
      if (parsedUrl.startsWith('http')) url = parsedUrl;
    }

    if (!url) url = source.includes('@')
      ? `https://instagram.com/${(source.match(/@([\w.]+)/) || [])[1] || ''}`
      : `https://google.com/search?q=${encodeURIComponent(title + ' ' + source)}`;

    const tagsLine = lines.find(l => l.toLowerCase().includes('tags:'));
    const tags: any[] = [];
    if (tagsLine) {
      tagsLine.replace(/.*tags:\s*/i, '').split('|').map(t => t.trim()).forEach(t => {
        let type = 'neutral';
        if (t.toLowerCase().includes('positivo') || t.includes('🟢')) type = 'positive';
        else if (t.toLowerCase().includes('negativo') || t.includes('🔴')) type = 'negative';
        const label = t.replace(/[🟢🔴🟡*]/g, '').trim();
        if (label) tags.push({ label, type });
      });
    }

    const summaryStart = lines.findIndex(l => l.startsWith('**Concorrente:**')) + 1;
    let summaryEnd = lines.findIndex(l => l.toLowerCase().includes('tags:'));
    if (summaryEnd === -1) summaryEnd = lines.length;
    const summary = lines.slice(summaryStart, summaryEnd).join('\n');

    items.push({ id: Math.random().toString(36).substring(7), title, source, source_type: sourceType, date, summary, tags, url });
  }
  return items;
}

// GET /api/news - retorna do banco (rapido, sem scraping)
app.get('/api/news', async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from('news_items')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ items: data || [] });
  } catch (err: any) {
    console.error('[Backend] DB error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/news/refresh - raspa sites e salva novidades no banco
app.post('/api/news/refresh', async (_req, res) => {
  try {
    console.log('[Backend] Scraping competitor websites...');
    const scraped = await Promise.all(COMPETITORS.map(scrapeCompetitor));
    const content = scraped.join('\n\n---\n\n');
    const today = new Date().toLocaleDateString('pt-BR');

    console.log('[Backend] Sending to Gemini...');
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Analise o conteudo extraido dos websites dos concorrentes da Elleven. Data de hoje (NAO use como data de publicacao): ${today}.\n\n${content}`,
      config: { systemInstruction: SYSTEM_INSTRUCTION, temperature: 0.1 },
    });

    const newItems = parseNewsMarkdown(response.text ?? '');
    console.log(`[Backend] Found ${newItems.length} items from scraping.`);

    const { data: existing } = await supabase.from('news_items').select('title');
    const existingTitles = new Set((existing || []).map((r: any) => r.title.toLowerCase().trim()));
    const toInsert = newItems.filter(item => !existingTitles.has(item.title.toLowerCase().trim()));
    console.log(`[Backend] ${toInsert.length} new items to save.`);

    if (toInsert.length > 0) {
      await supabase.from('news_items').insert(toInsert);
    }
    await supabase.from('scrape_log').insert({ items_found: newItems.length, items_new: toInsert.length });

    const { data: all } = await supabase.from('news_items').select('*').order('created_at', { ascending: false });
    res.json({ items: all || [], newCount: toInsert.length });
  } catch (err: any) {
    console.error('[Backend] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

const PORT = 3001;
app.listen(PORT, () => console.log(`\u2713 Backend rodando na porta ${PORT}`));
