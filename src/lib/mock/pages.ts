import type { Page } from "@/lib/types";
import { doc, paragraph, heading, quote, bulletList, checklist, codeBlock, divider, screenshotNode, emptyDoc } from "./lexical-content";

export const mockPages: Page[] = [
  // space-mobile-app — 3 levels of nesting (Flow 2 step 5 / Epic 3 AC)
  {
    id: "page-getting-started",
    spaceId: "space-mobile-app",
    parentPageId: null,
    title: "Memulai dengan Aplikasi Mobile",
    order: 0,
    content: doc([
      paragraph(
        "Panduan ini menjelaskan langkah pertama menggunakan aplikasi mobile Dibimbing, mulai dari masuk hingga menjelajahi beranda.",
      ),
      heading("h2", "Langkah 1 — Masuk ke akun Anda"),
      screenshotNode("shot-login-1"),
      paragraph("Gunakan email yang sama dengan akun Dibimbing Anda di web."),
      heading("h2", "Langkah 2 — Menjelajahi Beranda"),
      screenshotNode("shot-login-2"),
      quote("Tips: ikon profil di kanan atas menyimpan pengaturan akun dan notifikasi."),
      heading("h2", "Yang perlu disiapkan"),
      checklist([
        { text: "Email terdaftar di Dibimbing", checked: true },
        { text: "Kata sandi aktif", checked: true },
        { text: "Koneksi internet stabil", checked: false },
      ]),
      divider(),
      paragraph("Jika mengalami kendala, lihat panduan Mengatasi Masalah Login."),
    ]),
    visibility: "publishable",
    isPublished: true,
    publishedContentSnapshot: null, // filled in below to avoid self-reference before doc() runs twice
    publishedAt: "2025-11-04T01:10:00.000Z",
    createdByUserId: "user-fachril",
    createdAt: "2025-11-04T00:30:00.000Z",
    updatedAt: "2026-08-01T05:00:00.000Z",
  },
  {
    id: "page-login-flow",
    spaceId: "space-mobile-app",
    parentPageId: "page-getting-started",
    title: "Alur Masuk & Registrasi",
    order: 0,
    content: doc([
      paragraph("Detail lengkap proses masuk dan pendaftaran akun baru di aplikasi mobile."),
      paragraph("Draf ini belum dipublikasikan — masih dalam proses penulisan."),
    ]),
    visibility: "internal",
    isPublished: false,
    publishedContentSnapshot: null,
    publishedAt: null,
    createdByUserId: "user-sarah",
    createdAt: "2025-11-10T02:00:00.000Z",
    updatedAt: "2026-07-20T02:00:00.000Z",
  },
  {
    id: "page-login-troubleshoot",
    spaceId: "space-mobile-app",
    parentPageId: "page-login-flow",
    title: "Mengatasi Masalah Login",
    order: 0,
    content: doc([
      paragraph("Solusi untuk masalah umum saat mencoba masuk ke aplikasi."),
      bulletList([
        "Pastikan email dan kata sandi benar",
        "Periksa koneksi internet",
        "Reset kata sandi jika lupa",
      ]),
    ]),
    visibility: "internal",
    isPublished: false,
    publishedContentSnapshot: null,
    publishedAt: null,
    createdByUserId: "user-sarah",
    createdAt: "2025-11-11T03:00:00.000Z",
    updatedAt: "2025-11-11T03:00:00.000Z",
  },
  {
    id: "page-notifications",
    spaceId: "space-mobile-app",
    parentPageId: "page-getting-started",
    title: "Pengaturan Notifikasi",
    order: 1,
    content: doc([
      paragraph("Cara mengaktifkan dan menonaktifkan notifikasi push pada aplikasi mobile."),
    ]),
    visibility: "internal",
    isPublished: false,
    publishedContentSnapshot: null,
    publishedAt: null,
    createdByUserId: "user-fachril",
    createdAt: "2025-11-12T03:00:00.000Z",
    updatedAt: "2025-11-12T03:00:00.000Z",
  },
  {
    id: "page-mobile-faq",
    spaceId: "space-mobile-app",
    parentPageId: null,
    title: "FAQ Aplikasi Mobile",
    order: 1,
    content: doc([
      paragraph("Kumpulan pertanyaan yang paling sering diajukan pengguna."),
      heading("h3", "Apakah aplikasi tersedia untuk iOS dan Android?"),
      paragraph("Ya, aplikasi tersedia di App Store dan Google Play."),
      codeBlock("beacon --version\n> beacon 1.0.0", "bash"),
    ]),
    visibility: "publishable",
    isPublished: true,
    publishedContentSnapshot: null,
    publishedAt: "2025-11-15T04:00:00.000Z",
    createdByUserId: "user-fachril",
    createdAt: "2025-11-15T03:00:00.000Z",
    updatedAt: "2025-11-15T04:00:00.000Z",
  },

  // space-admin-dashboard — internal-only Space (isPublishable: false)
  {
    id: "page-admin-overview",
    spaceId: "space-admin-dashboard",
    parentPageId: null,
    title: "Ringkasan Dashboard Admin",
    order: 0,
    content: doc([
      paragraph("Panduan internal untuk tim yang mengelola Dashboard Admin Dibimbing."),
      screenshotNode("shot-admin-1"),
      paragraph("Data pengguna pada tangkapan layar di atas telah disamarkan untuk contoh ini."),
    ]),
    visibility: "internal",
    isPublished: false,
    publishedContentSnapshot: null,
    publishedAt: null,
    createdByUserId: "user-sarah",
    createdAt: "2025-11-06T04:00:00.000Z",
    updatedAt: "2025-11-06T04:00:00.000Z",
  },

  // space-onboarding
  {
    id: "page-onboarding-welcome",
    spaceId: "space-onboarding",
    parentPageId: null,
    title: "Selamat Datang di Dibimbing",
    order: 0,
    content: emptyDoc(),
    visibility: "internal",
    isPublished: false,
    publishedContentSnapshot: null,
    publishedAt: null,
    createdByUserId: "user-fachril",
    createdAt: "2025-11-20T01:30:00.000Z",
    updatedAt: "2025-11-20T01:30:00.000Z",
  },

  // space-lms (org-cakrawala) — publishable Space, but Organization has no
  // verified domain yet, so Publish stays disabled (Epic 6/8a).
  {
    id: "page-lms-intro",
    spaceId: "space-lms",
    parentPageId: null,
    title: "Pengantar Platform LMS",
    order: 0,
    content: doc([
      paragraph("Panduan singkat untuk dosen baru menggunakan Platform LMS Cakrawala University."),
      screenshotNode("shot-lms-1"),
    ]),
    visibility: "publishable",
    isPublished: false,
    publishedContentSnapshot: null,
    publishedAt: null,
    createdByUserId: "user-maya",
    createdAt: "2026-01-13T01:00:00.000Z",
    updatedAt: "2026-01-13T01:00:00.000Z",
  },
  {
    id: "page-lms-course-creation",
    spaceId: "space-lms",
    parentPageId: "page-lms-intro",
    title: "Membuat Kursus Baru",
    order: 0,
    content: doc([
      paragraph("Langkah-langkah membuat kursus baru di Platform LMS."),
    ]),
    visibility: "internal",
    isPublished: false,
    publishedContentSnapshot: null,
    publishedAt: null,
    createdByUserId: "user-andi",
    createdAt: "2026-01-14T01:00:00.000Z",
    updatedAt: "2026-01-14T01:00:00.000Z",
  },
];

