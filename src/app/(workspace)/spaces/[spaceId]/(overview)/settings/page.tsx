"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, ExternalLink, Globe2, Lock, ShieldCheck, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { PageEmojiPicker } from "@/components/editor/page-emoji-picker";
import { DeleteConfirmDialog } from "@/components/workspace/delete-confirm-dialog";
import { useSession } from "@/hooks/use-session";
import { useSpace, useUpdateSpace, useDeleteSpace } from "@/hooks/use-spaces";
import type { Space, SpaceLayout } from "@/lib/types";

const SETTINGS_GROUPS = [
  { id: "space-general", label: "Umum" },
  { id: "space-access", label: "Akses & Izin" },
  { id: "space-navigation", label: "Navigasi" },
  { id: "space-publishing", label: "Publikasi" },
] as const;

export default function SpaceSettingsPage({ params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = use(params);
  const { user } = useSession();
  const space = useSpace(spaceId);

  if (!user || !space) return null;

  return <SpaceSettingsForm space={space} />;
}

/**
 * Space-level settings only — content settings stay in the Page editor.
 * Grouped into General / Access & Permissions / Navigation / Publishing, with a
 * sticky section nav on desktop and a horizontal one on mobile. All groups are
 * rendered at once (the nav scrolls rather than swaps content) so the current
 * value of every setting is always visible and screen-reader friendly.
 */
function SpaceSettingsForm({ space }: { space: Space }) {
  const router = useRouter();
  const updateSpace = useUpdateSpace();
  const deleteSpace = useDeleteSpace();
  const [nameInput, setNameInput] = useState(space.name);
  const [descriptionInput, setDescriptionInput] = useState(space.description ?? "");
  const [iconInput, setIconInput] = useState<string | null>(space.icon ?? null);
  const [slugInput, setSlugInput] = useState(space.slug);
  const [isSavingGeneral, setIsSavingGeneral] = useState(false);
  const [isSavingPublishable, setIsSavingPublishable] = useState(false);
  const [isSavingNavigation, setIsSavingNavigation] = useState(false);
  const [isConfirmInternalOpen, setIsConfirmInternalOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const trimmedName = nameInput.trim();
  const trimmedDescription = descriptionInput.trim();
  const trimmedSlug = slugInput.trim();
  const slugIsValid = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(trimmedSlug);
  const iconChanged = (iconInput ?? null) !== (space.icon ?? null);
  const canSaveGeneral =
    !isSavingGeneral &&
    trimmedName.length > 0 &&
    slugIsValid &&
    (trimmedName !== space.name ||
      trimmedDescription !== (space.description ?? "") ||
      iconChanged ||
      trimmedSlug !== space.slug);

  async function handleSaveGeneral() {
    if (!canSaveGeneral) return;
    setIsSavingGeneral(true);
    try {
      const patch: { name?: string; description?: string; icon?: string | null; slug?: string } = {};
      if (trimmedName !== space.name) patch.name = trimmedName;
      if (trimmedDescription !== (space.description ?? "")) patch.description = trimmedDescription;
      if (iconChanged) patch.icon = iconInput;
      if (trimmedSlug !== space.slug) patch.slug = trimmedSlug;
      await updateSpace(space.id, patch);
      toast.success("Pengaturan Space diperbarui.");
    } catch {
      toast.error("Tidak dapat memperbarui pengaturan umum, silakan coba lagi.");
      setNameInput(space.name);
      setDescriptionInput(space.description ?? "");
      setIconInput(space.icon ?? null);
      setSlugInput(space.slug);
    } finally {
      setIsSavingGeneral(false);
    }
  }

  async function setPublishable(next: boolean) {
    if (next === space.isPublishable) return;
    setIsSavingPublishable(true);
    try {
      await updateSpace(space.id, { isPublishable: next });
      toast.success("Pengaturan Space diperbarui.");
    } catch {
      toast.error("Tidak dapat memperbarui pengaturan, silakan coba lagi.");
    } finally {
      setIsSavingPublishable(false);
      setIsConfirmInternalOpen(false);
    }
  }

  function handleToggle(next: boolean) {
    // Turning publishing OFF can pull already-published Pages from the public
    // site, so confirm first; turning it ON has no destructive side effect.
    if (next) {
      void setPublishable(true);
    } else {
      setIsConfirmInternalOpen(true);
    }
  }

  async function setShowPageList(next: boolean) {
    setIsSavingNavigation(true);
    try {
      await updateSpace(space.id, { showPageList: next });
      toast.success(next ? "Daftar halaman ditampilkan di sidebar publik." : "Daftar halaman disembunyikan dari sidebar publik.");
    } catch {
      toast.error("Tidak dapat memperbarui pengaturan navigasi, silakan coba lagi.");
    } finally {
      setIsSavingNavigation(false);
    }
  }

  async function moveSection(sectionId: string, direction: -1 | 1) {
    const layout = space.layout;
    if (!layout || layout.sections.length < 2) return;
    const index = layout.sections.findIndex((section) => section.id === sectionId);
    const nextIndex = index + direction;
    if (index === -1 || nextIndex < 0 || nextIndex >= layout.sections.length) return;

    const sections = [...layout.sections];
    const [moved] = sections.splice(index, 1);
    sections.splice(nextIndex, 0, moved);
    const next: SpaceLayout = { ...layout, sections };
    try {
      await updateSpace(space.id, { layout: next });
      toast.success("Urutan navigasi diperbarui.");
    } catch {
      toast.error("Tidak dapat menyimpan urutan navigasi, silakan coba lagi.");
    }
  }

  async function handleDeleteSpace() {
    setIsDeleting(true);
    try {
      await deleteSpace(space.id);
      toast("Space telah dihapus.");
      router.push("/");
    } catch {
      toast.error("Gagal menghapus Space, silakan coba lagi.");
      setIsDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <nav aria-label="Bagian pengaturan Space" className="flex gap-1 overflow-x-auto pb-1 lg:sticky lg:top-4 lg:w-48 lg:shrink-0 lg:flex-col lg:overflow-visible lg:pb-0">
        {SETTINGS_GROUPS.map((group) => (
          <a
            key={group.id}
            href={`#${group.id}`}
            className="shrink-0 rounded-md px-3 py-2 text-body-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            {group.label}
          </a>
        ))}
      </nav>

      <div className="flex min-w-0 max-w-[44rem] flex-1 flex-col gap-5">
        <section id="space-general" aria-labelledby="space-general-title" className="scroll-mt-6">
          <Card className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="space-general-title" className="text-h3 font-semibold text-foreground">
                  Umum
                </h2>
                <p className="mt-1 text-body-sm text-muted-foreground">Identitas Space yang tampil di workspace dan situs publik.</p>
              </div>
              <PageEmojiPicker emoji={iconInput} onChange={setIconInput} subject="Space" />
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="space-name">Nama Space</Label>
                <Input
                  id="space-name"
                  value={nameInput}
                  onChange={(event) => setNameInput(event.target.value)}
                  disabled={isSavingGeneral}
                />
              </div>

              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="space-description">Deskripsi Space</Label>
                <Textarea
                  id="space-description"
                  value={descriptionInput}
                  onChange={(event) => setDescriptionInput(event.target.value)}
                  placeholder="Subtitle singkat yang tampil di bawah nama Space…"
                  className="min-h-[4.5rem]"
                  disabled={isSavingGeneral}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="space-slug">URL / Slug</Label>
                <Input
                  id="space-slug"
                  value={slugInput}
                  onChange={(event) => setSlugInput(event.target.value.toLowerCase())}
                  aria-invalid={!slugIsValid}
                  disabled={isSavingGeneral}
                />
                <p className={slugIsValid ? "text-caption text-muted-foreground" : "text-caption text-destructive"}>
                  {slugIsValid ? "Huruf kecil, angka, dan tanda hubung." : "Gunakan huruf kecil, angka, dan tanda hubung saja."}
                </p>
              </div>

              <div className="flex items-end">
                <Button onClick={() => void handleSaveGeneral()} disabled={!canSaveGeneral} className="w-full sm:w-auto">
                  {isSavingGeneral ? "Menyimpan…" : "Simpan"}
                </Button>
              </div>
            </div>
          </Card>
        </section>

        <section id="space-access" aria-labelledby="space-access-title" className="scroll-mt-6">
          <Card className="p-6">
            <h2 id="space-access-title" className="text-h3 font-semibold text-foreground">
              Akses & Izin
            </h2>
            <p className="mt-1 text-body-sm text-muted-foreground">
              Siapa yang dapat membuka Space ini dan apa yang boleh mereka lakukan.
            </p>

            <div className="mt-4 flex flex-col gap-3">
              <div className="flex items-start gap-3 rounded-lg border border-border bg-background p-3">
                {space.isPublishable ? (
                  <Globe2 className="mt-0.5 size-4 shrink-0 text-primary" />
                ) : (
                  <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                )}
                <div>
                  <p className="text-body-sm font-semibold text-foreground">
                    {space.isPublishable ? "Space publik" : "Space privat"}
                  </p>
                  <p className="mt-0.5 text-body-sm text-muted-foreground">
                    {space.isPublishable
                      ? "Halaman yang sudah dipublikasikan dapat dibaca siapa saja lewat tautan publik."
                      : "Hanya anggota Organisasi yang dapat membuka Space ini. Tidak ada akses publik."}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-lg border border-border bg-background p-3">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div>
                  <p className="text-body-sm font-semibold text-foreground">Peran anggota</p>
                  <p className="mt-0.5 text-body-sm text-muted-foreground">
                    Admin Organisasi dapat mengatur Space dan publikasi. Anggota Organisasi dapat mengedit Halaman. Viewer hanya dapat membaca.
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </section>

        <section id="space-navigation" aria-labelledby="space-navigation-title" className="scroll-mt-6">
          <Card className="p-6">
            <h2 id="space-navigation-title" className="text-h3 font-semibold text-foreground">
              Navigasi
            </h2>
            <p className="mt-1 text-body-sm text-muted-foreground">Atur daftar halaman dan urutan bagian pada tampilan publik.</p>

            <div className="mt-4 flex items-start justify-between gap-4 rounded-lg border border-border bg-background p-3">
              <div>
                <Label htmlFor="space-show-page-list">Tampilkan daftar halaman</Label>
                <p className="mt-1 text-caption text-muted-foreground">
                  Menampilkan pohon Halaman di sidebar publik. Mematikannya menyembunyikan daftar, bukan Halamannya.
                </p>
              </div>
              <Switch
                id="space-show-page-list"
                checked={space.showPageList !== false}
                disabled={isSavingNavigation}
                onCheckedChange={(next) => void setShowPageList(next)}
              />
            </div>

            <div className="mt-4">
              <p className="text-body-sm font-semibold text-foreground">Urutan bagian</p>
              {space.layout && space.layout.sections.length > 0 ? (
                <ul className="mt-2 flex flex-col gap-1.5">
                  {space.layout.sections.map((section, index) => (
                    <li key={section.id} className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2">
                      <span className="min-w-0 flex-1 truncate text-body-sm text-foreground">{section.title || "Tanpa judul"}</span>
                      <span className="text-caption text-muted-foreground">{section.pages.length} halaman</span>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`Naikkan bagian ${section.title}`}
                        disabled={index === 0}
                        onClick={() => void moveSection(section.id, -1)}
                      >
                        <ArrowUp className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`Turunkan bagian ${section.title}`}
                        disabled={index === space.layout!.sections.length - 1}
                        onClick={() => void moveSection(section.id, 1)}
                      >
                        <ArrowDown className="size-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-body-sm text-muted-foreground">
                  Belum ada bagian. Atur susunan di tab Layout.
                </p>
              )}
            </div>
          </Card>
        </section>

        <section id="space-publishing" aria-labelledby="space-publishing-title" className="scroll-mt-6">
          <Card className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="space-publishing-title" className="text-h3 font-semibold text-foreground">
                  Publikasi
                </h2>
                <p className="mt-1 text-body-sm text-muted-foreground">Status dan visibilitas Space di situs publik.</p>
              </div>
              <Badge variant={space.isPublishable ? "published" : "secondary"}>
                {space.isPublishable ? "Dapat dipublikasikan" : "Hanya internal"}
              </Badge>
            </div>

            <div className="mt-4 flex items-start justify-between gap-4 rounded-lg border border-border bg-background p-3">
              <div>
                <Label htmlFor="space-publishable" className="font-medium">
                  Dapat dipublikasikan
                </Label>
                <p className="mt-1 text-caption text-muted-foreground">
                  Halaman di Space ini dapat dipublikasikan ke situs publik. Mematikannya membuat Space kembali internal saja dan
                  menyembunyikan Halaman yang sudah terbit dari publik.
                </p>
              </div>
              <Switch
                id="space-publishable"
                checked={space.isPublishable}
                disabled={isSavingPublishable}
                onCheckedChange={handleToggle}
              />
            </div>

            {space.isPublishable && (
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => {
                  const path = `/public/spaces/${space.slug}`;
                  window.open(path, "_blank", "noopener,noreferrer");
                }}
              >
                <ExternalLink className="size-3.5" />
                Lihat halaman publik
              </Button>
            )}
          </Card>
        </section>

        <Card className="border-destructive/40 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-medium text-foreground">Hapus Space</p>
              <p className="mt-1 text-caption text-muted-foreground">
                Seluruh Halaman di dalam Space ini akan ikut dihapus permanen. Tindakan ini tidak dapat dibatalkan.
              </p>
            </div>
            <Button variant="destructive" size="sm" onClick={() => setIsDeleteOpen(true)}>
              <Trash2 className="size-3.5" />
              Hapus Space
            </Button>
          </div>
        </Card>

        <DeleteConfirmDialog
          open={isConfirmInternalOpen}
          onOpenChange={(open) => !open && setIsConfirmInternalOpen(false)}
          title="Jadikan Space ini internal saja?"
          description="Halaman yang sudah dipublikasikan akan langsung hilang dari situs publik sampai Space ini diaktifkan kembali. Konten dan riwayatnya tetap tersimpan."
          confirmLabel="Jadikan Internal"
          isDeleting={isSavingPublishable}
          onConfirm={() => void setPublishable(false)}
        />

        <DeleteConfirmDialog
          open={isDeleteOpen}
          onOpenChange={setIsDeleteOpen}
          title={`Hapus Space "${space.name}"?`}
          description="Seluruh Halaman di dalam Space ini akan ikut dihapus permanen. Tindakan ini tidak dapat dibatalkan."
          confirmLabel="Hapus Space"
          isDeleting={isDeleting}
          onConfirm={() => void handleDeleteSpace()}
        />
      </div>
    </div>
  );
}
