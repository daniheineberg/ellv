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

const INSTAGRAM_HANDLES = [
  'absolutebikes', 'isapabikes', 'gtabikes', 'tswbicycle',
  'sensebikes', 'lmbikes', 'wipbikes', 'clubeb2b',
];

const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8',
};

const SYSTEM_INSTRUCTION = `Voc\u00ea \u00e9 um assistente de intelig\u00eancia competitiva para a Elleven, empresa de bicicletas brasileira (faixa R$ 800-3000, foco em iniciantes e entusiastas no Brasil).\n\nAnalise o conte\u00fado extra\u00eddo dos sites e do Instagram dos concorrentes e gere um resumo executivo. Use APENAS fatos concretos presentes no conte\u00fado fornecido.\n\nPara cada informa\u00e7\u00e3o relevante encontrada (produto novo, promo\u00e7\u00e3o, pre\u00e7o, lan\u00e7amento), use EXATAMENTE este formato:\n\n### [T\u00edtulo objetivo]\n**Fonte:** [Para sites: Nome do site | Para Instagram: @handle] \u2022 [Data REAL encontrada no conte\u00fado - use formato DD/MM/AAAA. Se n\u00e3o encontrar data real, escreva exatamente: N\u00e3o achei data]\n**Link:** [URL exata indicada em PAGINA_URL da se\u00e7\u00e3o onde encontrou a informa\u00e7\u00e3o]\n**Concorrente:** [Nome da marca]\n\n[2-3 frases: O QUE foi encontrado, IMPACTO potencial para Elleven, CONTEXTO relevante]\n\n**Tags:** [\ud83d\udfe2 POSITIVO / \ud83d\udd34 NEGATIVO / \ud83d\udfe1 NEUTRO] | [CATEGORIA] | [SEGMENTO]\n\n---\n\nCATEGORIAS: PRODUTO | PRE\u00c7O | MARKETING | DISTRIBUI\u00c7\u00c3O | PARCERIA | OPERA\u00c7\u00d5ES | TECH | PERFORMANCE\nSEGMENTOS: MTB | URBANO | GRAVEL | INFANTIL | SPEED | E-BIKE | PE\u00c7AS\n\nREGRAS:\n- Use APENAS informa\u00e7\u00f5es presentes no conte\u00fado fornecido - nunca invente\n- Para datas: use SOMENTE datas do conte\u00fado HTML ou do campo DATA do Instagram. NUNCA use a data de hoje como data de publica\u00e7\u00e3o\n- Para Link: use SEMPRE a URL exata do [PAGINA_URL] da se\u00e7\u00e3o correspondente\n- Para Instagram: a Fonte deve ser o @handle (ex: @absolutebikes), n\u00e3o o nome completo\n- Se n\u00e3o encontrar nada relevante em um site ou perfil, n\u00e3o inclua aquele concorrente`;

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
  if (sections.length === 0) return `=== ${c.name} ===\nSite inacess\u00edvel.`;
  return `=== ${c.name} (${c.baseUrl}) ===\n${sections.slice(0, 3).join('\n\n')}`;
}

async function scrapeInstagram(): Promise<string> {
  const apiKey = process.env.APIFY_API_KEY;
  if (!apiKey) {
    console.log('[Backend] APIFY_API_KEY n\u00e3o configurada, pulando Instagram.');
    return '';
  }

  const urls = INSTAGRAM_HANDLES.map(h => `https://www.instagram.com/${h}/`);
  console.log(`[Backend] Buscando ${INSTAGRAM_HANDLES.length} perfis no Instagram via Apify...`);

  try {
    const response = await fetch(
      `https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${apiKey}&timeout=120`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          directUrls: urls,
          resultsType: 'posts',
          resultsLimit: 5,
        }),
        signal: AbortSignal.timeout(150000),
      }
    );

    if (!response.ok) {
      console.error(`[Backend] Apify retornou ${response.status}`);
      return '';
    }

    const posts: any[] = await response.json();
    console.log(`[Backend] ${posts.length} posts do Instagram recebidos.`);
    if (!posts.length) return '';

    const sections = posts.map(post => {
      const handle = post.ownerUsername || '';
      const date = post.timestamp
        ? new Date(post.timestamp).toLocaleDateString('pt-BR')
        : 'N\u00e3o achei data';
      const caption = (post.caption || '').substring(0, 600);
      const url = post.url || (post.shortCode ? `https://www.instagram.com/p/${post.shortCode}/` : '');
      return `[PAGINA_URL: ${url}]\n[PERFIL: @${handle}]\n[DATA: ${date}]\nCAPTION: ${caption}`;
    });

    return `=== INSTAGRAM DOS CONCORRENTES ===\n${sections.join('\n\n')}`;
  } catch (err: any) {
    console.error('[Backend] Erro no Apify:', err.message);
    return '';
  }
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
      const parts = raw.split('\u2022').map(p => p.trim());
      const dateIdx = parts.findIndex(p => p.includes('/') || p.toLowerCase().includes('n\u00e3o achei'));
      if (dateIdx !== -1) { date = parts[dateIdx]; source = parts.filter((_, j) => j !== dateIdx).join(' \u2022 '); }
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
        if (t.toLowerCase().includes('positivo') || t.includes('\ud83d\udfe2')) type = 'positive';
        else if (t.toLowerCase().includes('negativo') || t.includes('\ud83d\udd34')) type = 'negative';
        const label = t.replace(/[\ud83d\udfe2\ud83d\udd34\ud83d\udfe1*]/g, '').trim();
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

// POST /api/news/refresh - raspa sites + instagram e salva novidades no banco
app.post('/api/news/refresh', async (_req, res) => {
  try {
    console.log('[Backend] Scraping websites e Instagram...');
    const [scraped, instagramContent] = await Promise.all([
      Promise.all(COMPETITORS.map(scrapeCompetitor)),
      scrapeInstagram(),
    ]);

    const websiteContent = scraped.join('\n\n---\n\n');
    const content = instagramContent
      ? `${websiteContent}\n\n---\n\n${instagramContent}`
      : websiteContent;

    const today = new Date().toLocaleDateString('pt-BR');

    console.log('[Backend] Enviando para Gemini...');
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Analise o conteudo extraido dos websites e Instagram dos concorrentes da Elleven. Data de hoje (NAO use como data de publicacao): ${today}.\n\n${content}`,
      config: { systemInstruction: SYSTEM_INSTRUCTION, temperature: 0.1 },
    });

    const newItems = parseNewsMarkdown(response.text ?? '');
    console.log(`[Backend] ${newItems.length} itens encontrados.`);

    const { data: existing } = await supabase.from('news_items').select('title');
    const existingTitles = new Set((existing || []).map((r: any) => r.title.toLowerCase().trim()));
    const toInsert = newItems.filter(item => !existingTitles.has(item.title.toLowerCase().trim()));
    console.log(`[Backend] ${toInsert.length} itens novos para salvar.`);

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
