"use client";

import { AlertTriangle, CheckCircle2, Info, ShieldAlert } from "lucide-react";
import { createReactBlockSpec, type ReactCustomBlockRenderProps } from "@blocknote/react";

const CALLOUT_VARIANTS = {
  info: { label: "Informasi", icon: Info },
  warning: { label: "Peringatan", icon: AlertTriangle },
  success: { label: "Berhasil", icon: CheckCircle2 },
  danger: { label: "Penting", icon: ShieldAlert },
} as const;

export type CalloutVariant = keyof typeof CALLOUT_VARIANTS;

export const calloutBlockConfig = {
  type: "callout",
  propSchema: {
    variant: { default: "info" },
  },
  content: "inline",
} as const;

type CalloutRenderProps = ReactCustomBlockRenderProps<typeof calloutBlockConfig>;

function CalloutBlockRender({ block, editor, contentRef }: CalloutRenderProps) {
  const variant = (block.props.variant as CalloutVariant) in CALLOUT_VARIANTS ? (block.props.variant as CalloutVariant) : "info";
  const meta = CALLOUT_VARIANTS[variant];
  const Icon = meta.icon;

  return (
    <div className="beacon-callout" data-variant={variant}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div ref={contentRef} className="min-w-0 flex-1" />
      {editor.isEditable && (
        <select
          aria-label="Jenis callout"
          value={variant}
          onChange={(event) => editor.updateBlock(block, { props: { variant: event.target.value } })}
          className="h-6 shrink-0 self-start rounded-sm border border-border bg-card px-1 text-caption text-muted-foreground"
        >
          {Object.entries(CALLOUT_VARIANTS).map(([value, item]) => (
            <option key={value} value={value}>
              {item.label}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

export const calloutBlockSpec = createReactBlockSpec(calloutBlockConfig, {
  render: CalloutBlockRender,
})();
