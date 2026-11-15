# Tumbuh — Tabungan & Investasi

Aplikasi keuangan harian: catat pemasukan/pengeluaran, kejar target tabungan, dan hitung investasi.
Semua data tersimpan di perangkat (tanpa akun, tanpa server).

## Fitur

- **Beranda**: saldo, ringkasan bulan ini, grafik pengeluaran 7 hari, progres target
- **Catat transaksi**: input cepat dengan tombol nominal (+10rb, +50rb, ...) dan kategori
- **Riwayat**: dikelompokkan per hari, ketuk untuk detail/hapus
- **Target tabungan**: progres, setoran, saran setoran per bulan sampai tenggat, efek koin saat target tercapai
- **Kalkulator**: Investasi (bunga majemuk + grafik), Tabungan (berapa per bulan), Dana Darurat, Bebas Finansial
- Ekspor CSV, data contoh, mode hemat animasi otomatis (mengikuti pengaturan "kurangi gerakan" di HP)

## Cara 1 — Jadi APK lewat GitHub (paling mudah, tanpa install apa pun)

1. Buat repository baru di GitHub, lalu unggah seluruh isi folder ini (termasuk folder `.github`).
2. Buka tab **Actions** → pilih **Build APK** → **Run workflow** (atau otomatis berjalan saat push ke `main`).
3. Tunggu sekitar 5–10 menit. Unduh file `app-debug.apk` dari bagian **Artifacts** (`tumbuh-apk`).
4. Kirim ke HP, buka file, izinkan "Install dari sumber tidak dikenal", lalu pasang.

## Cara 2 — Build di komputer sendiri

Butuh: Node.js 20+, JDK 21, dan Android SDK (paling mudah lewat Android Studio).

```bash
npm install
npx cap add android
npx capacitor-assets generate --android   # ikon & splash dari folder assets/
npx cap sync android
cd android && ./gradlew assembleDebug
```

Hasil: `android/app/build/outputs/apk/debug/app-debug.apk`

Atau setelah `cap sync`, jalankan `npx cap open android` dan build dari Android Studio.

## Cara 3 — Langsung dipakai tanpa APK (PWA)

Unggah isi folder `www/` ke hosting statis (GitHub Pages, Netlify, Cloudflare Pages).
Buka di Chrome HP → menu ⋮ → **Tambahkan ke layar utama**. Hasilnya tampil seperti aplikasi dan bisa dipakai offline.

Untuk mencoba di komputer: `npm run serve` lalu buka http://localhost:8080 (ukuran layar HP lewat DevTools).

## Catatan

- APK yang dihasilkan adalah versi **debug**: cukup untuk dipasang dan dipakai sendiri. Untuk Google Play, perlu build *release* yang ditandatangani (keystore).
- Tombol "Ekspor CSV" memakai unduhan browser; di WebView Android perilakunya bisa berbeda. Jika tidak mengunduh, gunakan versi PWA atau tambahkan plugin Filesystem/Share.
- Simulasi investasi hanya perhitungan matematis, bukan jaminan hasil atau saran investasi.

## Struktur

```
www/            aplikasi (index.html, style.css, app.js, manifest, service worker)
assets/         sumber ikon & splash untuk @capacitor/assets
capacitor.config.json
.github/workflows/build-apk.yml
```
