export default function handler(req, res) {
  res.json({ ok: true, url: req.url, method: req.method });
}
