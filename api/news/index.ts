import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return res.status(500).json({ error: "Supabase nao configurado. Defina SUPABASE_URL e SUPABASE_ANON_KEY nas variaveis de ambiente do Vercel." });
  const supabase = createClient(url, key);
  const { data, error } = await supabase
    .from("news_items")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ items: data || [] });
}
