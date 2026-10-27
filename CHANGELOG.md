# Changelog

Catatan perubahan yang dibuat selama sesi pengembangan ini, terbaru di atas.
Tanggal mengikuti waktu lokal proyek (WIB).

## 2026-10-27

### Redesign Space Management: Space → Page → Blok Konten

- **Hierarki baru yang konsisten.** Space tetap menjadi wadah utama, Halaman tetap menjadi dokumen, dan blok konten tetap hidup di dalam Page Builder. Sidebar workspace, header Space, daftar Halaman, navigasi publik, dan halaman publik kini memakai istilah serta urutan yang sama. Menambah/mengubah Halaman tidak lagi mengubah struktur Space secara diam-diam.
- **Space Builder baru** di tab **Layout** (`/spaces/[spaceId]/builder`):
  - Mengedit judul, deskripsi/subtitle, dan emoji Space langsung dari builder.
  - Menambah, mengubah judul/deskripsi, mengurutkan (naik/turun), dan menghapus bagian (*section*).
  - Mengatur jumlah kolom per bagian (1–4) dan lebar tiap kartu Halaman (1–`jumlah kolom`); mengecilkan kolom otomatis mengecilkan span kartu agar tidak meluber.
  - Menambah Halaman ke bagian lewat dropdown, menyeret kartu untuk mengubah urutan di dalam bagian maupun memindahkannya antar-bagian.
  - Pratinjau langsung di samping editor (dan tombol tampil/sembunyikan di layar kecil) memakai komponen yang sama dengan halaman publik, sehingga hasil pratinjau identik dengan yang dilihat pengunjung.
  - Tombol **Simpan perubahan** eksplisit dengan status “belum disimpan/tersimpan” dan toast sukses/gagal. Layout bertahan setelah refresh karena disimpan ke `spaces.layout`.
- **Page Management** di tab **Halaman**:
  - Daftar Halaman dikelompokkan mengikuti bagian Space, dengan pencarian dan filter status (Semua/Draf/Dipublikasikan).
  - Drag handle untuk mengurutkan Halaman dan memindahkannya antar-bagian; perubahan layout disimpan otomatis.
  - Menu baris untuk **Ubah nama**, **Publikasikan/Perbarui publikasi/Batalkan publikasi**, **Jadikan publik/internal** (visibilitas), **Pindahkan ke bagian**, dan **Hapus**.
  - Status, penulis, dan waktu perubahan tetap terlihat; tampilan menyesuaikan layar kecil tanpa horizontal scroll.
- **Space Settings dipisah dari pengaturan Halaman** dan dikelompokkan menjadi **Umum**, **Akses & Izin**, **Navigasi**, dan **Publikasi**:
  - Umum: nama, deskripsi, emoji, dan slug/URL.
  - Akses & Izin: ringkasan akses publik/privat dan peran anggota.
  - Navigasi: tampilkan/sembunyikan daftar halaman di sidebar publik, serta urutan bagian.
  - Publikasi: status “Dapat dipublikasikan/Hanya internal”, konfirmasi sebelum menjadikan Space internal, tautan ke halaman publik, dan hapus Space.
- **Halaman publik Space** sekarang dirender dari layout yang disimpan admin: judul, deskripsi, emoji, bagian, jumlah kolom, lebar kartu, dan urutan Halaman. Hanya Halaman yang lolos RLS publik (`is_publishable`, `visibility = publishable`, `is_published`) yang tampil; draf, kontrol editor, dan drag handle tidak pernah ikut dirender. Sidebar publik mengikuti urutan layout dan menghormati pengaturan sembunyikan daftar halaman.
- **Page Builder — blok baru**:
  - **Callout** dengan varian Informasi/Peringatan/Berhasil/Penting.
  - **Tombol / Tautan** dengan URL dan gaya Utama/Sekunder; di halaman publik dirender sebagai `<a>` sungguhan.
  - **Dua Kolom** dan **Tiga Kolom** (bisa ditambah/dikurangi kolomnya saat mengedit).
  - Item slash menu baru: Gambar, Video, Lampiran Berkas, Callout, Tombol/Tautan, Dua Kolom, dan Tiga Kolom. Blok bawaan lain (teks, H1–H3, daftar berpoin/bernomor, checklist, kutipan, pembatas, tabel, file, screenshot) tetap tersedia.
