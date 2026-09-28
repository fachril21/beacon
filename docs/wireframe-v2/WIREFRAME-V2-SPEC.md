# Beacon — Wireframe v2: Spesifikasi Implementasi

**Untuk:** Claude Code (dan manusia yang me-review)
**Tanggal:** 2026-09-28
**Status:** Draft untuk dieksekusi bertahap
**Referensi visual:** `images/*.png` (lihat `images/README.md`) dan `source/*.dc.html` (acuan ukuran dan warna saja, bukan kode React)

Dokumen ini menerjemahkan wireframe v2 ke pekerjaan konkret di repo `fachril21/beacon`. Tujuannya satu: **merombak layout** supaya lebih rapi tanpa mengubah perilaku, data, atau skema database. Semua nama file di bawah diverifikasi terhadap kondisi repo saat wireframe ini dibuat.

---

## 0. Baca ini dulu

### 0.1 Kondisi repo (fakta, bukan asumsi)

- Stack: Next.js 16.3 (App Router), React 19, Tailwind 4, shadcn/ui + `@base-ui/react`, BlockNote 0.52 (`@blocknote/shadcn`), dnd-kit, cmdk, sonner. **Fabric.js tidak dipakai.** Anotasi saat ini adalah overlay SVG.
- Repo **sudah jauh melewati Phase 1a**: Supabase, presign S3, invite organisasi, notifikasi, org switcher, dan `stepper`/`step` block sudah ada. Abaikan bagian PRD yang bilang "mock data only".
- `AGENTS.md` menyatakan Next.js di repo ini punya breaking changes. **Baca `node_modules/next/dist/docs/` sebelum menyentuh routing, layout, atau API route.**
- Akses data hanya lewat hook di `src/hooks/*`. Jangan impor `src/lib/mock/*` dari komponen.
- UI berbahasa Indonesia. Pertahankan semua copy yang sudah ada kecuali spec ini menyebut teks baru.
- Warna dan tipografi mengikuti `DESIGN.md` dan token di `src/app/globals.css`. **Jangan hardcode hex** di komponen. Nilai hex di file `source/` hanya untuk referensi.

### 0.2 Aturan main

1. **Perombak layout, bukan perilaku.** Semua fitur yang sekarang jalan harus tetap jalan: autosave, offline buffer, publish/update/unpublish, empty-page warning, banner perubahan belum dipublikasikan, drag-and-drop reorder, ⌘K search, role-gating (viewer/editor/admin).
2. **Jangan ubah** `src/hooks/*` (kecuali disebut eksplisit di Bagian 6), `src/lib/supabase/*`, `supabase/migrations/*`, dan `src/app/api/*`.
3. **Tidak ada dependency baru.** Constraint biaya proyek ini keras (lihat PRODUCT.md).
4. **Test harus tetap hijau.** Jalankan `npm run lint`, `npx tsc --noEmit`, dan `npm test` di akhir setiap tahap. Ubah test hanya jika yang berubah adalah struktur/class, bukan perilaku; jelaskan tiap perubahan test di ringkasan.
5. **Hormati catatan remount BlockNote.** State anotasi dan tool aktif sengaja disimpan di store di luar React (`annotatingBlockIds`, `annotation-tool-store`) karena NodeView BlockNote bisa di-remount berulang. Baca `docs/testing/annotation-remount-resilience.tdd.md` dan `docs/testing/annotation-box-shape-dot-fix.tdd.md` sebelum mengubah apa pun di area anotasi. **Jangan pindahkan state itu ke `useState`.**
6. **Kerjakan satu tahap per sesi.** Berhenti di akhir tahap dan laporkan.

### 0.3 Catatan tentang wireframe

- Frame terang di dalam wireframe adalah placeholder screenshot produk, bukan komponen. Bar abu adalah placeholder teks.
- Teks contoh (judul halaman, nama Space, nama orang) adalah contoh saja.
- Elemen yang **tidak ada datanya di kode** ditandai `[DATA GAP]` di bawah. Jangan mengarang data; ikuti keputusan di Bagian 6.

---

## 1. Delta token

Token lebar ada di `src/app/globals.css` (blok `--width-*`). Perubahan:

