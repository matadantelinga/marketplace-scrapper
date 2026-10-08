# Marketplace Crawler (Next.js + Playwright)

## Menjalankan
    npm install        # otomatis memasang Chromium untuk Playwright
    npm run dev        # buka http://localhost:3000

1. Tempel link halaman toko, klik "Mulai ambil data".
2. Klik "Download JSON" setelah selesai.
3. (Opsional) Unduh semua foto ke folder lokal:
       npm run download-images -- produk.json

## Jika link produk tidak terdeteksi
Isi kolom "CSS selector link produk" (klik kanan pada produk di browser → Inspect → cari tag <a>).

## Catatan
- Halaman produk dibaca lewat JSON-LD (schema.org), OpenGraph, lalu fallback ke <h1>/<img>.
- Kecepatan sengaja dibatasi (3 tab paralel + jeda acak) agar tidak membebani server.

## Shopee / situs dengan anti-bot (WAJIB pakai Chrome asli)
1. Tutup semua jendela Chrome, lalu jalankan Chrome dengan debugging port:
   - Windows: `"C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="C:\chrome-debug"`
   - macOS: `/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-debug`
   - Linux: `google-chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-debug`
2. Di jendela Chrome itu, buka shopee.co.id, login, dan buka halaman tokomu (selesaikan captcha jika muncul).
3. Buat file `.env.local` berisi: `CDP_URL=http://localhost:9222`
4. Restart `npm run dev`, lalu jalankan crawler seperti biasa.
