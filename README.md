# AM Preset Finder

Tempel link TikTok -> scan deskripsi, bio, bio link, komentar, balasan -> tampilkan link preset Alight Motion.

## Jalankan
    npm install
    npm start        # http://localhost:3000

## Catatan
- Komentar & balasan paling stabil kalau `yt-dlp` terpasang di server (`pip install yt-dlp`).
  Tanpa itu, dipakai endpoint web TikTok yang sering diblok; app akan kasih peringatan.
- Butuh Node 18+. Cache hasil 10 menit, rate limit 10 request/menit/IP.
- Deploy: Render / Railway / VPS apa saja yang bisa jalanin Node.
