# Marketplace Crawler

Aplikasi web berbasis **Next.js + Playwright** untuk mengambil data produk dari halaman toko marketplace. Tempel link toko, lalu aplikasi mengumpulkan **judul, kategori, harga, deskripsi, dan foto** semua produk dan menyimpannya sebagai **JSON**.

## Fitur

- Input cukup satu link halaman toko
- Scroll otomatis untuk memuat semua produk (lazy loading)
- Ekstraksi dari data terstruktur (JSON-LD / schema.org) dan OpenGraph, dengan fallback ke `<h1>` dan `<img>`
- Progres real-time (streaming) dan pratinjau hasil di halaman
- Ekspor ke JSON
- Skrip untuk mengunduh semua foto ke folder lokal
- Mode **Chrome asli** (CDP) untuk situs dengan proteksi anti-bot seperti Shopee
- Konkurensi terbatas dan jeda acak antar permintaan agar tidak membebani server

## Format output

```json
[
  {
    "url": "https://contoh.com/toko/produk-a",
    "title": "Nama Produk",
    "category": "Fashion > Pria > Kaos",
    "description": "Deskripsi produk...",
    "price": "99000",
    "images": [
      "https://contoh.com/img/1.jpg",
      "https://contoh.com/img/2.jpg"
    ]
  }
]
```

## Instalasi

Prasyarat: **Node.js 18.18+** dan npm.

```bash
git clone https://github.com/USERNAME/marketplace-crawler.git
cd marketplace-crawler
npm install      # otomatis memasang Chromium untuk Playwright
npm run dev
```

Buka <http://localhost:3000>.

## Cara pakai

1. Tempel link halaman toko, misalnya `https://www.tokopedia.com/nama-toko`.
2. (Opsional) Atur **Maks. produk** dan **CSS selector link produk**.
3. Klik **Mulai ambil data** dan tunggu sampai selesai.
4. Klik **Download JSON** untuk menyimpan hasilnya sebagai `produk.json`.

### Mengunduh foto

```bash
npm run download-images -- produk.json
```

Foto disimpan per produk di folder `downloads/`, lengkap dengan `info.json` untuk tiap produk.

### Jika link produk tidak terdeteksi

Pendeteksi link produk memakai pola URL umum. Jika hasilnya kosong, isi kolom **CSS selector link produk**:

1. Klik kanan sebuah produk di browser, lalu pilih **Inspect**.
2. Cari tag `<a>` yang membungkus produk.
3. Salin selector-nya, misalnya `a[data-testid="lnkProductContainer"]`.

## Mode Chrome asli (untuk Shopee dan situs anti-bot)

Beberapa situs mendeteksi Chromium headless dan membiarkan koneksi menggantung sampai timeout (`page.goto: Timeout 60000ms exceeded`). Solusinya adalah menghubungkan crawler ke Chrome asli yang kamu jalankan sendiri lewat Chrome DevTools Protocol (CDP).

**1. Tutup semua jendela Chrome**, lalu jalankan Chrome dengan debugging port:

| OS | Perintah |
| --- | --- |
| macOS | `/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-debug` |
| Windows | `"C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="C:\chrome-debug"` |
| Linux | `google-chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-debug` |

**2.** Di jendela Chrome tersebut, buka situsnya, login bila perlu, dan selesaikan captcha.

**3.** Buat file `.env.local`:

```env
CDP_URL=http://localhost:9222
```

**4.** Restart `npm run dev` dan jalankan crawler seperti biasa.

> Gunakan profil terpisah (`--user-data-dir`) dan jangan memakai profil Chrome utamamu. Port debugging memberi akses penuh ke browser tersebut.

Untuk memastikan port aktif, buka `http://localhost:9222/json/version`. Jika muncul JSON berisi info versi, berarti berhasil.

## Struktur proyek

```
app/
  page.tsx              # UI
  layout.tsx
  globals.css
  api/scrape/route.ts   # endpoint streaming (NDJSON)
lib/
  scraper.ts            # logika crawler (Playwright)
scripts/
  download-images.ts    # unduh foto dari produk.json
```

## Konfigurasi

| Opsi | Lokasi | Default | Keterangan |
| --- | --- | --- | --- |
| `maxProducts` | UI | 50 | Batas jumlah produk |
| `linkSelector` | UI | kosong | CSS selector link produk |
| `maxScrolls` | `lib/scraper.ts` | 15 | Batas scroll halaman toko |
| `concurrency` | `lib/scraper.ts` | 3 | Jumlah tab paralel |
| `CDP_URL` | `.env.local` | kosong | Alamat Chrome asli untuk mode CDP |

## Keterbatasan

- Halaman toko dengan tombol "halaman berikutnya" (bukan infinite scroll) belum didukung.
- Struktur halaman marketplace sering berubah, jadi pendeteksi link dan ekstraksi data mungkin perlu disesuaikan.
- Situs yang mewajibkan login atau captcha memerlukan mode Chrome asli.

## Penggunaan yang bertanggung jawab

Alat ini dibuat untuk keperluan yang sah, misalnya mengarsipkan katalog **tokomu sendiri**, atau riset dan analisis data publik.

- Patuhi **Syarat dan Ketentuan** serta `robots.txt` situs yang kamu akses. Banyak marketplace melarang pengambilan data otomatis, dan akunmu bisa dibatasi atau ditangguhkan.
- Foto dan deskripsi produk dilindungi **hak cipta** milik penjual. Jangan memakai ulang konten toko lain untuk berjualan tanpa izin.
- Gunakan jeda dan batas produk yang wajar. Jangan membebani server pihak lain.
- Untuk toko milikmu, API resmi atau fitur ekspor bawaan marketplace biasanya lebih stabil dan aman.

Penulis tidak bertanggung jawab atas penyalahgunaan alat ini.

## Lisensi

MIT. Tambahkan file `LICENSE` sesuai kebutuhanmu.
