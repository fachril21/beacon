"use client";

import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { usePageVersions, useRestoreVersion } from "@/hooks/use-versions";
import { useUser } from "@/hooks/use-users";
import { useSession } from "@/hooks/use-session";
import { setVersionPreview } from "@/lib/version-preview-store";
import { describePublishError } from "@/lib/publish-error";
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
export function VersionHistoryPanel({ page, canRestore, onRestored }: { page: Page; canRestore: boolean; onRestored: () => void }) {
  const versions = usePageVersions(page.id);
  const restoreVersion = useRestoreVersion();
  const { user } = useSession();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const selected = versions.find((v) => v.id === selectedId) ?? null;

  // Show the selected version in the main editor (and lock the live one) for exactly as long as it is selected; the
  // cleanup also covers the panel closing or switching tabs mid-preview.
  useEffect(() => {
    setVersionPreview(page.id, selected);
    return () => setVersionPreview(page.id, null);
  }, [page.id, selected]);

  async function handleRestore() {
    if (!selected || !user) return;
    setIsRestoring(true);
    try {
      await restoreVersion(page.id, selected.id, user.id);
    } catch (error) {
      console.error("[beacon] failed to restore version:", error);
      toast.error("Gagal memulihkan versi, silakan coba lagi.", { description: describePublishError(error) });
      setIsRestoring(false);
      return;
    }
    setIsRestoring(false);
    setConfirmOpen(false);
    setSelectedId(null);
    toast.success("Versi berhasil dipulihkan.");
    onRestored();
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto p-2">
        {versions.length === 0 ? (
          <p className="px-2 py-6 text-center text-body-sm text-muted-foreground">Belum ada riwayat versi.</p>
        ) : (
          versions.map((version) => (
            <button
              key={version.id}
              type="button"
              aria-current={version.id === selectedId ? "true" : undefined}
              onClick={() => setSelectedId(version.id)}
              className={cn(
                "flex w-full flex-col gap-0.5 rounded-md px-3 py-2.5 text-left hover:bg-accent",
                version.id === selectedId && "bg-accent",
              )}
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
      {selected && (
        <div className="flex gap-2 border-t border-border p-4">
          <Button variant="secondary" className="flex-1" onClick={() => setSelectedId(null)}>
            Kembali
          </Button>
          {canRestore && (
            <Button className="flex-1" onClick={() => setConfirmOpen(true)}>
              <RotateCcw className="size-3.5" />
              Pulihkan versi ini
            </Button>
          )}
        </div>
      )}
      {selected && (
        <Dialog open={confirmOpen} onOpenChange={(open) => !isRestoring && setConfirmOpen(open)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Pulihkan versi ini?</DialogTitle>
              <DialogDescription>
                Draf saat ini akan diganti dengan versi {formatTimestamp(selected.createdAt)}. Draf saat ini tetap tersimpan di riwayat
                sehingga dapat dipulihkan kembali.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setConfirmOpen(false)} disabled={isRestoring}>
                Batal
              </Button>
              <Button onClick={() => void handleRestore()} disabled={isRestoring}>
                Pulihkan
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