| Token | Sekarang | Wireframe v2 | Catatan |
|---|---|---|---|
| `--width-sidebar` | 17rem (272px) | **16rem (256px)** | Ubah nilai. |
| `--width-editor-column` | 47.5rem (760px) | 47.5rem | Tetap. |
| `--width-reading-column` | 45rem (720px) | 45rem | Tetap. |
| `--width-screenshot-breakout` | 60rem (960px) | 60rem | Tetap, tapi selalu di-clamp ke lebar container (lihat 3.3). |
| `--width-toc-rail` | 15rem (240px) | **13.75rem (220px)** | Dipakai untuk kolom "Di halaman ini" publik. |
| `--width-right-panel` | (baru) | **20rem (320px)** | Panel kanan editor. |
| `--width-public-tree` | (baru) | **16.25rem (260px)** | Sidebar tema publik. |
| `--height-topbar` | (baru) | **3rem (48px)** | Topbar workspace/editor. |
| `--height-public-nav` | (baru) | **4rem (64px)** | Nav publik. |

Radius, warna, dan skala tipografi: **tidak berubah**, pakai apa yang sudah ada (`--radius` 0.625rem, `radius-lg` untuk card, dst).

Aturan ritme: baris tree sidebar tinggi **32px** (`h-8`), bukan `py-3`. Padding halaman workspace `px-12 py-9`. Konten dibatasi `max-w-[1040px]` di Beranda dan Space.

---

## 2. Peta layout (lihat `images/00-layout-map.png`)

**Workspace / editor** (viewport 1440px):

```
┌────────────┬───────────────────────────────────────────┬──────────┐
│ Sidebar    │ Topbar 48px                                │          │
│ 256px      ├───────────────────────────────┬────────────┤ Panel    │
│            │ Kolom editor 760px (tengah)   │            │ kanan    │
│            │ Screenshot ≤ lebar container  │            │ 320px    │
└────────────┴───────────────────────────────┴────────────┴──────────┘
```

**Publik desktop:** nav 64px; tiga kolom: tree 260px | kolom baca 720px | "Di halaman ini" 220px (disembunyikan di bawah 1280px).

**Publik mobile (390px):** nav 56px, tree jadi sheet dari hamburger, "Di halaman ini" jadi accordion di bawah judul.

**Breakpoint editor:** panel kanan default **terbuka** di ≥1440px dan **tertutup** di bawahnya. Kolom editor memakai `w-full max-w-editor-column px-6`, jadi menyusut dengan wajar bila ruang kurang. Ganti `px-80` yang sekarang.

---

## 3. Spesifikasi per permukaan

### 3.1 Workspace shell (`images/01-beranda.png` sisi kiri)

**File:** `src/components/workspace/workspace-sidebar.tsx`, `page-tree-item.tsx`, `sidebar-row.ts`, `notification-bell.tsx`, `organization-switcher.tsx`, `src/app/(workspace)/layout.tsx`.

Perubahan:

1. **Urutan atas ke bawah:** OrganizationSwitcher → tombol cari (⌘K) → nav (Beranda, Terbaru [opsional, Tahap 6], Notifikasi + badge jumlah belum dibaca) → label "SPACE" dengan tombol "+" → tree → akun.
2. **Hapus blok "Umum"** yang sekarang berisi Space baru / Notifikasi / Pengaturan / Keluar:
   - "Space baru" → tombol "+" di label "SPACE" (membuka `NewSpaceDialog` yang sama).
   - Notifikasi → satu baris nav. Pakai ulang logika `NotificationBell` dan `useUnreadNotificationCount`; hanya tampilannya jadi baris nav dengan badge.
   - "Pengaturan Organisasi" dan "Keluar" → **menu akun** (DropdownMenu) di footer sidebar: klik footer user membuka menu dengan Pengaturan Organisasi dan Keluar.
3. **Tree:** hanya Space yang aktif (sesuai `pathname`) atau Space pertama yang terbuka secara default; sisanya tertutup. Baris tinggi 32px. Indikator aktif tetap bar hijau 2px di kiri (`before:` yang sudah ada). Ganti label Space yang UPPERCASE menjadi teks biasa berbobot 600; label "SPACE" di atas list tetap uppercase kecil.
4. **Ikon kunci** kecil di Space yang `isPublishable === false`.
5. **Pertahankan** drag-and-drop dnd-kit (handle muncul saat hover), tombol "+ sub-halaman", dan menu "…" hapus. Perilaku tidak boleh berubah.
6. Lebar sidebar memakai token baru (256px).

