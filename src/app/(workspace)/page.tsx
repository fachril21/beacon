"use client";

import { useState } from "react";
import { FolderPlus } from "lucide-react";
import { useSession } from "@/hooks/use-session";
import { useOrganizationSpaces } from "@/hooks/use-spaces";
import { useCurrentOrganization } from "@/hooks/use-organizations";
import { SpaceCard } from "@/components/workspace/space-card";
import { EmptyState } from "@/components/beacon/empty-state";
import { NewSpaceDialog } from "@/components/workspace/new-space-dialog";

export default function WorkspaceHomePage() {
  const { user } = useSession();
  const currentOrganization = useCurrentOrganization();
  const spaces = useOrganizationSpaces(user?.id, currentOrganization?.id);
  const [isNewSpaceOpen, setIsNewSpaceOpen] = useState(false);

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[90rem] px-8 py-10">
        <h1 className="text-h1 font-bold text-foreground">Selamat datang, {user?.name?.split(" ")[0]}</h1>
        <p className="mt-1.5 text-body text-muted-foreground">Pilih Space untuk mulai menulis, atau buat yang baru.</p>

        {spaces.length === 0 ? (
          <EmptyState
            icon={FolderPlus}
            title="Buat Space pertama Anda"
            description="Space mengelompokkan panduan untuk satu platform, misalnya Aplikasi Mobile atau Dashboard Admin."
            actionLabel="+ Space baru"
            onAction={() => setIsNewSpaceOpen(true)}
            className="mt-16"
          />
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {spaces.map((space) => (
              <SpaceCard key={space.id} space={space} />
            ))}
          </div>
        )}
      </div>
      <NewSpaceDialog open={isNewSpaceOpen} onOpenChange={setIsNewSpaceOpen} />
    </main>
  );
}
