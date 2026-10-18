-- Phase 1: shared, provenance-aware education catalogue foundation.
-- This migration intentionally creates no catalogue records and grants no
-- client write access. Reviewer assignment/import operations require a future
-- administrator-approved workflow.

create table public.education_catalogue_reviewers (
  user_id uuid primary key references auth.users (id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.education_source_batches (
  id uuid primary key default gen_random_uuid(),
  source_system text not null check (char_length(btrim(source_system)) between 1 and 80),
  source_title text not null check (char_length(btrim(source_title)) between 1 and 240),
  source_url text not null check (source_url ~ '^https://'),
  artifact_sha256 text not null check (artifact_sha256 ~ '^[a-f0-9]{64}$'),
  academic_year smallint not null check (academic_year between 2000 and 2100),
  academic_period text not null check (char_length(btrim(academic_period)) between 1 and 160),
  retrieval_date date not null,
  extraction_method text not null check (char_length(btrim(extraction_method)) between 1 and 4000),
  source_row_count integer not null default 0 check (source_row_count >= 0),
  record_count integer not null default 0 check (record_count >= 0),
  status text not null default 'staged' check (status in ('staged', 'parsed', 'review_required', 'approved', 'published', 'retired')),
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  published_at timestamptz,
  retired_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_system, artifact_sha256),
  check (reviewed_at is null or reviewed_by is not null),
  check (published_at is null or status in ('published', 'retired')),
  check (retired_at is null or status = 'retired')
);

create table public.education_institutions (
  id uuid primary key default gen_random_uuid(),
  display_name text not null check (char_length(btrim(display_name)) between 1 and 240),
  legal_name text,
  institution_type text,
  district text,
  place text,
  identity_status text not null default 'unreviewed' check (identity_status in ('unreviewed', 'reviewed', 'ambiguous', 'retired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.education_institution_source_ids (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.education_institutions (id) on delete restrict,
  source_system text not null check (char_length(btrim(source_system)) between 1 and 80),
  source_institution_code text not null check (source_institution_code ~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,31}$'),
  raw_name text not null check (char_length(btrim(raw_name)) between 1 and 240),
  source_batch_id uuid not null references public.education_source_batches (id) on delete restrict,
  review_status text not null default 'unreviewed' check (review_status in ('unreviewed', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  unique (source_system, source_institution_code)
);

create table public.education_branches (
  id uuid primary key default gen_random_uuid(),
  display_name text not null check (char_length(btrim(display_name)) between 1 and 160),
  course_family text,
  status text not null default 'active' check (status in ('active', 'retired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.education_branch_source_ids (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.education_branches (id) on delete restrict,
  source_system text not null check (char_length(btrim(source_system)) between 1 and 80),
  source_branch_code text not null check (source_branch_code ~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,31}$'),
  raw_name text,
  source_batch_id uuid not null references public.education_source_batches (id) on delete restrict,
  review_status text not null default 'unreviewed' check (review_status in ('unreviewed', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  unique (source_system, source_branch_code)
);

create table public.education_cutoffs (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.education_institutions (id) on delete restrict,
  branch_id uuid not null references public.education_branches (id) on delete restrict,
  source_batch_id uuid not null references public.education_source_batches (id) on delete restrict,
  admission_region text not null check (admission_region ~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,31}$'),
  cutoff_category text not null check (char_length(btrim(cutoff_category)) between 1 and 80),
  cutoff_rank integer not null check (cutoff_rank > 0),
  academic_year smallint not null check (academic_year between 2000 and 2100),
  counselling_round text check (counselling_round is null or char_length(btrim(counselling_round)) between 1 and 80),
  source_row_number integer not null check (source_row_number > 0),
  source_sno integer not null check (source_sno > 0),
  source_record_key text not null check (source_record_key ~ '^[a-f0-9]{64}$'),
  source_url text not null check (source_url ~ '^https://'),
  data_status text not null default 'historical' check (data_status = 'historical'),
  publication_state text not null default 'draft' check (publication_state in ('draft', 'published', 'retired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_record_key),
  unique (source_batch_id, source_row_number, cutoff_category),
  foreign key (institution_id) references public.education_institutions (id),
  foreign key (branch_id) references public.education_branches (id)
);

create table public.education_import_quarantine (
  id uuid primary key default gen_random_uuid(),
  source_batch_id uuid not null references public.education_source_batches (id) on delete restrict,
  source_record_key text,
  source_row_number integer,
  reason_code text not null check (char_length(btrim(reason_code)) between 1 and 80),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.education_catalogue_audit_events (
  id uuid primary key default gen_random_uuid(),
  source_batch_id uuid references public.education_source_batches (id) on delete restrict,
  entity_type text not null check (char_length(btrim(entity_type)) between 1 and 80),
  entity_id uuid,
  action text not null check (action in ('upload', 'parse', 'preview', 'approve', 'publish', 'retire', 'rollback', 'quarantine')),
  actor_user_id uuid references auth.users (id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index education_institution_source_ids_institution_idx on public.education_institution_source_ids (institution_id);
create index education_branch_source_ids_branch_idx on public.education_branch_source_ids (branch_id);
create index education_cutoffs_lookup_idx on public.education_cutoffs (institution_id, branch_id, academic_year, admission_region, cutoff_category);
create index education_cutoffs_publication_idx on public.education_cutoffs (publication_state, academic_year);
create index education_quarantine_batch_idx on public.education_import_quarantine (source_batch_id, created_at);
create index education_audit_batch_idx on public.education_catalogue_audit_events (source_batch_id, created_at);

create trigger education_source_batches_set_updated_at before update on public.education_source_batches
  for each row execute function public.set_updated_at();
create trigger education_institutions_set_updated_at before update on public.education_institutions
  for each row execute function public.set_updated_at();
create trigger education_branches_set_updated_at before update on public.education_branches
  for each row execute function public.set_updated_at();
create trigger education_cutoffs_set_updated_at before update on public.education_cutoffs
  for each row execute function public.set_updated_at();

create or replace function public.is_education_catalogue_reviewer()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.education_catalogue_reviewers
    where user_id = auth.uid() and active
  );
$$;

revoke all on table public.education_catalogue_reviewers from public, anon, authenticated;
revoke all on function public.is_education_catalogue_reviewer() from public, anon;
grant execute on function public.is_education_catalogue_reviewer() to authenticated;

-- Audit events are append-only even if a future controlled writer is added.
create or replace function public.prevent_education_catalogue_audit_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  raise exception 'Education catalogue audit events are append-only';
end;
$$;

create trigger education_catalogue_audit_no_update before update or delete on public.education_catalogue_audit_events
  for each row execute function public.prevent_education_catalogue_audit_mutation();

alter table public.education_source_batches enable row level security;
alter table public.education_institutions enable row level security;
alter table public.education_institution_source_ids enable row level security;
alter table public.education_branches enable row level security;
alter table public.education_branch_source_ids enable row level security;
alter table public.education_cutoffs enable row level security;
alter table public.education_import_quarantine enable row level security;
alter table public.education_catalogue_audit_events enable row level security;

-- No anonymous catalogue access and no client write grants. Published reads are
-- intentionally limited to authenticated users. A future migration must add
-- narrowly scoped reviewer grants only after an administrator provisioning
-- workflow exists for education_catalogue_reviewers.
revoke all on table public.education_source_batches, public.education_institutions,
  public.education_institution_source_ids, public.education_branches,
  public.education_branch_source_ids, public.education_cutoffs,
  public.education_import_quarantine, public.education_catalogue_audit_events
  from anon, authenticated;
grant select on table public.education_source_batches, public.education_institutions,
  public.education_institution_source_ids, public.education_branches,
  public.education_branch_source_ids, public.education_cutoffs to authenticated;

create policy education_source_batches_published_select on public.education_source_batches
  for select to authenticated using (status = 'published');
create policy education_institutions_published_select on public.education_institutions
  for select to authenticated using (
    identity_status = 'reviewed' and exists (
      select 1 from public.education_institution_source_ids source_id
      join public.education_source_batches batch on batch.id = source_id.source_batch_id
      where source_id.institution_id = education_institutions.id
        and source_id.review_status = 'approved' and batch.status = 'published'
    )
  );
create policy education_institution_source_ids_published_select on public.education_institution_source_ids
  for select to authenticated using (
    review_status = 'approved' and exists (select 1 from public.education_source_batches batch where batch.id = source_batch_id and batch.status = 'published')
  );
create policy education_branches_published_select on public.education_branches
  for select to authenticated using (
    status = 'active' and exists (
      select 1 from public.education_branch_source_ids source_id
      join public.education_source_batches batch on batch.id = source_id.source_batch_id
      where source_id.branch_id = education_branches.id
        and source_id.review_status = 'approved' and batch.status = 'published'
    )
  );
create policy education_branch_source_ids_published_select on public.education_branch_source_ids
  for select to authenticated using (
    review_status = 'approved' and exists (select 1 from public.education_source_batches batch where batch.id = source_batch_id and batch.status = 'published')
  );
create policy education_cutoffs_published_select on public.education_cutoffs
  for select to authenticated using (
    publication_state = 'published' and data_status = 'historical'
    and exists (select 1 from public.education_source_batches batch where batch.id = source_batch_id and batch.status = 'published')
  );

-- Future reviewer policies are deliberately present without table grants. They
-- cannot be used until a separate migration grants access after provisioning.
create policy education_source_batches_reviewer_write on public.education_source_batches
  for all to authenticated using (public.is_education_catalogue_reviewer()) with check (public.is_education_catalogue_reviewer());
create policy education_institutions_reviewer_write on public.education_institutions
  for all to authenticated using (public.is_education_catalogue_reviewer()) with check (public.is_education_catalogue_reviewer());
create policy education_institution_source_ids_reviewer_write on public.education_institution_source_ids
  for all to authenticated using (public.is_education_catalogue_reviewer()) with check (public.is_education_catalogue_reviewer());
create policy education_branches_reviewer_write on public.education_branches
  for all to authenticated using (public.is_education_catalogue_reviewer()) with check (public.is_education_catalogue_reviewer());
create policy education_branch_source_ids_reviewer_write on public.education_branch_source_ids
  for all to authenticated using (public.is_education_catalogue_reviewer()) with check (public.is_education_catalogue_reviewer());
create policy education_cutoffs_reviewer_write on public.education_cutoffs
  for all to authenticated using (public.is_education_catalogue_reviewer()) with check (public.is_education_catalogue_reviewer());
create policy education_quarantine_reviewer_write on public.education_import_quarantine
  for all to authenticated using (public.is_education_catalogue_reviewer()) with check (public.is_education_catalogue_reviewer());
create policy education_audit_reviewer_insert on public.education_catalogue_audit_events
  for insert to authenticated with check (public.is_education_catalogue_reviewer());

comment on table public.education_catalogue_reviewers is
  'Private administrator-managed reviewer allowlist. No client grants are issued; provisioning requires a future controlled workflow.';
comment on table public.education_cutoffs is
  'Shared historical cutoff facts only. Rows contain no family or student ownership and are never admission guarantees.';