- **Tipografi dan komponen disatukan**: satu keluarga font, skala tipe dengan bobot/line-height tetap, `body-sm` 0.875rem dan `caption` 0.8125rem agar tidak ada teks terlalu kecil, serta badge status dengan tinggi, padding, bobot, dan titik indikator yang seragam — termasuk badge “Dapat dipublikasikan”.
- **Migrasi database**: `supabase/migrations/20261027000000_space_layout.sql` menambahkan `spaces.description`, `spaces.icon`, `spaces.layout` (JSONB), dan `spaces.show_page_list`. Kolom baru bersifat opsional; Space lama tetap tampil memakai layout otomatis. **Migrasi ini belum dijalankan di Supabase** dan perlu diterapkan sebelum fitur layout dipakai di environment nyata.
- Menambahkan test untuk normalisasi/merge/move layout, Space Builder, Page Manager (rename/publikasi/visibilitas), pengaturan Space, render layout publik, visibilitas sidebar publik, slash menu, mapper, serta render blok callout/button/columns.
- File utama:
  - `supabase/migrations/20261027000000_space_layout.sql`
  - `src/lib/types.ts`, `src/lib/space-layout.ts`
  - `src/lib/supabase/mappers.ts`, `src/hooks/use-spaces.ts`, `src/hooks/use-pages.ts`
  - `src/components/space/space-builder.tsx`, `src/components/space/space-layout-view.tsx`
  - `src/app/(workspace)/spaces/[spaceId]/(overview)/page.tsx`
  - `src/app/(workspace)/spaces/[spaceId]/(overview)/settings/page.tsx`
  - `src/app/(workspace)/spaces/[spaceId]/(overview)/layout.tsx`
  - `src/components/public/public-space-view.tsx`, `src/components/public/public-toc.tsx`
  - `src/components/editor/{callout-block,button-block,columns-block,schema,slash-menu-items}.tsx`
  - `src/app/globals.css`
- Status: belum di-commit; `npm test` (711 test), `tsc --noEmit`, `npm run lint`, dan `npm run build` lulus. Tampilan builder, blok baru, dan mode baca sudah dicek langsung di browser pada tema gelap.

## 2026-10-26

### Perbaikan penambahan langkah stepper dan wording judul

- Placeholder judul langkah kini seragam **“Judul langkah”**, tidak lagi “Langkah 1”, “Langkah 2”, dan seterusnya — baik saat mengedit maupun fallback judul kosong di mode baca.
- Akar masalah tombol tambah tidak berfungsi: kelas `opacity-0` Tailwind berada di layer `utilities`, sehingga selalu mengalahkan aturan hover di layer `components`. Akibatnya tombol “+” tetap transparan (tidak terlihat dan sulit ditemukan) meskipun area kliknya ada. Opacity default sekarang didefinisikan di CSS stepper, dan hover/focus kembali berfungsi.
- Penambahan langkah sekarang hanya lewat tombol **“+” di bawah nomor**. Tombol teks “Tambah langkah” di bawah daftar dihapus.
- Tombol “+” pada langkah terakhir selalu terlihat (opacity 0.7), sedangkan langkah lain menampilkannya saat hover/focus untuk menyisipkan di tengah; pada perangkat sentuh tombol tetap terlihat samar.
- **Penghapusan langkah kini lewat menu titik enam**: ikon tong sampah di kanan judul dihapus. Menu drag handle menampilkan **“Hapus langkah”** untuk blok langkah, sedangkan blok lain tetap memakai menu bawaan (Delete, Colors, dan header tabel). Jika langkah yang dihapus adalah satu-satunya langkah, seluruh blok stepper ikut dihapus sehingga tidak tersisa container kosong.
- Menu titik enam pulih andal setelah hapus maupun Escape: bila blok anchor dihapus saat menu terbuka, side menu di-unfreeze agar bisa muncul lagi tanpa reload. Cleanup ini hanya berjalan ketika blok benar-benar hilang, sehingga tidak ikut menutup menu pada teardown StrictMode saat pengembangan.
- Menekan **Enter** di judul langkah menambahkan langkah baru tepat setelahnya dan langsung memindahkan fokus ke judul baru, sehingga penomoran bisa dilanjutkan dari keyboard.
- Menambahkan test untuk penambahan berulang lewat “+” per langkah, semantik hapus langkah lewat menu (termasuk stepper yang ikut terhapus saat langkah terakhir dihapus), penambahan via Enter, placeholder seragam, tidak adanya tombol hapus per langkah, serta aturan CSS reveal.
- File utama:
  - `src/components/editor/comment-side-menu.tsx`
  - `src/components/editor/stepper-block.tsx`
  - `src/components/editor/stepper-block.test.tsx`
  - `src/app/globals.css`
  - `src/app/globals.css.test.ts`
