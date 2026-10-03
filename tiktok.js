// Ambil data publik video TikTok: deskripsi, profil (bio + bio link), komentar, balasan.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { extractLinks, mergeLinks } from './extract.js';
import { safeFetchText, UA } from './safe.js';

const run = promisify(execFile);

export function isTikTokUrl(u) {
  try {
    return /(^|\.)tiktok\.com$/i.test(new URL(u).hostname);
  } catch {
    return false;
  }
}

async function openVideoPage(url) {
  let cur = url;
  for (let i = 0; i < 5; i++) {
    const r = await fetch(cur, {
      redirect: 'manual',
      headers: { 'user-agent': UA, 'accept-language': 'en,id;q=0.8' },
      signal: AbortSignal.timeout(15000),
    });
    const loc = r.headers.get('location');
    if (r.status >= 300 && r.status < 400 && loc) {
      cur = new URL(loc, cur).toString();
      if (!isTikTokUrl(cur)) throw new Error('Redirect bukan ke TikTok');
      continue;
    }
    const cookie = (r.headers.getSetCookie?.() || []).map((c) => c.split(';')[0]).join('; ');
    return { url: cur, html: await r.text(), cookie };
  }
  throw new Error('Terlalu banyak redirect');
}

function parseItem(html) {
  const m = html.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return null;
  try {
    const data = JSON.parse(m[1]);
    return data?.__DEFAULT_SCOPE__?.['webapp.video-detail']?.itemInfo?.itemStruct ?? null;
  } catch {
    return null;
  }
}

// --- komentar via yt-dlp (kalau terpasang), lebih stabil ---
async function commentsViaYtDlp(url) {
  const { stdout } = await run(
    'yt-dlp',
    ['--skip-download', '--write-comments', '-J', '--no-warnings', url],
    { maxBuffer: 80 * 1024 * 1024, timeout: 90000 }
  );
  const j = JSON.parse(stdout);
  return (j.comments || []).map((c) => ({ text: c.text || '', reply: c.parent && c.parent !== 'root' }));
}

// --- komentar via endpoint web TikTok (kadang diblok / kosong) ---
async function commentsViaApi(id, cookie) {
  const headers = { 'user-agent': UA, cookie, referer: 'https://www.tiktok.com/' };
  const out = [];
  let cursor = 0;
  let repliesFetched = 0;
  for (let page = 0; page < 5; page++) {
    const r = await fetch(
      `https://www.tiktok.com/api/comment/list/?aid=1988&aweme_id=${id}&count=50&cursor=${cursor}`,
      { headers, signal: AbortSignal.timeout(15000) }
    );
    const t = await r.text();
    if (!t) break;
    let j;
    try { j = JSON.parse(t); } catch { break; }
    for (const c of j.comments || []) {
      out.push({ text: c.text || '', reply: false });
      if (c.reply_comment_total > 0 && repliesFetched < 25) {
        repliesFetched++;
        try {
          const rr = await fetch(
            `https://www.tiktok.com/api/comment/list/reply/?aid=1988&item_id=${id}&comment_id=${c.cid}&count=30&cursor=0`,
            { headers, signal: AbortSignal.timeout(15000) }
          );
          const rj = JSON.parse(await rr.text());
          for (const x of rj.comments || []) out.push({ text: x.text || '', reply: true });
        } catch { /* lewati */ }
      }
    }
    if (!j.has_more) break;
    cursor = j.cursor;
  }
  return out;
}

export async function scanTikTok(inputUrl) {
  if (!isTikTokUrl(inputUrl)) throw new Error('Link harus dari tiktok.com');

  const notes = [];
  const page = await openVideoPage(inputUrl);
  const item = parseItem(page.html);
  if (!item) throw new Error('Data video tidak bisa dibaca (link salah, video private, atau TikTok memblokir request)');

  const author = item.author || {};
  const stats = item.stats || {};
  const video = {
    id: item.id,
    desc: item.desc || '',
    author: author.uniqueId || '',
    nickname: author.nickname || '',
    avatar: author.avatarThumb || '',
    cover: item.video?.cover || '',
    comments: stats.commentCount ?? 0,
    views: stats.playCount ?? 0,
    likes: stats.diggCount ?? 0,
  };

  const bioLink = author.bioLink?.link || '';
  const sources = [];
  const lists = [];

  // 1. deskripsi
  const d = extractLinks(video.desc, 'deskripsi');
  lists.push(d);
  sources.push({ name: 'Deskripsi', checked: true, found: d.length });

  // 2. bio akun
  const b = extractLinks(author.signature || '', 'bio');
  lists.push(b);
  sources.push({ name: 'Bio akun', checked: true, found: b.length });

  // 3. bio link (buka halamannya, mis. linktree)
  if (bioLink) {
    let bl = extractLinks(bioLink, 'bio link');
    try {
      const html = await safeFetchText(bioLink);
      bl = bl.concat(extractLinks(html, 'bio link'));
    } catch (e) {
      notes.push(`Bio link tidak bisa dibuka: ${e.message}`);
    }
    lists.push(bl);
    sources.push({ name: 'Bio link', checked: true, found: bl.length });
  } else {
    sources.push({ name: 'Bio link', checked: false, found: 0 });
  }

  // 4 & 5. komentar + balasan
  let comments = [];
  try {
    comments = await commentsViaYtDlp(page.url);
  } catch {
    try {
      comments = await commentsViaApi(video.id, page.cookie);
    } catch (e) {
      notes.push(`Komentar gagal diambil: ${e.message}`);
    }
  }
  if (!comments.length && video.comments > 0) {
    notes.push('Komentar tidak bisa diambil (TikTok memblokir). Pasang yt-dlp di server supaya komentar & balasan ikut discan.');
  }
  const c = [];
  const r = [];
  for (const x of comments) {
    (x.reply ? r : c).push(...extractLinks(x.text, x.reply ? 'balasan' : 'komentar'));
  }
  lists.push(c, r);
  sources.push({ name: 'Komentar', checked: comments.length > 0, found: c.length, scanned: comments.filter((x) => !x.reply).length });
  sources.push({ name: 'Balasan', checked: comments.length > 0, found: r.length, scanned: comments.filter((x) => x.reply).length });

  return { video, sources, links: mergeLinks(...lists), notes };
}
