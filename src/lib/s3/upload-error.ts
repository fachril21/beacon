/**
 * Maps a thrown screenshot-upload error to a Bahasa Indonesia toast message.
 *
 * The upload path (`useUploadScreenshot` -> `/api/s3/presign`) throws an
 * `Error` whose `message` is a machine-readable code (`FILE_TOO_LARGE`,
 * `INVALID_FILE_TYPE`, ...), mirroring the code-not-prose convention the
 * Organization/Space invite routes use. Keeping the user-facing copy here
 * lets the route and the hook stay language-neutral.
 */
export function screenshotUploadErrorMessage(_error: unknown): string {
  return "Gagal mengunggah gambar, silakan coba lagi.";
}
