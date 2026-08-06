"use client";

import { useState } from "react";
import { X, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePageVersions, useRestoreVersion } from "@/hooks/use-versions";
import { useUser } from "@/hooks/use-users";
import { useSession } from "@/hooks/use-session";
import { extractPlainText } from "@/lib/extract-text";
import { cn } from "@/lib/utils";
import type { Page } from "@/lib/types";

function formatTimestamp(iso: string) {
  return new Date(iso).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

function VersionAuthor({ userId }: { userId: string }) {
  const user = useUser(userId);
  return <>{user?.name ?? "Pengguna"}</>;
}

export function VersionHistoryPanel({ page, onClose }: { page: Page; onClose: () => void }) {
  const versions = usePageVersions(page.id);
  const restoreVersion = useRestoreVersion();
  const { user } = useSession();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = versions.find((v) => v.id === selectedId) ?? null;

  function handleRestore() {
    if (!selected || !user) return;
    restoreVersion(page.id, selected.id, user.id);
    setSelectedId(null);
    onClose();
  }

  return (
    <aside className="flex w-80 shrink-0 flex-col border-l border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-h4 font-semibold text-foreground">Riwayat Versi</h2>
        <Button size="icon-sm" variant="ghost" onClick={onClose} aria-label="Tutup">
          <X className="size-4" />
        </Button>
      </div>

      {selected ? (
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="border-b border-warning/30 bg-warning-muted px-4 py-2.5 text-caption text-warning-muted-foreground">
            Pratinjau versi — bukan draf yang sedang aktif
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <p className="text-caption text-muted-foreground">{formatTimestamp(selected.createdAt)}</p>
            <h3 className="mt-1 text-h4 font-semibold text-foreground">{selected.title || "Halaman tanpa judul"}</h3>
            <p className="mt-3 text-body-sm whitespace-pre-wrap text-muted-foreground">{extractPlainText(selected.content).slice(0, 600)}</p>
          </div>
          <div className="flex gap-2 border-t border-border p-4">
            <Button variant="secondary" className="flex-1" onClick={() => setSelectedId(null)}>
              Kembali
            </Button>
            <Button className="flex-1" onClick={handleRestore}>
              <RotateCcw className="size-3.5" />
              Pulihkan versi ini
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-2">
          {versions.length === 0 ? (
            <p className="px-2 py-6 text-center text-body-sm text-muted-foreground">Belum ada riwayat versi.</p>
          ) : (
            versions.map((version) => (
              <button
                key={version.id}
                type="button"
                onClick={() => setSelectedId(version.id)}
                className={cn("flex w-full flex-col gap-0.5 rounded-md px-3 py-2.5 text-left hover:bg-accent")}
              >
                <span className="text-body-sm text-foreground">{formatTimestamp(version.createdAt)}</span>
                <span className="text-caption text-muted-foreground">
                  <VersionAuthor userId={version.createdByUserId} />
                  {version.isRestoreOf && " · Dipulihkan dari versi sebelumnya"}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </aside>
  );
}
