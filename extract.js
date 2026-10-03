// Ekstrak link preset Alight Motion dari teks mentah.

const TAIL = `[^\\s"'<>\\])}\\\\]*`;

const PATTERNS = [
  {
    type: 'alight',
    re: new RegExp(`https?:\\/\\/(?:www\\.)?alightcreative\\.com\\/am\\/share\\/${TAIL}`, 'gi'),
  },
  {
    type: 'alight',
    re: new RegExp(`https?:\\/\\/(?:www\\.)?alight\\.link\\/${TAIL}`, 'gi'),
  },
  {
    type: 'drive',
    re: new RegExp(`https?:\\/\\/drive\\.google\\.com\\/(?:file\\/d\\/[\\w-]+|open\\?id=[\\w-]+|uc\\?[^\\s"'<>]*id=[\\w-]+)${TAIL}`, 'gi'),
  },
  {
    type: 'mediafire',
    re: new RegExp(`https?:\\/\\/(?:www\\.)?mediafire\\.com\\/(?:file|download)\\/${TAIL}`, 'gi'),
  },
  {
    type: 'mega',
    re: new RegExp(`https?:\\/\\/mega\\.nz\\/(?:file|folder|#!?)${TAIL}`, 'gi'),
  },
];

function clean(text) {
  return String(text || '')
    .replace(/\\u002F/gi, '/')
    .replace(/\\\//g, '/')
    .replace(/&amp;/g, '&');
}

function tidy(url) {
  return url.replace(/[.,;:!?]+$/, '');
}

export function driveId(url) {
  const m = url.match(/\/file\/d\/([\w-]+)/) || url.match(/[?&]id=([\w-]+)/);
  return m ? m[1] : null;
}

export function describe(link) {
  const out = { ...link };
  if (link.type === 'drive') {
    const id = driveId(link.url);
    out.badge = 'Google Drive';
    out.action = 'Get file';
    out.href = id ? `https://drive.google.com/uc?export=download&id=${id}` : link.url;
  } else if (link.type === 'alight') {
    out.badge = 'Alight Motion';
    out.action = 'Open preset';
    out.href = link.url;
  } else {
    out.badge = link.type;
    out.action = 'Get file';
    out.href = link.url;
  }
  return out;
}

export function extractLinks(text, source) {
  const t = clean(text);
  const found = [];
  for (const { type, re } of PATTERNS) {
    re.lastIndex = 0;
    for (const m of t.matchAll(re)) {
      found.push({ url: tidy(m[0]), type, source });
    }
  }
  return found;
}

export function mergeLinks(...lists) {
  const seen = new Map();
  for (const list of lists) {
    for (const l of list) {
      const key = l.url.replace(/^http:/, 'https:').replace(/\/$/, '');
      if (!seen.has(key)) seen.set(key, { ...l, sources: [l.source] });
      else {
        const e = seen.get(key);
        if (!e.sources.includes(l.source)) e.sources.push(l.source);
      }
    }
  }
  return [...seen.values()].map(describe);
}
