import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';

const COMPETITORS = [
  { name: 'Absolute', baseUrl: 'https://absolutebikes.com.br' },
  { name: 'Isapa', baseUrl: 'https://isapa.com.br' },
  { name: 'GTA / Julio Ando', baseUrl: 'https://julioando.com.br' },
  { name: 'TSW', baseUrl: 'https://tswbike.com' },
  { name: 'Sense', baseUrl: 'https://www.sensebike.com.br' },
  { name: 'LM Bikes', baseUrl: 'https://portal.lmbike.com.br/glstorefront/glbikes/pt/BRL' },
  { name: 'Wip Bikes', baseUrl: 'https://www.wipb2b.com.br' },
  { name: 'Clube B2B', baseUrl: 'https://clubeb2b.com.br' },
  { name: 'Clube B2B Blog', baseUrl: 'https://blog.clubeb2b.com.br' },
];

const INSTAGRAM_HANDLES = ['absolutebike','isapabike','gtabike','tswbike','sensebike','lmbikeoficial','wipbikes','b2bclube'];

const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8',
};

const SYSTEM_INSTRUCTION = `Você é um assistente de inteligência competitiva para a Elleven, empresa de bicicletas brasileira (faixa R$ 800-3000, foco em iniciantes e entusiastas no Brasil).

Analise o conteúdo extraído dos sites e do Instagram dos concorrentes e gere um resumo executivo. Use APENAS fatos concretos presentes no conteúdo fornecido.

Para cada informação relevante encontrada (produto novo, promoção, preço, lançamento), use EXATAMENTE este formato:

### [Título objetivo]
**Fonte:** [Para sites: Nome do site | Para Instagram: @handle] • [Data REAL encontrada no conteúdo - use formato DD/MM/AAAA. Se não encontrar data real, escreva exatamente: Não achei data]
**Link:** [URL exata indicada em PAGINA_URL da seção onde encontrou a informação]
**Concorrente:** [Nome da marca]

[2-3 frases: O QUE foi encontrado, IMPACTO potencial para Elleven, CONTEXTO relevante]

**Tags:** [🟢 POSITIVO / 🔴 NEGATIVO / 🟡 NEUTRO] | [CATEGORIA] | [SEGMENTO]

---

CATEGORIAS: PRODUTO | PREÇO | MARKETING | DISTRIBUIÇÃO | PARCERIA | OPERAÇÕES | TECH | PERFORMANCE
SEGMENTOS: MTB | URBANO | GRAVEL | INFANTIL | SPEED | E-BIKE | PEÇAS

REGRAS:
- Use APENAS informações presentes no conteúdo fornecido - nunca invente
- Para datas: use SOMENTE datas do conteúdo HTML ou do campo DATA do Instagram
- Para Link: use SEMPRE a URL exata do [PAGINA_URL]
- Se não encontrar nada relevante, não inclua aquele concorrente`;

function getSupabase() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);
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

function extractDates(html: string): string {
  const dates: string[] = [];
  for (const match of html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const data = JSON.parse(match[1]);
      for (const field of ['datePublished', 'dateModified', 'dateCreated']) {
        if (data[field]) dates.push(`[JSON-LD ${field}]: ${data[field]}`);
      }
    } catch {}
  }
  const metaPattern = /meta[^>]*(?:property|name)="(?:article:published_time|date|pubdate)"[^>]*content="([^"]+)"/gi;
  for (const m of html.matchAll(metaPattern)) dates.push(`[meta date]: ${m[1]}`);
  return dates.length > 0 ? `\nDATAS:\n${dates.join('\n')}` : '';
}

async function fetchPage(url: string) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000), headers: FETCH_HEADERS });
    if (!res.ok) return null;
    const html = await res.text();
    const text = extractText(html);
    return text.length > 150 ? { text, dates: extractDates(html), html } : null;
  } catch { return null; }
}

async function fetchWPPosts(baseUrl: string): Promise<string[]> {
  try {
    const res = await fetch(`${baseUrl}/wp-json/wp/v2/posts?per_page=5&_fields=link`, { signal: AbortSignal.timeout(8000), headers: FETCH_HEADERS });
    if (!res.ok) return [];
    const posts = await res.json();
    return Array.isArray(posts) ? posts.map((p: any) => p.link).filter(Boolean) : [];
  } catch { return []; }
}

