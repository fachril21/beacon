"use client";

import { ExternalLink } from "lucide-react";
import { createReactBlockSpec, type ReactCustomBlockRenderProps } from "@blocknote/react";

export const buttonBlockConfig = {
  type: "button",
  propSchema: {
    url: { default: "" },
    variant: { default: "primary" },
  },
  content: "inline",
} as const;

type ButtonRenderProps = ReactCustomBlockRenderProps<typeof buttonBlockConfig>;

function ButtonBlockRender({ block, editor, contentRef }: ButtonRenderProps) {
  const url = block.props.url.trim();
  const variant = block.props.variant === "secondary" ? "secondary" : "primary";

  if (!editor.isEditable) {
    return (
      <a
        href={url || undefined}
        target={url && /^https?:\/\//i.test(url) ? "_blank" : undefined}
        rel={url && /^https?:\/\//i.test(url) ? "noopener noreferrer" : undefined}
        className="beacon-button"
        data-variant={variant}
        data-empty={!url || undefined}
      >
        <span ref={contentRef} className="beacon-button-label" />
        {url && <ExternalLink className="size-3.5" aria-hidden />}
      </a>
    );
  }

  return (
    <div className="beacon-button-editor" data-variant={variant}>
      <span ref={contentRef} className="beacon-button-label" />
      <div className="flex min-w-0 flex-1 items-center gap-1.5" contentEditable={false}>
        <input
          aria-label="URL tombol"
          value={block.props.url}
          onChange={(event) => editor.updateBlock(block, { props: { url: event.target.value } })}
          placeholder="https://contoh.com atau /halaman"
          className="h-7 min-w-0 flex-1 rounded-sm border border-border bg-card px-2 text-caption text-foreground outline-none focus-visible:border-ring"
        />
        <select
          aria-label="Gaya tombol"
          value={variant}
          onChange={(event) => editor.updateBlock(block, { props: { variant: event.target.value } })}
          className="h-7 shrink-0 rounded-sm border border-border bg-card px-1 text-caption text-muted-foreground"
        >
          <option value="primary">Utama</option>
          <option value="secondary">Sekunder</option>
        </select>
      </div>
    </div>
  );
}

export const buttonBlockSpec = createReactBlockSpec(buttonBlockConfig, {
  render: ButtonBlockRender,
})();
