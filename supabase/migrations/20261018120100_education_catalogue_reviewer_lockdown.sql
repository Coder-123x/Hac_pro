-- Keep the reviewer allowlist private until a controlled provisioning workflow
-- and reviewer write RPC have been approved.
alter table public.education_catalogue_reviewers enable row level security;
revoke all on table public.education_catalogue_reviewers from public, anon, authenticated;
