import { Loader2, Check, CloudOff, RefreshCw, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SaveStatus } from "@/hooks/use-page-autosave";

const CONFIG: Record<Exclude<SaveStatus, "idle">, { label: string; icon: typeof Loader2; className: string; spin?: boolean }> = {
  saving: { label: "Menyimpan…", icon: Loader2, className: "text-muted-foreground", spin: true },
  saved: { label: "Tersimpan", icon: Check, className: "text-muted-foreground" },
  offline: { label: "Offline — menyimpan secara lokal", icon: CloudOff, className: "text-warning" },
  syncing: { label: "Menyinkronkan…", icon: RefreshCw, className: "text-muted-foreground", spin: true },
  error: { label: "Gagal menyimpan — mencoba lagi", icon: AlertTriangle, className: "text-destructive" },
};

export function SaveStatusIndicator({ status }: { status: SaveStatus }) {
  if (status === "idle") return null;
  const { label, icon: Icon, className, spin } = CONFIG[status];
  return (
    <span className={cn("flex items-center gap-1.5 text-caption", className)}>
      <Icon className={cn("size-3.5", spin && "animate-spin")} />
      {label}
    </span>
  );
}
