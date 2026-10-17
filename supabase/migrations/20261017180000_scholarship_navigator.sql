-- Phase 6: provenance-aware, student-owned scholarship records and tracking.
-- No scholarship schemes or official claims are seeded by this migration.

create table public.scholarship_records (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  student_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 180),
  provider text not null check (char_length(btrim(provider)) between 1 and 180),
  award_min_paise bigint check (award_min_paise is null or award_min_paise >= 0),
  award_max_paise bigint check (award_max_paise is null or award_max_paise >= 0),
  eligibility_rules text not null default '' check (char_length(eligibility_rules) <= 5000),
  deadline date,
  official_source_url text check (official_source_url is null or official_source_url ~ '^https?://'),
  source_type text not null default 'user_provided' check (source_type in ('official', 'secondary', 'user_provided')),
  verification_status text not null default 'unverified' check (verification_status in ('official_verified', 'secondary_verified', 'unverified', 'missing')),
  last_verified_at date,
  notes text not null default '' check (char_length(notes) <= 4000),
  state_code text not null default 'AP' check (state_code ~ '^[A-Z]{2}$'),
  category text check (category is null or char_length(btrim(category)) between 1 and 80),
  income_limit_paise bigint check (income_limit_paise is null or income_limit_paise >= 0),
  course text check (course is null or char_length(btrim(course)) between 1 and 160),
  institution_type text check (institution_type is null or char_length(btrim(institution_type)) between 1 and 120),
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, family_id),
  check (award_min_paise is null or award_max_paise is null or award_max_paise >= award_min_paise),
  check (verification_status <> 'official_verified' or (source_type = 'official' and official_source_url is not null and last_verified_at is not null)),
  check (verification_status not in ('official_verified', 'secondary_verified') or official_source_url is not null)
);

create table public.scholarship_applications (
  id uuid primary key default gen_random_uuid(),
  scholarship_id uuid not null,
  family_id uuid not null,
  student_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'saved' check (status in ('saved', 'planning', 'applied', 'approved', 'rejected', 'received')),
  awarded_amount_paise bigint check (awarded_amount_paise is null or awarded_amount_paise >= 0),
  received_amount_paise bigint check (received_amount_paise is null or received_amount_paise >= 0),
  confirmed_funding boolean not null default false,
  notes text not null default '' check (char_length(notes) <= 3000),
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (scholarship_id, student_id),
  foreign key (scholarship_id, family_id)
    references public.scholarship_records (id, family_id) on delete cascade,
  check (confirmed_funding = false or (status in ('approved', 'received') and coalesce(received_amount_paise, awarded_amount_paise) is not null and coalesce(received_amount_paise, awarded_amount_paise) > 0)),
  check (status <> 'received' or received_amount_paise is not null)
);

create or replace function public.prevent_scholarship_application_identity_change()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if new.scholarship_id is distinct from old.scholarship_id
     or new.student_id is distinct from old.student_id then
    raise exception 'A scholarship application identity cannot be changed';
  end if;
  return new;
end;
$$;

create index scholarship_records_student_idx on public.scholarship_records (student_id, family_id);
create index scholarship_records_filter_idx on public.scholarship_records (state_code, category, deadline);
create index scholarship_applications_student_idx on public.scholarship_applications (student_id, family_id, status);

create trigger scholarship_records_set_updated_at before update on public.scholarship_records
  for each row execute function public.set_updated_at();
create trigger scholarship_records_prevent_creator_change before update on public.scholarship_records
  for each row execute function public.prevent_record_creator_change();
create trigger scholarship_records_prevent_family_scope_change before update on public.scholarship_records
  for each row execute function public.prevent_family_scope_change();
create trigger scholarship_applications_set_updated_at before update on public.scholarship_applications
  for each row execute function public.set_updated_at();
create trigger scholarship_applications_prevent_creator_change before update on public.scholarship_applications
  for each row execute function public.prevent_record_creator_change();
create trigger scholarship_applications_prevent_family_scope_change before update on public.scholarship_applications
  for each row execute function public.prevent_family_scope_change();
create trigger scholarship_applications_prevent_identity_change before update on public.scholarship_applications
  for each row execute function public.prevent_scholarship_application_identity_change();

alter table public.scholarship_records enable row level security;
alter table public.scholarship_applications enable row level security;
revoke all on table public.scholarship_records, public.scholarship_applications from anon, authenticated;
grant select, insert, update, delete on table public.scholarship_records to authenticated;
grant select, insert, update, delete on table public.scholarship_applications to authenticated;

create policy "scholarship_records_select_owner_or_shared_parent" on public.scholarship_records
  for select to authenticated using (
    student_id = auth.uid()
    or exists (
      select 1 from public.student_profiles
      where user_id = scholarship_records.student_id and family_id = scholarship_records.family_id
        and is_shared_with_parents and public.is_active_family_parent(scholarship_records.family_id)
    )
  );
create policy "scholarship_records_insert_student" on public.scholarship_records
  for insert to authenticated with check (
    student_id = auth.uid() and created_by = auth.uid() and public.is_active_family_student(family_id)
  );
create policy "scholarship_records_update_owner" on public.scholarship_records
  for update to authenticated using (student_id = auth.uid() and public.is_active_family_student(family_id))
  with check (student_id = auth.uid() and public.is_active_family_student(family_id));
create policy "scholarship_records_delete_owner" on public.scholarship_records
  for delete to authenticated using (student_id = auth.uid() and public.is_active_family_student(family_id));

create policy "scholarship_applications_select_allowed" on public.scholarship_applications
  for select to authenticated using (
    exists (select 1 from public.scholarship_records s where s.id = scholarship_id and s.family_id = scholarship_applications.family_id)
  );
create policy "scholarship_applications_insert_student" on public.scholarship_applications
  for insert to authenticated with check (
    student_id = auth.uid() and created_by = auth.uid() and public.is_active_family_student(family_id)
    and exists (select 1 from public.scholarship_records s where s.id = scholarship_id and s.family_id = scholarship_applications.family_id and s.student_id = auth.uid())
  );
create policy "scholarship_applications_update_owner" on public.scholarship_applications
  for update to authenticated using (
    student_id = auth.uid() and public.is_active_family_student(family_id)
  ) with check (
    student_id = auth.uid() and public.is_active_family_student(family_id)
    and exists (select 1 from public.scholarship_records s where s.id = scholarship_id and s.family_id = scholarship_applications.family_id and s.student_id = auth.uid())
  );
create policy "scholarship_applications_delete_owner" on public.scholarship_applications
  for delete to authenticated using (student_id = auth.uid() and public.is_active_family_student(family_id));

comment on table public.scholarship_records is
  'Manual or imported scholarship records. Source and verification fields are retained; no record is an admission or award guarantee.';
comment on column public.scholarship_applications.confirmed_funding is
  'Only explicit user confirmation for an approved or received application makes the amount eligible for confirmed-funding calculations.';