- Status: belum di-commit.

### Redesign visual Stepper / Multi-Step Process ala GitBook

- Menata ulang stepper menjadi layout dua kolom: rail nomor di kiri, judul + body di kanan. Grid dipasang pada blok BlockNote (`.bn-block:has(... step)`) karena body langkah dirender BlockNote sebagai sibling node view, sehingga grid inilah yang membuat paragraf/gambar/nested stepper sejajar dengan judul — bukan padding di dalam komponen React.
- Geometri dipusatkan di custom property `--step-rail` (28px), `--step-gutter` (32px), `--step-gap-y`, `--step-body-gap`, dan `--step-line-*`, dipakai bersama oleh render function dan grid agar lingkaran, judul, body, dan garis tidak bisa bergeser satu sama lain.
- Garis penghubung dipindah ke pseudo-element `::after` pada blok langkah (bukan `span` di dalam render), sehingga panjangnya mengikuti tinggi body dan tetap sejajar pusat lingkaran meski teks membungkus. Garis mulai sedikit di bawah lingkaran dan berhenti sebelum lingkaran berikutnya; langkah terakhir ditandai `data-last="true"` dan tidak menggambar garis.
- Nested stepper: langkah di dalam stepper lain ditandai `data-nested="true"` lewat hitungan ancestor `stepper`. Judul sub-langkah turun ke `--text-h3` dengan warna `--muted-foreground`, body-nya ikut meredup, dan grup nested diberi jarak bawah sebelum langkah utama berikutnya. Sub-step hanya muncul bila datanya memang ada — tidak ada data dummy.
- Menghapus indentasi bawaan BlockNote (24px) pada grup step/stepper dan mematikan depth-guide bawaan di grup tersebut agar tidak ada garis vertikal ganda.
- Tombol tambah langkah kini menempel di rail (absolute, muncul saat hover/focus di seluruh blok); pada perangkat sentuh (`hover: none`) tombol ditampilkan samar agar tetap bisa diakses.
- Responsif: di bawah 768px rail mengecil ke 24px, gutter ke 16px, judul ke `--text-h3`, sub-judul ke `--text-h4`, dan jarak vertikal dipadatkan. Tidak ada lebar tetap atau horizontal overflow; judul/body memakai `min-w-0` dan `overflow-wrap`.
- Warna memakai token tema yang sudah ada (`--foreground`, `--muted-foreground`, `--secondary`, `--border`) — tidak ada warna hardcoded dan tema global tidak diubah.
- Seluruh logic lama dipertahankan: penomoran per grup, edit judul, tambah/hapus langkah, pemulihan stepper kosong, mode read-only, dan drag/drop BlockNote.
- Menambahkan test untuk penanda langkah terakhir, penanda nested, serta aturan CSS grid/connector/token/responsif.
- File utama:
  - `src/components/editor/stepper-block.tsx`
  - `src/app/globals.css`
  - `src/components/editor/stepper-block.test.tsx`
  - `src/app/globals.css.test.ts`
- Status: belum di-commit.

### Perbaikan alignment header halaman editor

- Menyatukan judul dan deskripsi dalam satu kolom teks (`min-w-0`), sehingga keduanya mulai dari batas kiri yang sama dengan paragraf, stepper, dan seluruh konten BlockNote di bawahnya.
- Emoji halaman dipisahkan dari alur teks: pada `md+` ia diposisikan absolut di gutter kiri editor (`md:absolute md:-left-12 md:top-1`) sebagai elemen dekoratif, jadi ukuran/hadirnya tidak pernah menggeser atau meng-indentasi judul. Ukuran glyph di header dinaikkan ke `md:text-2xl` agar seimbang dengan judul `text-h1`, dan jaraknya tetap 16px dari teks.
- Di bawah `md` (tidak ada gutter) emoji ditumpuk di atas judul, sehingga judul tetap berada di batas kiri konten pada layar kecil.
- Menambahkan test struktur di `page.test.tsx`: judul + deskripsi berbagi satu container teks, sementara kontrol emoji berada di luar container tersebut dan memakai positioning gutter.
- File utama: `src/app/(workspace)/spaces/[spaceId]/pages/[pageId]/page.tsx`, `src/app/(workspace)/spaces/[spaceId]/pages/[pageId]/page.test.tsx`