Kriteria selesai: sidebar tampil rapi tanpa scroll berlebih untuk 3 Space; semua test `page-tree-item`, `space-card`, dan `delete-confirm-dialog` lulus; reorder tetap bekerja.

### 3.2 Beranda dan halaman Space (`images/01-beranda.png`, `images/02-space.png`)

**File:** `src/app/(workspace)/page.tsx`, `src/components/workspace/space-card.tsx`, `src/app/(workspace)/spaces/[spaceId]/page.tsx` (+ `members/page.tsx`, `settings/page.tsx`).

**Beranda**
- Header: "Selamat datang, {nama depan}" + subteks. Aksi di topbar: "Space baru" (secondary) dan "Halaman baru" (primary; jika belum ada Space, arahkan membuat Space dulu).
- Grid dua kolom: kiri (fleksibel) dan kanan 300px.
- Kiri: **"Lanjutkan menulis"** (3 card halaman terakhir diubah oleh user; turunkan dari `usePages()` diurutkan `updatedAt`, tanpa hook baru) dan **"Space"** (grid 3 kolom `SpaceCard` + satu kartu putus-putus "Space baru").
- Kanan: **"Perlu perhatian"** — baris: perubahan belum dipublikasikan (hitung dengan `hasUnpublishedChanges`), komentar/notifikasi baru (`useNotifications`). Baris "halaman rating rendah" adalah `[DATA GAP]` (lihat 6.2), sembunyikan di iterasi pertama. **Kolom "Aktivitas tim" `[DATA GAP]`: jangan dibuat.**
- `SpaceCard`: tetap pakai kicker uppercase kecil untuk `space.category`, tambah lebih banyak padding (18px), badge di bawah. Empty state Beranda pakai `EmptyState` yang ada.

**Halaman Space**
- Header: kicker kategori, judul, badge "Dapat dipublikasikan/Hanya internal".
- **Tab** "Halaman | Anggota | Pengaturan" memetakan ke route yang sudah ada (`/spaces/[id]`, `/members`, `/settings`). Buat `src/app/(workspace)/spaces/[spaceId]/layout.tsx` yang merender header + tab, lalu ketiga halaman hanya merender isinya. Tab "Anggota" dan "Pengaturan" hanya tampil untuk admin (logika role yang sudah ada di page.tsx sekarang, pindahkan, jangan tulis ulang).
- Tombol topbar: salin link publik (ikon), "Undang" (hanya admin), "Halaman baru" (primary).
- Isi tab "Halaman": **tabel** halaman berbentuk tree (pakai `flattenPageTree` dari `src/lib/build-page-tree.ts` dengan indentasi per depth). Kolom: Judul | Status (`getPageStatus` → `StatusBadge`) | Penulis | Diubah (`formatRelativeTime`) | Membantu | menu "…". Ada filter teks dan segmented control Semua/Draf/Dipublikasikan (state lokal).
  - Penulis: ambil sekali lewat `useUsers(organizationId)` lalu petakan `createdByUserId`, **bukan** `useUser` per baris.
  - Kolom "Membantu": `[DATA GAP]` (lihat 6.2). Iterasi pertama: sembunyikan kolom ini.

### 3.3 Editor (`images/03-editor.png`)

**File:** `src/app/(workspace)/spaces/[spaceId]/pages/[pageId]/page.tsx`, `src/components/editor/page-editor-toolbar.tsx`, `page-editor.tsx`, `page-toc.tsx`, `version-history-panel.tsx`, `comment-thread-panel.tsx`, `save-status-indicator.tsx`.

**Topbar 48px (satu-satunya bar):**
- Kiri: breadcrumb `Space / Halaman induk / Judul` (`nav aria-label="Breadcrumb"`). **Pindahkan badge rating keluar dari breadcrumb.**
- Kanan, dari kiri: `SaveStatusIndicator` → ikon Komentar → ikon Riwayat → tombol toggle panel kanan → pemisah → `StatusBadge` → **split button** Publish/Perbarui + chevron menu.
- Pertahankan semua logika yang ada di `PageEditorToolbar`: `disabledReason` + tooltip, dialog konfirmasi publish, dialog "halaman masih kosong", dialog unpublish, dialog hapus, antrean offline. Yang berubah hanya tata letak.
- **Pertahankan banner "Anda memiliki perubahan yang belum dipublikasikan"** (PRD Flow 4 langkah 4) tepat di bawah topbar. Wireframe menampilkan badge "Ada perubahan" di topbar; banner tetap wajib ada, dua-duanya boleh muncul.
- Link "Lihat halaman publik" tetap ada sebagai ikon saat halaman terpublikasi (pindahkan ke menu chevron kalau topbar terlalu penuh di lebar sempit).

