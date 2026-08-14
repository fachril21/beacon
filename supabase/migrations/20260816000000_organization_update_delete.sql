-- Organization delete + explicit pages cascade (switch-org / manage-org
-- follow-up plan, docs/organization-permission-structure.md). Rename
-- already worked — organizations_update_owner_only
-- (20260815000100_organization_membership_gate.sql) already covers any
-- column including `name`, it just had no UI wired to it yet. Delete never
-- had any policy at all (no access by default), so this adds one.

-- ---------------------------------------------------------------------------
-- organizations — DELETE, owner-only. Mirrors organizations_update_owner_only
-- exactly (same organization_role_for() helper).
-- ---------------------------------------------------------------------------

create policy organizations_delete_owner_only
  on public.organizations for delete
  to authenticated
  using (public.organization_role_for(id) = 'owner');

-- ---------------------------------------------------------------------------
-- pages.organization_id — was previously a plain FK with no ON DELETE
-- action (20260813010000_organization_page_slugs.sql), relying on the
-- implicit organizations -> spaces -> pages cascade chain to remove pages
-- before the org row itself is gone. That happens to work (Postgres
-- resolves multi-level cascade graphs correctly within one statement), but
-- leaving the FK's own behavior implicit is a footgun for the next person
-- reading just this constraint in isolation — made explicit here instead.
-- ---------------------------------------------------------------------------

alter table public.pages drop constraint pages_organization_id_fkey;
alter table public.pages
  add constraint pages_organization_id_fkey
  foreign key (organization_id) references public.organizations (id) on delete cascade;
