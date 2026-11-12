// Vercel serverless function: POST /api/fees
// Forwards an auction-fee quote request to the free public API of auctionfeescalculator.com
// (docs: https://docs.auctionfeescalculator.com/). Needed because that API sends no CORS headers,
// so the browser cannot call it directly. Only whitelisted fields are forwarded; no customer data is sent.
const UPSTREAM = 'https://api.auctionfeescalculator.com';
const ALLOWED = {
  auction: ['copart', 'iaai'],
  bidType: ['online', 'kiosk', 'non-kiosk'],
  bidPay: ['secured', 'unsecured', 'high', 'standard'],
  bidVehicle: ['standard', 'heavy', 'crashedToys', 'licensed', 'non-licensed', 'recRides'],
  volume: ['low', 'high'],
};

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = null; } }
  if (!b || typeof b !== 'object') return res.status(400).json({ error: 'Invalid JSON' });

  const amount = Number(b.bidAmount);
  if (!(amount > 0) || amount > 10000000) return res.status(400).json({ error: 'bidAmount must be greater than 0' });
  const out = { bidAmount: amount };
  for (const k of Object.keys(ALLOWED)) {
    if (b[k] == null || b[k] === '') continue;
    if (!ALLOWED[k].includes(b[k])) return res.status(400).json({ error: 'Invalid ' + k });
    out[k] = b[k];
  }
  if (!out.auction || !out.bidType || !out.bidPay || !out.bidVehicle) return res.status(400).json({ error: 'Missing fields' });
  const city = String(b.fromCity || '').trim().slice(0, 60), state = String(b.fromState || '').trim().slice(0, 2).toUpperCase();
  if (city && /^[A-Z]{2}$/.test(state)) { out.fromCity = city; out.fromState = state; }

  try {
    const r = await fetch(UPSTREAM, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(out) });
    const text = await r.text();
    let j; try { j = JSON.parse(text); } catch (e) { j = { error: 'Bad response from fees service' }; }
    return res.status(r.ok ? 200 : r.status).json(j);
  } catch (e) {
    return res.status(502).json({ error: 'Fees service unreachable' });
  }
};
