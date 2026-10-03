import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanTikTok } from './tiktok.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: '10kb' }));
app.use(express.static(path.join(__dirname, 'public')));

// rate limit sederhana: 10 request / menit / IP
const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < 60000);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > 10;
}

// cache hasil 10 menit
const cache = new Map();

app.post('/api/scan', async (req, res) => {
  if (limited(req.ip)) return res.status(429).json({ error: 'Terlalu banyak request, coba lagi sebentar.' });
  const url = String(req.body?.url || '').trim();
  if (!url) return res.status(400).json({ error: 'Link kosong.' });

  const hit = cache.get(url);
  if (hit && Date.now() - hit.t < 600000) return res.json(hit.data);

  try {
    const data = await scanTikTok(url);
    cache.set(url, { t: Date.now(), data });
    res.json(data);
  } catch (e) {
    res.status(422).json({ error: e.message || 'Gagal memproses link.' });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`AM Preset Finder jalan di http://localhost:${port}`));
