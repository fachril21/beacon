# Known Issues (deferred)

Pre-existing issues found while testing the 2026-10-07 invite simplification
(org membership = automatic Space access). All are **out of scope** for that
change — fix separately, after it ships.

| # | Where | Issue | Notes / direction |
|---|---|---|---|
| 1 | Editor block controls | Clicking a block's "+" affordance does nothing; the working path today is typing "/" for the insert menu | BlockNote SideMenu — investigate click handler / menu positioning |
| 2 | Sidebar page tree | Comment-count badge overflows the row / clipped at the right edge | `page-tree-item.tsx` layout |
| 3 | Editor publish banner | After unpublish (or turning a Space's publishable off), the editor still shows published state / "Open public URL" until refresh; the old URL correctly 404s | Stale client state only — data layer (RLS) protection works |
| 4 | Space slugs | Slug is frozen at creation: renaming a Space changes the title only, so already-shared public URLs never break; a new Space reusing an old name gets a `-2` suffix slug | Intentional. If manual URLs are ever wanted: an explicit admin "change URL" action + redirect from the old slug |
| 5 | Accept-invite error page | Rejection reasons surface as raw RPC codes (e.g. `INVITE_EMAIL_MISMATCH: this invitation was sent to a different email address`) instead of a friendly localized message | Same class as the invite-toast raw-code fix; guard logic itself is correct |
| 6 | Re-invite email wording | Re-inviting an email whose auth account already exists (created by an earlier invite) sends a "reset password" email instead of the invite template — GoTrue has no resend-invite API, so the route falls back to `resetPasswordForEmail`; the link still lands on accept → set-password → workspace correctly | Word the shared reset template neutrally (Authentication → Emails), or clean up the auth user for a true first-time invite experience |