**Kolom tulis:**
- Ganti container `px-80` menjadi `mx-auto w-full max-w-editor-column px-6 pt-11`.
- Judul (input, `text-h1`) → baris meta: avatar 22px + "{nama} · diubah {relatif}" + separator + "{n} respons · {x}% membantu" (data dari `useHelpfulnessRate`, hanya untuk editor/admin saat terpublikasi). Footer "Dibuat oleh…" yang sekarang di bawah halaman dihapus karena informasinya pindah ke atas.
- Gutter blok (tombol "+" dan drag handle) muncul saat hover di kiri kolom; ini perilaku BlockNote, cukup pastikan tidak terpotong oleh overflow.

**Panel kanan bertab 320px** (satu komponen baru, mis. `src/components/editor/editor-side-panel.tsx`):
- Tab: **Daftar isi | Komentar (n) | Riwayat**. Tombol X menutup panel.
- *Daftar isi:* pakai isi `PageToc` (ekstrak `collectHeadings` ke `src/lib/` bila perlu supaya publik bisa memakainya juga; pertahankan auto-highlight dengan `scrollRootRef`).
- *Komentar:* daftar komentar halaman dari `usePageComments`. Ikon komentar per blok yang sudah ada di `screenshot-block` tetap; kliknya membuka tab Komentar dan memfokuskan blok itu (ganti popover). Jika ini terlalu besar untuk satu tahap, biarkan popover yang ada dan hanya isi tab dengan daftar; tulis ini di laporan.
- *Riwayat:* pindahkan isi `VersionHistoryPanel` (daftar versi, preview read-only, banner "preview", tombol Restore). Jangan ubah semantik restore.
- State panel: `rightPanel: null | "toc" | "comments" | "history"` di halaman editor. Item "Riwayat Versi" di menu chevron membuka panel di tab Riwayat.

**Step card (`stepper`/`step` block):** wireframe menampilkan setiap langkah sebagai lingkaran bernomor + judul + isi + screenshot + deskripsi, dengan garis penghubung vertikal. **Ini adalah `stepper-block.tsx` yang sudah ada, bukan block type baru.** Screenshot block berada *di dalam* `step` sebagai child. Tugasnya hanya menyelaraskan tampilan (lingkaran `--primary-muted`, garis penghubung `--border`) dan memastikan screenshot block di dalam step mengikuti lebar container (`max-w-screenshot-breakout` di-clamp ke lebar kolom ketika panel kanan terbuka). Cek dulu di mana CSS penomoran/garis penghubung stepper berada sebelum mengubahnya (komentar di `stepper-block.tsx` menyebut `globals.css`, tetapi jangan berasumsi lokasinya).

**Screenshot block (mode baca dan edit):** tambahkan pill **"Edit anotasi"** di pojok kanan atas gambar saat hover (menggantikan tombol pensil sekarang bila ada). Beri **frame netral** (border 1px `--border`, radius `radius-lg`) di sekeliling gambar supaya screenshot terang tidak silau di kanvas gelap.

### 3.4 Mode anotasi (`images/04-anotasi.png`)

**File:** `src/components/editor/annotation-editor-overlay.tsx`, `annotation-overlay.tsx`, `screenshot-block.tsx`, `src/lib/annotation-tool-store.ts`, `src/lib/types.ts` (`Annotation`, `AnnotationShapeType`).

Sekarang: toolbar horizontal di atas gambar, 4 tool (`marker`, `arrow`, `box`, `label`), swatch warna, hapus lewat tombol Delete/Backspace. **Tidak ada undo/redo, tidak ada blur, tidak ada daftar objek.**