async function scrapeCompetitor(c: { name: string; baseUrl: string }): Promise<string> {
  const sections: string[] = [];
  const home = await fetchPage(c.baseUrl);
  if (home) sections.push(`[PAGINA_URL: ${c.baseUrl}]\n${home.text}${home.dates}`);

  const wpPosts = await fetchWPPosts(c.baseUrl);
  const listingPaths = ['/blog', '/noticias', '/novidades', '/lancamentos'];
  const htmlLinks: string[] = [];

  const listingResults = await Promise.all(listingPaths.map(p => fetchPage(c.baseUrl + p)));
  listingResults.forEach((result, i) => {
    if (result) {
      const url = c.baseUrl + listingPaths[i];
      sections.push(`[PAGINA_URL: ${url}]\n${result.text}${result.dates}`);
      for (const match of result.html.matchAll(/href=["']([^"'#]+)["']/gi)) {
        let href = match[1].split('?')[0];
        if (!href || href.startsWith('//') || href.startsWith('mailto:')) continue;
        if (href.startsWith('/')) href = c.baseUrl + href;
        if (!href.startsWith(c.baseUrl) || href === c.baseUrl || href === url) continue;
        if (href.match(/\.(css|js|jpg|png|gif|svg|ico|pdf|webp|woff|woff2)$/i)) continue;
        if (href.match(/\/(wp-content|wp-json|wp-admin|category|tag|page\/\d|feed|cart|checkout)\b/i)) continue;
        const slug = href.replace(c.baseUrl, '').replace(/\/$/, '').split('/').pop() || '';
        if (slug.length > 8) htmlLinks.push(href);
      }
    }
  });

  const articles = [...new Set([...wpPosts, ...htmlLinks])].slice(0, 5);
  if (articles.length > 0) {
    const results = await Promise.all(articles.map(url => fetchPage(url)));
    results.forEach((result, i) => {
      if (result) sections.push(`[PAGINA_URL: ${articles[i]}]\n${result.text}${result.dates}`);
    });
  }

  return sections.length === 0 ? `=== ${c.name} ===\nSite inacessível.` : `=== ${c.name} (${c.baseUrl}) ===\n${sections.slice(0, 7).join('\n\n')}`;
}

