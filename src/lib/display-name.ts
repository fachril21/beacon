/**
 * The label to show for a person. A profile's `name` can be empty (it is not
 * required at sign-up), which used to render as a blank author or an empty
 * mention entry — so fall back to the full email address.
 * The SQL list_space_members() applies the same rule, so a name inserted into
 * a comment as "@name" matches what the client later highlights.
 */
export function displayName(user: { name?: string | null; email?: string | null } | undefined): string {
  const name = user?.name?.trim();
  if (name) return name;
  const email = user?.email?.trim();
  return email || "Pengguna";
}
