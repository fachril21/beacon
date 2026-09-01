/**
 * Maps a thrown screenshot-upload error to a Bahasa Indonesia toast message.
 *
 * The upload path (`useUploadScreenshot` -> `/api/s3/presign`) throws an
 * `Error` whose `message` is a machine-readable code (`FILE_TOO_LARGE`,
 * `INVALID_FILE_TYPE`, ...), mirroring the code-not-prose convention the
 * Organization/Space invite routes use. Keeping the user-facing copy here
 * lets the route and the hook stay language-neutral.
 */
export function screenshotUploadErrorMessage(error: unknown): string {
  const code = error instanceof Error ? error.message : "";
  switch (code) {
    case "FILE_TOO_LARGE":
      return "Gambar terlalu besar untuk diunggah.";
    case "INVALID_FILE_TYPE":
      return "Berkas harus berupa gambar (PNG, JPG, atau WEBP).";
    default:
      return "Gagal mengunggah gambar, silakan coba lagi.";
  }
}
