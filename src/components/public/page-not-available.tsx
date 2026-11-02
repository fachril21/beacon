import Link from "next/link";
import { Signpost } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePublicOrgContext } from "@/hooks/use-public-org";
import { usePublicSpace } from "@/hooks/public-space-context";
import { publicSpaceHref } from "@/lib/public-url";

export function PageNotAvailable({ organizationName }: { organizationName: string }) {
  const { basePath } = usePublicOrgContext();
  const currentSpace = usePublicSpace();
  // Inside a Space, "back" returns to that Space's landing — never the org
  // directory, so a visitor can't use this dead end to switch Spaces.
  const backHref = publicSpaceHref(basePath, currentSpace?.space.slug) ?? basePath;
  const backLabel = currentSpace ? `Kembali ke ${currentSpace.space.name}` : `Kembali ke dokumentasi ${organizationName}`;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-24 text-center">
      <Signpost className="size-14 stroke-[1.5] text-muted-foreground" />
      <h1 className="text-h3 font-semibold text-foreground">Halaman ini sudah tidak tersedia</h1>
      <p className="max-w-sm text-body-sm text-muted-foreground">Halaman mungkin telah dibatalkan publikasinya atau dipindahkan.</p>
      <Button variant="secondary" className="mt-2" nativeButton={false} render={<Link href={backHref}>{backLabel}</Link>} />
    </div>
  );
}