Target: **mode fokus layar penuh** yang dibuka dari pill "Edit anotasi".
- Topbar 48px: X (tutup), judul "Anotasi — Langkah n: …", status simpan, "Batal" (ghost), "Selesai" (primary).
- **Rail tool kiri 64px** (`--sidebar` background): Nomor, Panah, Kotak, Label, Blur; pemisah; Urungkan, Ulangi, Hapus objek. Tool aktif: fill `--primary` + `--primary-foreground`. Tool Blur diberi cincin `--warning` 1px (DESIGN.md §6.3).
- **Bar properti melayang** di atas kanvas: swatch warna (tetap 5 warna dari `SWATCHES`), tebal garis (3 pilihan), dan pratinjau "Nomor berikutnya".
- **Kanvas** tengah dengan latar `--muted`. Petunjuk keyboard di bawah: `Del` hapus, `⌘Z` urungkan, `Esc` keluar.
- **Panel kanan 320px:** daftar objek (klik untuk memilih, ikon hapus), field "Deskripsi langkah" (sama dengan deskripsi screenshot block sekarang, sumber data tetap `useUpdateScreenshotDescription`), dan pesan peringatan blur (lihat D1).
- **Gesture Nomor:** klik = badge angka; drag = badge + panah ke titik lepas (pola CleanShot). Penomoran otomatis dari `order`, dan menghapus marker me-renumber sisanya.
- **Undo/redo:** tumpukan riwayat lokal di dalam overlay (array snapshot `Annotation[]`), bukan di store BlockNote. Batas 50 langkah.

Persistensi: pakai jalur yang sudah ada: `patchAnnotationsLocal` (segera, aman remount) lalu `updateAnnotations` (debounce 500ms). **Mode fokus harus membaca dan menulis store yang sama** sehingga remount tidak mereset apa pun. Flag "sedang menganotasi" tetap di `annotatingBlockIds`.

Implementasi mode fokus sebagai Dialog/overlay `fixed inset-0` yang dirender lewat portal (komponen `ui/dialog` atau `ui/sheet` sudah ada). Simpan `blockId` yang sedang dianotasi di store, bukan di state komponen.

**Blur:** tambahkan `"blur"` ke `AnnotationShapeType`. Bentuknya sama dengan `box` (`x, y, width, height` dalam fraksi). Kolom DB `annotation_json` adalah `jsonb`, jadi tidak perlu migrasi, tetapi cek `src/lib/supabase/mappers.ts` dan test-nya. **Blur tidak boleh dirilis ke publik sebelum keputusan D1 diselesaikan.**

### 3.5 Situs publik (`images/05`, `06`, `07`)

**File:** `src/app/(public)/public-layout-client.tsx`, `src/components/public/public-nav.tsx`, `public-home-content.tsx`, `public-space-view.tsx`, `public-toc.tsx`, `public-page-view.tsx`, `public-page-content.tsx`, `feedback-widget.tsx`, `public-search-command.tsx`.

**Nav (64px):** logo + "{Org} Docs" di kiri; tombol cari (⌘K atau `/`) dan tombol "Hubungi dukungan" di kanan `[DATA GAP]` (lihat 6.2; sembunyikan sampai ada URL dukungan). **Sembunyikan org switcher "Pratinjau developer" di production** (`process.env.NODE_ENV !== "production"` atau flag env); di dev tetap boleh.

**Beranda publik** (`PublicHomeContent`):
- Hero terpusat: judul (`text-display`), subteks, search box besar 640px (klik/`/` membuka `PublicSearchCommand`), baris "Populer:" berisi chip. Chip `[DATA GAP]`: iterasi pertama pakai 4 judul halaman terpublikasi terbaru; jangan menyebutnya "populer" bila bukan dihitung dari traffic (pakai label "Terbaru:").
- "Jelajahi berdasarkan topik": grid 3 kolom card Space (dari `usePublicSpaces`: nama, kategori, `publishedPageCount`).
- "Panduan terbaru": daftar 4–5 halaman terbaru lintas Space. `[DATA GAP]` butuh hook baru (6.2).