// Published pages carry a decoupled snapshot (PRD.md §5.3) — build it from the
// live content at fixture-seed time so Stage 1 can demonstrate the
// "unpublished changes" banner by drifting `content` from the snapshot.
for (const page of mockPages) {
  if (page.isPublished && page.publishedAt) {
    page.publishedContentSnapshot = {
      title: page.title,
      content: page.content,
      screenshotBlocks: {},
      publishedAt: page.publishedAt,
    };
  }
}

// page-mobile-faq has since been edited without republishing, to demonstrate
// the "You have unpublished changes" banner (Flow 4 step 4 / Epic 6 US6.3).
const faqPage = mockPages.find((p) => p.id === "page-mobile-faq");
if (faqPage) {
  faqPage.content = doc([
    paragraph("Kumpulan pertanyaan yang paling sering diajukan pengguna."),
    heading("h3", "Apakah aplikasi tersedia untuk iOS dan Android?"),
    paragraph("Ya, aplikasi tersedia di App Store dan Google Play, gratis untuk diunduh."),
    heading("h3", "Apakah aplikasi mendukung mode offline?"),
    paragraph("Sebagian konten dapat diakses offline setelah dibuka sekali secara online."),
  ]);
  faqPage.updatedAt = "2026-08-05T02:00:00.000Z";
}
