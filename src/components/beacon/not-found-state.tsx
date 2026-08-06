import { FileQuestion } from "lucide-react";
import { EmptyState } from "./empty-state";

/** Generic "not found"-style state for unauthorized resources — never reveals the screen exists (Flow 7 / 7a). */
export function NotFoundState() {
  return (
    <main className="flex flex-1 items-center justify-center">
      <EmptyState icon={FileQuestion} title="Halaman tidak ditemukan" description="Halaman yang Anda cari tidak ada atau Anda tidak memiliki akses." />
    </main>
  );
}