**Halaman artikel** (`PublicPageView`, `PublicToc`, layout):
- Kolom kiri: `PublicToc` diperlebar ke 260px, judul Space uppercase kecil, tautan "Semua topik", tree dengan indikator aktif hijau.
- Kolom tengah 720px: breadcrumb (Org Docs › Space › halaman induk), judul `text-display`, baris meta "Diperbarui {tanggal}" (dari `publishedAt` di snapshot). **Jangan tampilkan nama penulis** sampai keputusan D3. Isi mengikuti `PublicPageContent`. Callout mengikuti gaya `--info-muted`. Akhiri dengan `FeedbackWidget` (restyle saja, perilaku tidak berubah) dan kartu **Sebelumnya/Berikutnya** dari urutan `flattenPageTree`.
- Kolom kanan 220px: "Di halaman ini" dari heading di `snapshot.content` (pakai `collectHeadings` yang diekstrak), sticky, disembunyikan <1280px.
- Tombol "Salin sebagai Markdown" dan "Buka di AI": **opsional, Tahap 6**.

**Mobile:** nav 56px dengan hamburger yang membuka `ui/sheet` berisi tree; "Di halaman ini" jadi accordion; tombol feedback tinggi ≥44px; screenshot lebar penuh dan boleh di-tap untuk memperbesar (opsional).

**Aksesibilitas:** breadcrumb dan tree memakai `nav` dengan `aria-label`; semua tombol ikon punya `aria-label`; fokus keyboard memakai `--ring`.

---

## 4. Urutan kerja (tahap)

