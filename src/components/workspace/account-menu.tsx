"use client";

import { useRouter } from "next/navigation";
import { ChevronsUpDown, LogOut, Settings } from "lucide-react";
import { useSession } from "@/hooks/use-session";
import { displayName } from "@/lib/display-name";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * The account row at the bottom of the sidebar: who is logged in (name, if
 * the profile has one, and always the email), and a menu with organization
 * settings and sign-out. A profile's name can be empty, which used to leave
 * this row blank with a "?" avatar.
 */
export function AccountMenu() {
  const router = useRouter();
  const { user, signOut } = useSession();

  const name = user?.name?.trim() ?? "";
  const email = user?.email?.trim() ?? "";
  const label = user ? displayName(user) : "Akun";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label={email ? `Akun ${email}` : "Akun"}
            className="flex w-full items-center gap-2.5 border-t border-sidebar-border px-3 py-3 text-left hover:bg-sidebar-accent"
          />
        }
      >
        <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-caption font-semibold text-secondary-foreground">
          {label[0]?.toUpperCase() ?? "?"}
        </div>
        <div className="min-w-0 flex-1">
          {name && <p className="truncate text-body-sm text-sidebar-foreground">{name}</p>}
          {email ? (
            <p className={name ? "truncate text-caption text-sidebar-foreground/60" : "truncate text-body-sm text-sidebar-foreground/80"}>
              {email}
            </p>
          ) : (
            !name && <p className="truncate text-body-sm text-sidebar-foreground/70">Akun</p>
          )}
        </div>
        <ChevronsUpDown className="size-3.5 shrink-0 text-sidebar-foreground/50" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-64">
        {email && (
          <>
            <div className="px-2 py-1.5">
              <p className="text-caption text-muted-foreground">Masuk sebagai</p>
              <p className="text-body-sm break-all text-foreground">{email}</p>
            </div>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem onClick={() => router.push("/settings/organization")}>
          <Settings className="size-3.5" />
          Pengaturan Organisasi
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onClick={signOut}>
          <LogOut className="size-3.5" />
          Keluar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
