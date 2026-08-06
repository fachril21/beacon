-- Bootstraps the two known Organizations named in PRD.md US14a.3 (Dibimbing,
-- Cakrawala University). Real deployments add a verified domain via the
-- Organization Settings UI (Flow 7a); this seed only creates the rows so
-- new-user signup (handle_new_user, 20260806100100_rls_policies.sql) has an
-- Organization to fall back to and local dev has non-empty data to work with.
insert into public.organizations (name, domain, is_domain_verified)
values
  ('Dibimbing', null, false),
  ('Cakrawala University', null, false)
on conflict do nothing;
