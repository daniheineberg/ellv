import express from 'express';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const COMPETITORS = [
  { name: 'Absolute', baseUrl: 'https://absolutebikes.com.br' },
  { name: 'Isapa', baseUrl: 'https://isapa.com.br' },
  { name: 'GTA', baseUrl: 'https://gtabikes.com.br' },
  { name: 'TSW', baseUrl: 'https://tswbicycle.com.br' },
  { name: 'Sense', baseUrl: 'https://sensebikes.com.br' },
  { name: 'LM Bikes', baseUrl: 'https://lmbikes.com.br' },
  { name: 'Wip Bikes', baseUrl: 'https://wipbikes.com.br' },
  { name: 'Clube B2B', baseUrl: 'https://clubeb2b.com.br' },
];

const EXTRA_PATHS = ['/blog', '/noticias', '/novidades', '/lancamentos', '/promocoes'];

const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8',
};

const SYSTEM_INSTRUCTION = `Você é um assistente de inteligência competitiva para a Elleven, empresa de bicicletas brasileira (faixa R$ 800-3000, foco em iniciantes e entusiastas no Brasil).

Analise o conteúdo HTML extraído dos sites dos concorrentes e gere um resumo executivo. Use APENAS fatos concretos presentes no conteúdo fornecido.

Para cada informação relevante encontrada (produto novo, promoção, preço, lançamento), use EXATAMENTE este formato:

### [Título objetivo]
**Fonte:** [Nome do site] • [Data se disponível no conteúdo]
**Link:** [URL da página onde foi encontrado]
**Concorrente:** [Nome da marca]

[2-3 frases: O QUE foi encontrado, IMPACTO potencial para Elleven, CONTEXTO relevante]

**Tags:** [🟢 POSITIVO / 🔴 NEGATIVO / 🟡 NEUTRO] | [CATEGORIA] | [SEGMENTO]

---

CATEGORIAS: PRODUTO | PREÇO | MARKETING | DISTRIBUIÇÃO | PARCERIA | OPERAÇÕES | TECH | PERFORMANCE
SEGMENTOS: MTB | URBANO | GRAVEL | INFANTIL | SPEED | E-BIKE | PEÇAS

REGRAS IMPORTANTES:
- Use APENAS informações presentes no conteúdo fornecido - nunca invente
- Se não encontrar nada relevante em um site, simplesmente não inclua aquele site
- Foque em: novos produtos, preços, promoções, lançamentos, campanhas
- Seja objetivo e acionável`;

function extractText(html: string, maxChars = 2500): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, maxChars);
}

async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: FETCH_HEADERS,
    });
    if (!res.ok) return null;
    const html = await res.text();
    const text = extractText(html);
    return text.length > 150 ? text : null;
  } catch {
    return null;
  }
}

async function scrapeCompetitor(c: { name: string; baseUrl: string }): Promise<string> {
  const urls = [c.baseUrl, ...EXTRA_PATHS.map(p => c.baseUrl + p)];
  const results = await Promise.all(urls.map(url => fetchPage(url)));

  const labels = ['homepage', ...EXTRA_PATHS];
  const sections: string[] = [];

  results.forEach((content, i) => {
    if (content) sections.push(`[${labels[i]}]\n${content}`);
  });

  if (sections.length === 0) {
    return `=== ${c.name} ===\nSite inacessível.`;
  }

  // Limit to 2 sections per competitor to control token usage
  return `=== ${c.name} (${c.baseUrl}) ===\n${sections.slice(0, 2).join('\n\n')}`;
}

app.get('/api/news', async (_req, res) => {
  try {
    console.log('[Backend] Scraping competitor websites...');
    const scraped = await Promise.all(COMPETITORS.map(scrapeCompetitor));
    const content = scraped.join('\n\n---\n\n');

    const today = new Date().toLocaleDateString('pt-BR');
    console.log('[Backend] Sending to Gemini for analysis...');

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Analise o conteúdo extraído dos websites dos concorrentes da Elleven. Data de hoje: ${today}.\n\nConteudo dos sites:\n\n${content}`,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.1,
      },
    });

    console.log('[Backend] Done. Returning response.');
    res.json({ markdown: response.text ?? '' });
  } catch (err: any) {
    console.error('[Backend] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

const PORT = 3001;
app.listen(PORT, () => console.log(`✓ Backend rodando na porta ${PORT}`));