| Tahap | Isi | Menyentuh | Risiko |
|---|---|---|---|
| 0 | Baca repo + laporan rencana (tanpa ubah kode) | — | Rendah |
| 1 | Token + workspace shell (sidebar, menu akun) | globals.css, workspace/* | Rendah |
| 2 | Beranda + halaman Space (layout + tab + tabel) | (workspace)/* | Sedang |
| 3 | Editor: topbar, kolom, panel kanan bertab | editor/*, pages/[pageId] | **Tinggi** |
| 4 | Step card + screenshot block frame + pill "Edit anotasi" | stepper, screenshot-block | Sedang |
| 5 | Mode anotasi fokus (tanpa Blur) + undo/redo + daftar objek | annotation-* | **Tinggi** |
| 6 | Situs publik (desktop + mobile) | public/* | Sedang |
| 7 | Opsional: Blur + burn-in (D1), Terbaru, Markdown/AI, metrik rating | beberapa | **Tinggi** |

Alasan urutan: sidebar dan topbar dipakai semua layar; area anotasi paling rapuh (remount BlockNote), jadi dikerjakan setelah kerangka editor stabil.

---

## 5. Kriteria penerimaan global

- `npm run lint`, `npx tsc --noEmit`, `npm test` lulus di setiap tahap.
- Tidak ada hex hardcode baru di komponen; semua lewat token/kelas Tailwind yang sudah ada.
- Tidak ada perubahan pada `src/hooks/*` di luar yang disebut di 6.2, dan tidak ada migrasi baru kecuali D1 diputuskan.
- Verifikasi visual di 1440px, 1280px, dan 390px; laporkan apa yang diverifikasi dan bagaimana. Jika tidak bisa menjalankan browser, katakan itu secara eksplisit alih-alih mengklaim sudah dicek.
- Tidak ada regresi keyboard: ⌘K, Esc, Delete di anotasi, Tab order di topbar.
- Warna teks hijau hanya untuk state aktif/link kecil; teks isi selalu `--foreground` (DESIGN.md prinsip 1).

---

## 6. Keputusan dan data yang belum ada

### 6.1 Keputusan yang harus diambil pemilik produk

**D1 — Blur harus ditanam permanen saat publish.** Anotasi disimpan sebagai layer JSON terpisah dari gambar asli (`imageUrl` menunjuk objek S3 asli, dan `publishedContentSnapshot.screenshotBlocks` menyalin `imageUrl` + `annotations`). Jika blur hanya layer, gambar asli yang tidak ter-blur tetap bisa diambil siapa pun lewat URL-nya, dan blur/pixelate pun bukan jaminan teks tak terbaca. Jalur yang mungkin: (a) saat Publish/Update, render gambar + blur ke satu gambar datar di browser (canvas), unggah lewat `/api/s3/presign`, dan simpan URL datar di snapshot; (b) tidak merilis Blur sampai (a) siap. **Sampai diputuskan, jangan tampilkan tool Blur ke user.** Salah satu yang wajib diperiksa dulu: bagaimana `publish_page()` (RPC di `supabase/migrations/20260806100200_publishing_rpcs.sql`) membentuk snapshot, karena flatten harus terjadi sebelum RPC itu dipanggil.

**D2 — Kolom "Aktivitas tim" dan "Halaman rating rendah" di Beranda.** Tidak ada sumbernya. Rekomendasi: jangan dibuat di iterasi ini.

**D3 — Nama penulis di halaman publik.** Wireframe menampilkan "Ditulis oleh …". Itu membuka nama karyawan ke publik. Default spec ini: tidak ditampilkan.

**D4 — Tombol "Hubungi dukungan".** Perlu URL/tujuan per organisasi. Default: disembunyikan.

### 6.2 Data gap dan hook yang mungkin perlu ditambah (Tahap 7 / opsional)

| Kebutuhan | Kondisi | Usulan |
|---|---|---|
| Rating per halaman untuk tabel Space | `useHelpfulnessRate(pageId)` hanya per halaman | Hook agregat baru `useSpaceHelpfulness(spaceId)` yang mengambil sekali. Jangan panggil hook per baris. |
| Halaman rating rendah (Beranda) | Tidak ada | Turunan dari hook di atas, ambang mis. <60% dengan ≥5 respons. |
| Panduan terbaru publik | `usePublicSpaces` hanya mengembalikan Space + jumlah | Hook baru `usePublicLatestPages(organizationId, limit)` yang hanya mengembalikan halaman terpublikasi. Harus lewat jalur RLS anon yang sama. |
| Halaman "Terbaru" workspace | Tidak ada route | Opsional; pakai daftar yang sama dengan "Lanjutkan menulis". |
| "Salin sebagai Markdown" | Tidak ada di sisi publik | Verifikasi apakah BlockNote core menyediakan konversi markdown yang cukup tanpa fitur berbayar; jika tidak, lewati. |

Setiap hook baru harus punya test (mengikuti pola `*.test.ts` yang ada) dan tidak boleh melonggarkan RLS.

---

## 7. Risiko yang sudah diketahui

- **Remount NodeView BlockNote** (lihat 0.2 butir 5). Pelanggaran biasanya muncul sebagai tool yang tiba-tiba terlepas, bentuk anotasi yang "loncat", atau kedip.
- **Test yang mengunci struktur.** Beberapa test mengecek class atau struktur DOM (`page-tree-item`, `space-card`, `public-toc`, `public-home-content`, `public-space-view`, `page-editor-toolbar`, `annotation-*`). Perbarui hanya jika perilaku tidak berubah.
- **Panel kanan + kolom editor di layar sempit.** Di 1280px, ruang tulis = 1280 − 256 − 320 = 704px < 760px. Karena itu panel default tertutup di bawah 1440px dan kolom memakai `max-w`, bukan lebar tetap.
- **Konteks perubahan lebar sidebar.** Token 272px → 256px memengaruhi semua halaman workspace; cek `w-sidebar` di layout dan `sidebar.tsx`.
- **Teks Indonesia.** Jaga kapitalisasi dan gaya copy yang ada ("Halaman", "Publikasikan", "Perbarui").

---

## 8. Pemetaan cepat wireframe → file

| Artboard | File utama |
|---|---|
| 01 Beranda | `app/(workspace)/page.tsx`, `workspace/workspace-sidebar.tsx`, `workspace/space-card.tsx` |
| 02 Space | `app/(workspace)/spaces/[spaceId]/{layout(baru),page,members/page,settings/page}.tsx` |
| 03 Editor | `app/(workspace)/spaces/[spaceId]/pages/[pageId]/page.tsx`, `editor/page-editor-toolbar.tsx`, `editor/editor-side-panel.tsx` (baru), `editor/page-toc.tsx`, `editor/version-history-panel.tsx`, `editor/comment-thread-panel.tsx`, `editor/stepper-block.tsx`, `editor/screenshot-block.tsx` |
| 04 Anotasi | `editor/annotation-editor-overlay.tsx`, `editor/annotation-overlay.tsx`, `lib/annotation-tool-store.ts`, `lib/types.ts` |
| 05 Publik beranda | `public/public-home-content.tsx`, `public/public-nav.tsx`, `public/public-search-command.tsx` |
| 06 Publik artikel | `public/public-page-view.tsx`, `public/public-toc.tsx`, `public/feedback-widget.tsx`, `app/(public)/public-layout-client.tsx` |
| 07 Publik mobile | komponen yang sama, dengan `ui/sheet` untuk tree dan `hooks/use-mobile.ts` |
