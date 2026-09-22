# Organization Permission Structure

Short reference for the org-level membership/invitation refactor (this repo's `/ecc:plan` session, 2026-08-15 migrations). Supersedes the old 1:1 `profiles.organization_id` model and Space-level `pending_invites`.

## Roles

Two independent role scopes exist:

| Scope | Roles | Table |
|---|---|---|
| Organization | `owner`, `admin`, `member` | `organization_memberships` |
| Space | `viewer`, `editor`, `admin` | `permissions` |

A User can belong to more than one Organization (`organization_memberships` is a many-to-many join, unlike the old single `profiles.organization_id`). Exactly one `owner` exists per Organization at a time, enforced by a partial unique index (`organization_memberships_one_owner_per_org`) — not just application logic.

`profiles.organization_id` still exists but is **not authoritative**. It's a nullable "last active Organization" convenience pointer for single-org-scoped UI (e.g. which Organization Settings opens by default); every access decision goes through `organization_memberships`.

## Org membership is a prerequisite for Space/Page access

This is enforced in one place, not duplicated across policies: `beacon.user_space_role(space_id)` — the single helper every Space/Page/ScreenshotBlock/Version/Comment RLS policy already routes through — now also requires an `organization_memberships` row for that Space's Organization. Losing Organization membership silently revokes every Space permission's *effect* without needing to delete the Space-level rows themselves (though `permissions_require_org_membership_trigger` also blocks new/updated Space grants for a non-member at write time).

Practical effect: a Space's `permissions` row is now meaningless without a matching Organization membership. Space-level access can only ever be granted to someone already in the Organization — there is no independent Space-level invite path anymore.

## Invitations

| | Organization invite | Space invite (removed) |
|---|---|---|
| Table | `organization_invitations` | ~~`pending_invites`~~ (dropped) |
| Statuses | PENDING / ACCEPTED / EXPIRED / REVOKED | — |
| Who can send | OWNER, ADMIN | ~~Space admin~~ |
| Grants | Org membership only | — |

Bringing a brand-new person into Beacon now goes exclusively through an Organization invite (`invite_to_organization` RPC → `/api/organizations/[id]/invite` for the real email send). Once someone is an Organization member, an OWNER/ADMIN grants Space-level access separately via a roster picker (no email involved — `useAddOrgMemberToSpace`).

### Flow

1. OWNER/ADMIN invites by email (`invite_to_organization`).
   - Email already has a Beacon Account → immediate `organization_memberships` row, no invitation record.
   - Unknown email → `organization_invitations` row (PENDING) + a real invite email (`/api/organizations/[id]/invite`, service-role `inviteUserByEmail`).
2. Invitee clicks the link → `/accept-invite?token=...`.
   - Already signed in (existing Account) → `accept_organization_invite` runs immediately.
   - Not signed in → token is stashed in `sessionStorage` and consumed by the workspace layout's onboarding gate the first time that browser has an authenticated session — covers "sign up first, verify email, land in the workspace" without threading the token through Supabase's own email-confirmation redirect.
3. OWNER can revoke a PENDING invite (`useRevokeInvitation`, a plain RLS-gated `UPDATE` — no RPC needed).

## Self-serve Organization creation

Any authenticated user can create an Organization (`useCreateOrganization`): insert the `organizations` row, then the creator's own `owner` membership row, mirroring `useCreateSpace`'s bootstrap-with-rollback shape. A signed-in user with zero Organization memberships is gated to a "Create your Organization" screen (`CreateOrganizationOnboarding`) instead of the workspace shell.

## Ownership transfer

`transfer_organization_ownership(org, new_owner)` — OWNER-only, atomic (two `UPDATE`s inside one function call: old owner → `admin`, new owner → `owner`), so the one-owner-per-org index never observes two OWNER rows for the same Organization. `remove_organization_member` refuses to remove the current OWNER (`CANNOT_REMOVE_OWNER`) — ownership must be transferred first.

## Data migration

- Every existing `profiles.organization_id`/`organization_role` row was backfilled into `organization_memberships` before those columns were dropped (`20260815000000`).
- Any still-PENDING `pending_invites` row was migrated forward into `organization_invitations` (`20260815000300`) — with one unavoidable scope narrowing: a Space-level invite carried a `SpaceRole` (viewer/editor/admin scoped to one Space), which has no Organization-level equivalent. Every migrated row became `role = 'member'`; the actual Space-level role is granted separately post-join via the roster picker.
