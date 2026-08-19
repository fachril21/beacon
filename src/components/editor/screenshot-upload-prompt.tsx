"use client";

import { useCallback, useState } from "react";
import { ImagePlus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { requestImageFile } from "@/lib/file-select-singleton";

function readImageDimensions(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = reject;
    img.src = url;
  });
}

export function ScreenshotUploadPrompt({
  onUpload,
  isUploading = false,
}: {
  onUpload: (file: File, width: number, height: number) => void;
  /** True while a parent-driven S3 upload + DB insert is in flight (Flow 3 step 4's progress indicator). */
  isUploading?: boolean;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const busy = isProcessing || isUploading;

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/") || isUploading) return;
      setIsProcessing(true);
      const url = URL.createObjectURL(file);
      const { width, height } = await readImageDimensions(url);
      URL.revokeObjectURL(url);
      setIsProcessing(false);
      onUpload(file, width, height);
    },
    [onUpload, isUploading],
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) void handleFile(file);
      }}
      onPaste={(e) => {
        const file = Array.from(e.clipboardData.items)
          .find((item) => item.type.startsWith("image/"))
          ?.getAsFile();
        if (file) void handleFile(file);
      }}
      tabIndex={0}
      aria-busy={busy}
      className={cn(
        "my-4 flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-input bg-card px-6 py-12 text-center outline-none focus-visible:border-ring",
        isDragging && "border-primary bg-primary-muted/20",
      )}
    >
      {busy ? (
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      ) : (
        <ImagePlus className="size-8 stroke-[1.5] text-muted-foreground" />
      )}
      <div>
        <p className="text-body-sm text-foreground">
          {isUploading ? "Mengunggah gambar…" : "Seret gambar ke sini, atau tempel (paste) dari clipboard"}
        </p>
        {!isUploading && <p className="mt-1 text-caption text-muted-foreground">PNG, JPG, atau WEBP</p>}
      </div>
      <button
        type="button"
        onClick={() => requestImageFile((file) => void handleFile(file))}
        disabled={busy}
        className="rounded-md border border-border bg-secondary px-3 py-1.5 text-body-sm font-medium text-secondary-foreground hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
      >
        Pilih berkas
      </button>
    </div>
  );
}
