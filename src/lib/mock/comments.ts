import type { Comment, Feedback } from "@/lib/types";

export const mockComments: Comment[] = [
  {
    id: "comment-1",
    pageId: "page-getting-started",
    blockId: "shot-login-1",
    authorUserId: "user-sarah",
    body: "Apakah kita perlu menambahkan catatan soal SSO di sini juga? @Budi Santoso mungkin punya konteksnya.",
    mentionedUserIds: ["user-budi"],
    createdAt: "2026-07-28T03:00:00.000Z",
  },
  {
    id: "comment-2",
    pageId: "page-getting-started",
    blockId: "shot-login-1",
    authorUserId: "user-fachril",
    body: "Belum, SSO masih di roadmap Stage 3. Kita catat saja dulu di sini.",
    mentionedUserIds: [],
    createdAt: "2026-07-28T04:15:00.000Z",
  },
  {
    id: "comment-3",
    pageId: "page-getting-started",
    blockId: "shot-login-2",
    authorUserId: "user-budi",
    body: "Panah pada gambar ini agak menutupi ikon notifikasi, mungkin bisa digeser sedikit?",
    mentionedUserIds: [],
    createdAt: "2026-07-30T01:00:00.000Z",
  },
];

export const mockFeedback: Feedback[] = [
  { id: "feedback-1", pageId: "page-getting-started", helpful: true, comment: null, createdAt: "2026-07-10T02:00:00.000Z" },
  { id: "feedback-2", pageId: "page-getting-started", helpful: true, comment: null, createdAt: "2026-07-11T03:00:00.000Z" },
  { id: "feedback-3", pageId: "page-getting-started", helpful: true, comment: "Sangat jelas, terima kasih!", createdAt: "2026-07-14T05:00:00.000Z" },
  { id: "feedback-4", pageId: "page-getting-started", helpful: false, comment: "Langkah reset kata sandi belum dijelaskan.", createdAt: "2026-07-20T02:00:00.000Z" },
  { id: "feedback-5", pageId: "page-mobile-faq", helpful: true, comment: null, createdAt: "2026-07-16T02:00:00.000Z" },
  { id: "feedback-6", pageId: "page-mobile-faq", helpful: true, comment: null, createdAt: "2026-07-18T02:00:00.000Z" },
];
