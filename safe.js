// Fetch aman untuk URL dari user/bio (anti SSRF).
import dns from 'node:dns/promises';

const UA =
  'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36';

function isPrivate(ip) {
  if (ip.includes(':')) {
    const l = ip.toLowerCase();
    return l === '::1' || l === '::' || l.startsWith('fc') || l.startsWith('fd') || l.startsWith('fe80') || l.startsWith('::ffff:');
  }
  const [a, b] = ip.split('.').map(Number);
  return (
    a === 0 || a === 10 || a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127)
  );
}

async function assertPublic(urlStr) {
  const u = new URL(urlStr);
  if (!/^https?:$/.test(u.protocol)) throw new Error('Protocol tidak diizinkan');
  const addrs = await dns.lookup(u.hostname, { all: true });
  if (!addrs.length || addrs.some((a) => isPrivate(a.address))) {
    throw new Error('Host tidak diizinkan');
  }
}

export async function safeFetchText(url, maxRedirects = 3) {
  let cur = url;
  for (let i = 0; i <= maxRedirects; i++) {
    await assertPublic(cur);
    const r = await fetch(cur, {
      redirect: 'manual',
      headers: { 'user-agent': UA, 'accept-language': 'en,id;q=0.8' },
      signal: AbortSignal.timeout(10000),
    });
    const loc = r.headers.get('location');
    if (r.status >= 300 && r.status < 400 && loc) {
      cur = new URL(loc, cur).toString();
      continue;
    }
    return (await r.text()).slice(0, 2_000_000);
  }
  throw new Error('Terlalu banyak redirect');
}

export { UA };
