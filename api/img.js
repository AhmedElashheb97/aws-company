// Vercel serverless function: GET /api/img?u=<https image url>
// Returns a car photo from the auction site with CORS allowed, so the invoice PDF can include it
// (auction image servers do not send CORS headers, and a canvas cannot use such images).
// Only public https URLs by host name, only image responses, max 8 MB.
const MAX = 8 * 1024 * 1024;
module.exports = async (req, res) => {
  let u;
  try { u = new URL(String((req.query && req.query.u) || '')); } catch (e) { return res.status(400).json({ error: 'bad url' }); }
  const h = u.hostname.toLowerCase();
  if (u.protocol !== 'https:' || !h.includes('.') || /^[\d.]+$/.test(h) || h.includes(':') || /(^|\.)(localhost|internal|local)$/.test(h)) {
    return res.status(400).json({ error: 'url not allowed' });
  }
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 12000);
    const r = await fetch(u.href, { redirect: 'follow', signal: ctl.signal, headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'image/*' } });
    clearTimeout(t);
    const type = r.headers.get('content-type') || '';
    if (!r.ok || !type.startsWith('image/')) return res.status(502).json({ error: 'not an image' });
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > MAX) return res.status(413).json({ error: 'too large' });
    res.setHeader('Content-Type', type);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).send(buf);
  } catch (e) {
    return res.status(502).json({ error: 'fetch failed' });
  }
};
