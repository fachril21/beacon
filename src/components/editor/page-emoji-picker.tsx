"use client";

import { useState } from "react";
import { SmilePlus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * Curated, page-appropriate emoji — no picker dependency for what is
 * fundamentally a one-glyph choice. `null` is a first-class value: clearing
 * the emoji removes it everywhere it would have been shown, which is the
 * whole point of it being optional.
 */
const EMOJI_CHOICES = [
  "📄", "📝", "📘", "📚", "📖", "🗂️", "📁", "📌",
  "✅", "📋", "🗒️", "📊", "📈", "📉", "🧭", "🎯",
  "🚀", "⚙️", "🔧", "🛠️", "💡", "🧠", "🔍", "🔎",
  "📢", "🗣️", "💬", "❓", "⚠️", "🔒", "🔑", "🛡️",
  "🌐", "🏠", "🛒", "💳", "📱", "💻", "🖥️", "⌨️",
  "🔔", "⏰", "📅", "✏️", "🎨", "🎬", "⭐", "⚡",
  "🔥", "🧩", "🏆", "🌱", "🍀", "🎁", "🎉", "❤️",
];

/**
 * The emoji control beside the Page title: shows the chosen emoji when one is
 * set, and a quiet "add" affordance when it is not — an unset emoji never
 * renders a placeholder glyph, in the editor or anywhere else.
 */
export function PageEmojiPicker({
  emoji,
  onChange,
  disabled = false,
  className,
}: {
  emoji: string | null;
  onChange: (emoji: string | null) => void;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  function choose(value: string | null) {
    setOpen(false);
    onChange(value);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={disabled}
        render={
          <button
            type="button"
            aria-label={emoji ? "Ganti emoji halaman" : "Tambahkan emoji halaman"}
            aria-haspopup="dialog"
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-md text-lg leading-none transition-colors outline-none",
              "hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50",
              !emoji && "text-muted-foreground/70 hover:text-muted-foreground",
              disabled && "pointer-events-none opacity-40",
              className,
            )}
          />
        }
      >
        {emoji ? emoji : <SmilePlus className="size-4" />}
      </PopoverTrigger>
      <PopoverContent align="start" side="bottom" className="w-72 gap-1.5">
        <div className="grid grid-cols-8 gap-0.5">
          {EMOJI_CHOICES.map((choice) => (
            <button
              key={choice}
              type="button"
              onClick={() => choose(choice)}
              aria-label={`Pilih emoji ${choice}`}
              className="flex size-7 items-center justify-center rounded-md text-base leading-none transition-colors hover:bg-accent"
            >
              {choice}
            </button>
          ))}
        </div>
        {emoji && (
          <button
            type="button"
            onClick={() => choose(null)}
            className="flex w-full items-center gap-2 rounded-md border-t border-border px-1.5 pt-1.5 pb-1 text-caption text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="size-3.5" />
            Hapus emoji
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
