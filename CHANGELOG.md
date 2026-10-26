# Changelog

Catatan perubahan yang dibuat selama sesi pengembangan ini, terbaru di atas.
Tanggal mengikuti waktu lokal proyek (WIB).

## 2026-10-26

### Spacing halaman publik disamakan dengan editor admin

- Line-height paragraf dan quote di halaman publik diubah dari `1.7` menjadi `1.5`, sama seperti blok teks di editor admin.
- Menghapus margin tambahan khusus halaman publik:
  - `margin-bottom: 1.25em` pada paragraf
  - `margin-top: 2.5rem` dan `margin-bottom: 0.75rem` pada heading
- Jarak konten setelah judul halaman diubah dari `mt-8` menjadi `mt-6`, mengikuti jarak konten di editor admin.
- Hasilnya, jarak antarbaris dan antarbagian halaman publik mengikuti spacing bawaan BlockNote yang dipakai editor, tanpa jarak ekstra.
- File: `src/app/globals.css`, `src/components/public/public-page-view.tsx`
- Status: belum di-commit.

### Loading state halaman publik

- `usePublicPage` dan `usePublicCurrentSpace` sekarang membedakan status `loading`, `ready`, dan `not-found`.
- Status disimpan per halaman/Space yang diminta, sehingga navigasi tidak menampilkan konten lama atau pesan “halaman tidak tersedia” palsu saat data masih dimuat.
- Menambahkan skeleton loading untuk halaman publik, halaman Space, sidebar TOC, dan beranda direktori dokumentasi.
- Skeleton memakai `aria-busy` dan `role="status"` agar status loading terbaca oleh screen reader.
- File:
  - `src/hooks/use-public-content.ts`
  - `src/hooks/public-space-context.tsx`
  - `src/components/public/public-loading.tsx`
  - `src/components/public/public-page-view.tsx`
  - `src/components/public/public-space-view.tsx`
  - `src/components/public/public-toc.tsx`
  - `src/components/public/public-home-content.tsx`
  - file test terkait
- Status: belum di-commit.

### Perbaikan halaman publish tidak muncul di link publik

- Akar masalah: `publish_page()` mengubah `is_published = true`, tetapi `pages.visibility` tetap `internal`. RLS publik mewajibkan `visibility = 'publishable'` **dan** `is_published = true`, sehingga halaman yang sudah dipublish tidak pernah terbaca oleh pengunjung anonim.
- Memperbarui RPC:
  - `publish_page()` sekarang menetapkan `visibility = 'publishable'`.
  - `update_published_page()` ikut memperbaiki `visibility` halaman yang sudah terlanjur publish.
  - `unpublish_page()` mengembalikan `visibility` ke `internal`.
- Menambahkan backfill idempoten untuk halaman yang sudah publish sebelum perbaikan.
- Memperbarui regression test RPC publish.
- File:
  - `supabase/migrations/20261026000000_fix_publish_visibility.sql`
  - `supabase/tests/publish-page-rpc.sql`
- Status:
  - Backfill data sudah diterapkan ke Supabase produksi; 21 halaman yang sebelumnya `internal` sudah menjadi `publishable`.
  - Migration fungsi SQL **belum diterapkan** ke Supabase produksi dan **belum di-commit**.

## 2026-10-23

### Paste gambar global di editor

- Gambar dapat ditempel dengan Cmd/Ctrl+V di mana saja di editor, bukan hanya di dalam blok screenshot.
- Gambar dari clipboard diunggah melalui alur presign → S3 → blok screenshot yang sudah ada.
- Blok screenshot baru disisipkan setelah posisi kursor.
- Menambahkan helper untuk mengambil file gambar dari clipboard dan membaca dimensi gambar.
- Commit: `f053860 Update copy paste image to page`
- File utama:
  - `src/components/editor/page-editor.tsx`
  - `src/components/editor/screenshot-upload-prompt.tsx`
  - `src/lib/clipboard-image.ts`
  - `src/lib/image-dimensions.ts`
  - file test terkait

## Catatan verifikasi

- Perubahan halaman publik terakhir: `npm run build` berhasil.
- Setelah perubahan spacing: 93 file test / 628 test lulus.
- Lint: 0 error; 1 warning lama di `src/lib/supabase/env.test.ts`.
