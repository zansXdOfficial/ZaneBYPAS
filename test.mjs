import assert from 'node:assert/strict';
import { extractLinks, mergeLinks } from './extract.js';

const drive = 'https://drive.google.com/file/d/1qaStdRjx9vhSTg7MFvLHPp3Bj1JXZgyN/view?usp=drivesdk';
const alight = 'https://alightcreative.com/am/share/u/es8CxXTDB9UPYjevYGb3mH9wm4k1/p/t0uKXJ1u69-f87375c74f9eb884';

// deskripsi + komentar, dengan tanda baca di ujung
const a = extractLinks(`preset nih ${drive}, jangan lupa follow`, 'komentar');
const b = extractLinks(`(${alight}).`, 'balasan');
assert.equal(a.length, 1);
assert.equal(a[0].url, drive);
assert.equal(b.length, 1);
assert.equal(b[0].url, alight);

// JSON-escaped (bio link / halaman linktree)
const esc = extractLinks('"url":"https:\\/\\/alightcreative.com\\/am\\/share\\/u\\/abc\\/p\\/xyz"', 'bio link');
assert.equal(esc.length, 1);
assert.equal(esc[0].url, 'https://alightcreative.com/am/share/u/abc/p/xyz');

// dedupe antar sumber + metadata tombol
const merged = mergeLinks(a, extractLinks(drive, 'deskripsi'), b);
assert.equal(merged.length, 2);
assert.deepEqual(merged[0].sources, ['komentar', 'deskripsi']);
assert.equal(merged[0].action, 'Get file');
assert.match(merged[0].href, /uc\?export=download&id=1qaStdRjx9vhSTg7MFvLHPp3Bj1JXZgyN/);
assert.equal(merged[1].action, 'Open preset');

// teks tanpa link
assert.equal(extractLinks('keren banget #foryou', 'deskripsi').length, 0);

console.log('semua tes lolos');