async function scrapeInstagram(supabase: ReturnType<typeof getSupabase>): Promise<string> {
  const apiKey = process.env.APIFY_API_KEY;
  if (!apiKey) return '';
  const { data } = await supabase.from('instagram_handles').select('handle');
  const handles = data?.map((h: any) => h.handle) ?? INSTAGRAM_HANDLES;
  const urls = handles.map((h: string) => `https://www.instagram.com/${h}/`);
  try {
    const response = await fetch(
      `https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${apiKey}&timeout=120`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ directUrls: urls, resultsType: 'posts', resultsLimit: 5 }), signal: AbortSignal.timeout(150000) }
    );
    if (!response.ok) return '';
    const posts: any[] = await response.json();
    if (!posts.length) return '';
    return `=== INSTAGRAM DOS CONCORRENTES ===\n${posts.map(post => {
      const handle = post.ownerUsername || '';
      const date = post.timestamp ? new Date(post.timestamp).toLocaleDateString('pt-BR') : 'Não achei data';
      const caption = (post.caption || '').substring(0, 600);
      const url = post.url || (post.shortCode ? `https://www.instagram.com/p/${post.shortCode}/` : '');
      return `[PAGINA_URL: ${url}]\n[PERFIL: @${handle}]\n[DATA: ${date}]\nCAPTION: ${caption}`;
    }).join('\n\n')}`;
  } catch { return ''; }
}

function parseNewsMarkdown(markdown: string): any[] {
  const items: any[] = [];
  for (let i = 1; i < markdown.split('### ').length; i++) {
    const lines = markdown.split('### ')[i].split('\n').map(l => l.trim()).filter(l => l);
    if (!lines.length) continue;
    const title = lines[0].replace(/^\*+|\*+$/g, '').trim();
    let source = '', date = '', sourceType = 'website', url = '';
    const sourceLine = lines.find(l => l.startsWith('**Fonte:**'));
    if (sourceLine) {
      const raw = sourceLine.replace(/\*?Fonte:\*?\s*/i, '').replace(/\*/g, '');
      const parts = raw.split('•').map(p => p.trim());
      const dateIdx = parts.findIndex(p => p.includes('/') || p.toLowerCase().includes('não achei'));
      if (dateIdx !== -1) { date = parts[dateIdx]; source = parts.filter((_, j) => j !== dateIdx).join(' • '); }
      else { source = parts[0] || ''; date = parts[1] || ''; }
      if (source.includes('@')) sourceType = 'instagram';
    }
    const linkLine = lines.find(l => l.startsWith('**Link:**'));
    if (linkLine) {
      let parsedUrl = linkLine.replace(/\*?Link:\*?\s*/i, '').trim();
      const mdUrl = parsedUrl.match(/\[.*?\]\((.*?)\)/);
      if (mdUrl) parsedUrl = mdUrl[1];
      if (parsedUrl && !parsedUrl.startsWith('http') && parsedUrl.includes('.')) parsedUrl = 'https://' + parsedUrl;
      if (parsedUrl.startsWith('http')) url = parsedUrl;
    }
    if (!url) url = source.includes('@') ? `https://instagram.com/${(source.match(/@([\w.]+)/) || [])[1] || ''}` : `https://google.com/search?q=${encodeURIComponent(title)}`;
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
    items.push({ title, source, source_type: sourceType, date, summary: lines.slice(summaryStart, summaryEnd).join('\n'), tags, url });
  }
  return items;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = req.url || '';
  const supabase = getSupabase();

  // GET /api/health
  if (url === '/api/health' || url === '/api/health/') {
    return res.json({ ok: true, env: { GEMINI: !!process.env.GEMINI_API_KEY, SUPABASE_URL: !!process.env.SUPABASE_URL, SUPABASE_KEY: !!process.env.SUPABASE_ANON_KEY, APIFY: !!process.env.APIFY_API_KEY } });
  }

  // GET /api/news
  if (url === '/api/news' && req.method === 'GET') {
    try {
      const { data, error } = await supabase.from('news_items').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return res.json({ items: data || [] });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  // POST /api/news/refresh
  if (url.includes('/api/news/refresh') && req.method === 'POST') {
    try {
      const [scraped, instagramContent] = await Promise.all([
        Promise.all(COMPETITORS.map(scrapeCompetitor)),
        scrapeInstagram(supabase),
      ]);
      const content = [scraped.join('\n\n---\n\n'), instagramContent].filter(Boolean).join('\n\n---\n\n');
      const today = new Date().toLocaleDateString('pt-BR');
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Analise o conteudo extraido dos websites e Instagram dos concorrentes da Elleven. Data de hoje (NAO use como data de publicacao): ${today}.\n\n${content}`,
        config: { systemInstruction: SYSTEM_INSTRUCTION, temperature: 0.1 },
      });
      const newItems = parseNewsMarkdown(response.text ?? '');
      const { data: existing } = await supabase.from('news_items').select('title');
      const existingTitles = new Set((existing || []).map((r: any) => r.title.toLowerCase().trim()));
      const toInsert = newItems.filter(item => !existingTitles.has(item.title.toLowerCase().trim()));
      if (toInsert.length > 0) await supabase.from('news_items').insert(toInsert);
      await supabase.from('scrape_log').insert({ items_found: newItems.length, items_new: toInsert.length });
      const { data: all } = await supabase.from('news_items').select('*').order('created_at', { ascending: false });
      return res.json({ items: all || [], newCount: toInsert.length });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  // GET /api/handles
  if (url.includes('/api/handles') && req.method === 'GET') {
    const { data, error } = await supabase.from('instagram_handles').select('*').order('name');
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data || []);
  }

  // POST /api/handles
  if (url.includes('/api/handles') && req.method === 'POST') {
    const { handle, name } = req.body || {};
    if (!handle || !name) return res.status(400).json({ error: 'handle e name são obrigatórios' });
    const clean = handle.replace(/^@/, '');
    const { data, error } = await supabase.from('instagram_handles').insert({ handle: clean, name }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  }

  // DELETE /api/handles/:id
  if (url.includes('/api/handles/') && req.method === 'DELETE') {
    const id = url.split('/api/handles/')[1]?.replace(/\/$/, '');
    const { error } = await supabase.from('instagram_handles').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  }

  return res.status(404).json({ error: 'Not found' });
}