### Hierarki baris editor ala GitBook

- Menambahkan pemilihan tipe baris di floating toolbar: Paragraph, Heading 1–3, bullet list, numbered list, dan quote. Tombol indentasi/outdent juga tampil ketika baris yang dipilihmemang bisa dinaikkan/turunkan.
- Mengaktifkan dan memperjelas perilaku indentasi:
  - `Tab` menambahkedalaman indentasi.
  - `Shift+Tab` mengurangi indentasi.
  - Saat toolbar/menu editor terbuka, tombol tetap memilih navigasi UI dulu, bukan memaksa indentasi.
- Menata ulang visual blok agar hierarki tetap terbaca:
  - Body teks editor memakai token `--text-body` (15px/1.6) dan `overflow-wrap` agar baris panjang tidak merusak lebar kolom.
  - Heading 1–4 memakai token tipografi DESIGN.md dengan bobot 700→600, plus heading 5–6 sebagai aksesibilitas fallback.
  - Jarak atas heading lebih besar dari jarak bawahnya supaya heading “melekat” ke bagian di bawahnya.
  - Handle drag/add editor diri-set ulang tingginya per tingkat heading agar tidak off-center.
- Menyelaraskan spacing halaman publik (`.beacon-reading`) dengan struktur hero admin, terutama headings, sementara body public tetap memakai ukuran `body-lg` yang lebih nyaman dibaca.
- File utama:
  - `src/app/globals.css`
  - `src/app/globals.css.test.ts`
  - `src/components/editor/page-editor.tsx`
  - `src/components/editor/formatting-toolbar.tsx`
  - `src/components/editor/formatting-toolbar.test.tsx`

### Judul wajib, deskripsi opsional, dan emoji halaman di editor

- Halaman baru dibuat **tanpa judul**, sehingga field judul langsung menampilkan placeholder `Untitled page` (bukan judul bawaan yang tersimpan sebagai teks). Placeholder yang sama dipakai sebagai label fallback di sidebar, breadcrumb, dan halaman publik (`src/lib/page-label.ts`).
- Judul kini **wajib diisi**: field judul memakai `required`/`aria-required`, dan tombol “Publikasikan” menolak halaman tanpa judul (toast + fokus kembali ke field judul) sebelum dialog konfirmasi terbuka.
- Menambahkan field **Deskripsi** di bawah judul dengan placeholder `Page Description (Optional)`, autosave ter-debounce 800ms, flush saat pindah halaman. Untuk viewer field ini hanya tampil bila terisi.
- Menambahkan **emoji di samping judul** (popover picker + aksi “Hapus emoji”). Emoji hanya tampil bila diisi — sidebar, daftar halaman Space, daftar publik, TOC publik, dan judul halaman publik tidak pernah menampilkan glyph placeholder saat kosong.
- Skema: kolom baru `beacon.pages.description` (default `''`) dan `beacon.pages.emoji` (nullable) di migrasi `supabase/migrations/20261026000100_page_description_emoji.sql` — **harus di-push (`supabase db push`) sebelum perubahan ini dipakai melawan database**.
- File utama: `src/app/(workspace)/spaces/[spaceId]/pages/[pageId]/page.tsx`, `src/components/editor/page-emoji-picker.tsx`, `src/hooks/use-page-meta-autosave.ts`, `src/hooks/use-pages.ts`, `src/components/editor/page-editor-toolbar.tsx`, `src/lib/page-label.ts`, `supabase/migrations/20261026000100_page_description_emoji.sql`
- Status: belum di-commit.

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
- Setelah perubahan editor terakhir: 96 file test / 663 test lulus.
- Lint: 0 error; 1 warning lama di `src/lib/supabase/env.test.ts`.
