"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
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

/**
 * "Riwayat" tab body of the editor side panel: version list, read-only
 * preview with its "Pratinjau versi" banner, and Restore. The panel chrome
 * (header, close button) belongs to EditorSidePanel; `onRestored` fires
 * right after a restore is kicked off, exactly where the standalone panel
 * used to close itself.
 */
export function VersionHistoryPanel({ page, onRestored }: { page: Page; onRestored: () => void }) {
  const versions = usePageVersions(page.id);
  const restoreVersion = useRestoreVersion();
  const { user } = useSession();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = versions.find((v) => v.id === selectedId) ?? null;

  function handleRestore() {
    if (!selected || !user) return;
    restoreVersion(page.id, selected.id, user.id);
    setSelectedId(null);
    onRestored();
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
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
    </div>
  );
}
