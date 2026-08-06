import type { Version } from "@/lib/types";
import { doc, heading, paragraph } from "./lexical-content";

export const mockVersions: Version[] = [
  {
    id: "version-1",
    pageId: "page-getting-started",
    title: "Memulai dengan Aplikasi Mobile",
    content: doc([heading("h1", "Memulai dengan Aplikasi Mobile"), paragraph("Draf pertama, belum lengkap.")]),
    createdByUserId: "user-fachril",
    createdAt: "2025-11-04T00:30:00.000Z",
    isRestoreOf: null,
  },
  {
    id: "version-2",
    pageId: "page-getting-started",
    title: "Memulai dengan Aplikasi Mobile",
    content: doc([
      heading("h1", "Memulai dengan Aplikasi Mobile"),
      paragraph("Menambahkan langkah masuk dan tangkapan layar pertama."),
    ]),
    createdByUserId: "user-fachril",
    createdAt: "2025-11-04T01:10:00.000Z",
    isRestoreOf: null,
  },
  {
    id: "version-3",
    pageId: "page-getting-started",
    title: "Memulai dengan Aplikasi Mobile",
    content: doc([
      heading("h1", "Memulai dengan Aplikasi Mobile"),
      paragraph("Versi lengkap dengan langkah masuk, beranda, dan checklist persiapan."),
    ]),
    createdByUserId: "user-fachril",
    createdAt: "2026-08-01T05:00:00.000Z",
    isRestoreOf: null,
  },
  {
    id: "version-4",
    pageId: "page-mobile-faq",
    title: "FAQ Aplikasi Mobile",
    content: doc([heading("h1", "FAQ Aplikasi Mobile"), paragraph("Versi awal FAQ.")]),
    createdByUserId: "user-fachril",
    createdAt: "2025-11-15T03:00:00.000Z",
    isRestoreOf: null,
  },
];
