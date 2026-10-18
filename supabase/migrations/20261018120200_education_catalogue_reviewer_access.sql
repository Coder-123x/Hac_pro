-- Phase 1 reviewer access: enable the existing reviewer-only RLS policies.
-- Reviewer assignment remains administrator-controlled out-of-band. This
-- migration does not expose the allowlist or grant any user a reviewer role.

grant select, insert, update on table public.education_source_batches,
  public.education_institutions,
  public.education_institution_source_ids,
  public.education_branches,
  public.education_branch_source_ids,
  public.education_cutoffs,
  public.education_import_quarantine to authenticated;
grant insert on table public.education_catalogue_audit_events to authenticated;

-- Reviewers may stage, review and publish records, but cannot delete source
-- evidence or catalogue rows. Deletion is reserved for administrator-level
-- maintenance outside the client role.
revoke delete on table public.education_source_batches,
  public.education_institutions,
  public.education_institution_source_ids,
  public.education_branches,
  public.education_branch_source_ids,
  public.education_cutoffs,
  public.education_import_quarantine from authenticated;

-- Replace the provisional FOR ALL policies with explicit non-destructive
-- reviewer operations. Existing published-read policies remain in place.
drop policy education_source_batches_reviewer_write on public.education_source_batches;
create policy education_source_batches_reviewer_select on public.education_source_batches
  for select to authenticated using (public.is_education_catalogue_reviewer());
create policy education_source_batches_reviewer_insert on public.education_source_batches
  for insert to authenticated with check (public.is_education_catalogue_reviewer());
create policy education_source_batches_reviewer_update on public.education_source_batches
  for update to authenticated using (public.is_education_catalogue_reviewer()) with check (public.is_education_catalogue_reviewer());

drop policy education_institutions_reviewer_write on public.education_institutions;
create policy education_institutions_reviewer_select on public.education_institutions
  for select to authenticated using (public.is_education_catalogue_reviewer());
create policy education_institutions_reviewer_insert on public.education_institutions
  for insert to authenticated with check (public.is_education_catalogue_reviewer());
create policy education_institutions_reviewer_update on public.education_institutions
  for update to authenticated using (public.is_education_catalogue_reviewer()) with check (public.is_education_catalogue_reviewer());

drop policy education_institution_source_ids_reviewer_write on public.education_institution_source_ids;
create policy education_institution_source_ids_reviewer_select on public.education_institution_source_ids
  for select to authenticated using (public.is_education_catalogue_reviewer());
create policy education_institution_source_ids_reviewer_insert on public.education_institution_source_ids
  for insert to authenticated with check (public.is_education_catalogue_reviewer());
create policy education_institution_source_ids_reviewer_update on public.education_institution_source_ids
  for update to authenticated using (public.is_education_catalogue_reviewer()) with check (public.is_education_catalogue_reviewer());

drop policy education_branches_reviewer_write on public.education_branches;
create policy education_branches_reviewer_select on public.education_branches
  for select to authenticated using (public.is_education_catalogue_reviewer());
create policy education_branches_reviewer_insert on public.education_branches
  for insert to authenticated with check (public.is_education_catalogue_reviewer());
create policy education_branches_reviewer_update on public.education_branches
  for update to authenticated using (public.is_education_catalogue_reviewer()) with check (public.is_education_catalogue_reviewer());

drop policy education_branch_source_ids_reviewer_write on public.education_branch_source_ids;
create policy education_branch_source_ids_reviewer_select on public.education_branch_source_ids
  for select to authenticated using (public.is_education_catalogue_reviewer());
create policy education_branch_source_ids_reviewer_insert on public.education_branch_source_ids
  for insert to authenticated with check (public.is_education_catalogue_reviewer());
create policy education_branch_source_ids_reviewer_update on public.education_branch_source_ids
  for update to authenticated using (public.is_education_catalogue_reviewer()) with check (public.is_education_catalogue_reviewer());

drop policy education_cutoffs_reviewer_write on public.education_cutoffs;
create policy education_cutoffs_reviewer_select on public.education_cutoffs
  for select to authenticated using (public.is_education_catalogue_reviewer());
create policy education_cutoffs_reviewer_insert on public.education_cutoffs
  for insert to authenticated with check (public.is_education_catalogue_reviewer());
create policy education_cutoffs_reviewer_update on public.education_cutoffs
  for update to authenticated using (public.is_education_catalogue_reviewer()) with check (public.is_education_catalogue_reviewer());

drop policy education_quarantine_reviewer_write on public.education_import_quarantine;
create policy education_quarantine_reviewer_select on public.education_import_quarantine
  for select to authenticated using (public.is_education_catalogue_reviewer());
create policy education_quarantine_reviewer_insert on public.education_import_quarantine
  for insert to authenticated with check (public.is_education_catalogue_reviewer());
create policy education_quarantine_reviewer_update on public.education_import_quarantine
  for update to authenticated using (public.is_education_catalogue_reviewer()) with check (public.is_education_catalogue_reviewer());

grant select on table public.education_catalogue_audit_events to authenticated;
create policy education_audit_reviewer_select on public.education_catalogue_audit_events
  for select to authenticated using (public.is_education_catalogue_reviewer());

comment on table public.education_catalogue_reviewers is
  'Private administrator-managed reviewer allowlist. Provision and revoke with direct administrator SQL only; RLS denies client access.';
