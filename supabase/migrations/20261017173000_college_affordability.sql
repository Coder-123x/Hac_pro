-- Phase 5: provenance-aware AP EAPCET college/branch comparisons.
-- This migration stores user-entered or imported records only; it does not seed
-- colleges, cutoffs, fees, admission probabilities, or official claims.

create table public.college_comparisons (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  student_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  eapcet_rank integer not null check (eapcet_rank > 0),
  preferred_branches text[] not null default '{}',
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, family_id),
  check (cardinality(preferred_branches) <= 50)
);

create table public.college_comparison_options (
  id uuid primary key default gen_random_uuid(),
  comparison_id uuid not null,
  family_id uuid not null,
  college_name text not null check (char_length(btrim(college_name)) between 1 and 160),
  branch_name text not null check (char_length(btrim(branch_name)) between 1 and 160),
  cutoff_rank integer check (cutoff_rank is null or cutoff_rank > 0),
  cutoff_year smallint check (cutoff_year is null or cutoff_year between 2000 and 2100),
  cutoff_category text check (cutoff_category is null or char_length(btrim(cutoff_category)) between 1 and 80),
  counselling_round text check (counselling_round is null or char_length(btrim(counselling_round)) between 1 and 80),
  source_url text check (source_url is null or source_url ~ '^https?://'),
  last_verified_at date,
  data_status text not null default 'missing' check (data_status in ('official_verified', 'historical', 'estimate', 'unverified', 'missing')),
  annual_tuition_paise bigint check (annual_tuition_paise is null or annual_tuition_paise >= 0),
  annual_hostel_living_paise bigint check (annual_hostel_living_paise is null or annual_hostel_living_paise >= 0),
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (comparison_id, family_id)
    references public.college_comparisons (id, family_id) on delete cascade,
  check (data_status <> 'official_verified' or (source_url is not null and cutoff_year is not null and last_verified_at is not null)),
  check (data_status not in ('official_verified', 'historical') or cutoff_rank is not null)
);

create index college_comparisons_student_idx on public.college_comparisons (student_id, family_id);
create index college_comparison_options_comparison_idx on public.college_comparison_options (comparison_id, family_id);
create index college_comparison_options_status_idx on public.college_comparison_options (data_status, cutoff_year);

create trigger college_comparisons_set_updated_at before update on public.college_comparisons
  for each row execute function public.set_updated_at();
create trigger college_comparisons_prevent_creator_change before update on public.college_comparisons
  for each row execute function public.prevent_record_creator_change();
create trigger college_comparisons_prevent_family_scope_change before update on public.college_comparisons
  for each row execute function public.prevent_family_scope_change();
create trigger college_comparison_options_set_updated_at before update on public.college_comparison_options
  for each row execute function public.set_updated_at();
create trigger college_comparison_options_prevent_creator_change before update on public.college_comparison_options
  for each row execute function public.prevent_record_creator_change();
create trigger college_comparison_options_prevent_family_scope_change before update on public.college_comparison_options
  for each row execute function public.prevent_family_scope_change();

alter table public.college_comparisons enable row level security;
alter table public.college_comparison_options enable row level security;

revoke all on table public.college_comparisons, public.college_comparison_options from anon, authenticated;
grant select, insert, update, delete on table public.college_comparisons to authenticated;
grant select, insert, update, delete on table public.college_comparison_options to authenticated;

create policy "college_comparisons_select_owner_or_shared_parent" on public.college_comparisons
  for select to authenticated using (
    student_id = auth.uid()
    or exists (
      select 1 from public.student_profiles
      where user_id = college_comparisons.student_id
        and family_id = college_comparisons.family_id
        and is_shared_with_parents
        and public.is_active_family_parent(college_comparisons.family_id)
    )
  );
create policy "college_comparisons_insert_student" on public.college_comparisons
  for insert to authenticated with check (
    student_id = auth.uid()
    and created_by = auth.uid()
    and public.is_active_family_student(family_id)
  );
create policy "college_comparisons_update_owner" on public.college_comparisons
  for update to authenticated using (student_id = auth.uid() and public.is_active_family_student(family_id))
  with check (student_id = auth.uid() and public.is_active_family_student(family_id));
create policy "college_comparisons_delete_owner" on public.college_comparisons
  for delete to authenticated using (student_id = auth.uid() and public.is_active_family_student(family_id));

create policy "college_options_select_allowed_comparison" on public.college_comparison_options
  for select to authenticated using (
    exists (select 1 from public.college_comparisons c where c.id = comparison_id and c.family_id = college_comparison_options.family_id)
  );
create policy "college_options_insert_owner" on public.college_comparison_options
  for insert to authenticated with check (
    created_by = auth.uid()
    and exists (
      select 1 from public.college_comparisons c
      where c.id = comparison_id and c.family_id = college_comparison_options.family_id and c.student_id = auth.uid()
    )
  );
create policy "college_options_update_owner" on public.college_comparison_options
  for update to authenticated using (
    created_by = auth.uid()
    and exists (select 1 from public.college_comparisons c where c.id = comparison_id and c.family_id = college_comparison_options.family_id and c.student_id = auth.uid() and public.is_active_family_student(c.family_id))
  )
  with check (created_by = auth.uid() and family_id = college_comparison_options.family_id);
create policy "college_options_delete_owner" on public.college_comparison_options
  for delete to authenticated using (
    created_by = auth.uid()
    and exists (select 1 from public.college_comparisons c where c.id = comparison_id and c.family_id = college_comparison_options.family_id and c.student_id = auth.uid() and public.is_active_family_student(c.family_id))
  );

comment on table public.college_comparison_options is
  'User-entered or imported AP EAPCET comparison records. Data status and provenance are mandatory context; no admission guarantee is implied.';
comment on column public.college_comparison_options.data_status is
  'official_verified, historical, estimate, unverified, or missing; missing means no reliable value is available.';
