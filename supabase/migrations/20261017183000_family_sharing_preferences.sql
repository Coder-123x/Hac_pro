-- Phase 7: explicit, least-privilege student sharing choices.

create table public.family_sharing_preferences (
  family_id uuid not null references public.families (id) on delete cascade,
  student_id uuid not null references auth.users (id) on delete cascade,
  budget_summary_shared boolean not null default false,
  college_comparisons_shared boolean not null default false,
  scholarship_progress_shared boolean not null default false,
  professional_development_shared boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (family_id, student_id)
);

create or replace function public.is_family_info_shared(p_family_id uuid, p_student_id uuid, p_info text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
    from public.family_sharing_preferences p
    join public.family_members m on m.family_id = p.family_id and m.user_id = auth.uid()
    where p.family_id = p_family_id
      and p.student_id = p_student_id
      and m.role = 'parent'
      and m.status = 'active'
      and case p_info
        when 'budget_summary' then p.budget_summary_shared
        when 'college_comparisons' then p.college_comparisons_shared
        when 'scholarship_progress' then p.scholarship_progress_shared
        when 'professional_development' then p.professional_development_shared
        else false
      end
  );
$$;

create or replace function public.prevent_sharing_identity_change()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if new.family_id is distinct from old.family_id or new.student_id is distinct from old.student_id then
    raise exception 'Sharing preference identity cannot be changed';
  end if;
  return new;
end;
$$;

create trigger family_sharing_preferences_set_updated_at before update on public.family_sharing_preferences
  for each row execute function public.set_updated_at();
create trigger family_sharing_preferences_prevent_identity_change before update on public.family_sharing_preferences
  for each row execute function public.prevent_sharing_identity_change();

alter table public.family_sharing_preferences enable row level security;
revoke all on table public.family_sharing_preferences from anon, authenticated;
grant select, insert, update on table public.family_sharing_preferences to authenticated;

create policy "sharing_preferences_select_student" on public.family_sharing_preferences
  for select to authenticated using (student_id = auth.uid());
create policy "sharing_preferences_select_parent" on public.family_sharing_preferences
  for select to authenticated using (public.is_active_family_parent(family_id));
create policy "sharing_preferences_insert_student" on public.family_sharing_preferences
  for insert to authenticated with check (student_id = auth.uid() and public.is_active_family_student(family_id));
create policy "sharing_preferences_update_student" on public.family_sharing_preferences
  for update to authenticated using (student_id = auth.uid() and public.is_active_family_student(family_id))
  with check (student_id = auth.uid() and public.is_active_family_student(family_id));

revoke all on function public.is_family_info_shared(uuid, uuid, text) from public, anon;
grant execute on function public.is_family_info_shared(uuid, uuid, text) to authenticated;

drop policy "college_comparisons_select_owner_or_shared_parent" on public.college_comparisons;
create policy "college_comparisons_select_owner_or_shared_parent" on public.college_comparisons
  for select to authenticated using (
    student_id = auth.uid()
    or public.is_family_info_shared(family_id, student_id, 'college_comparisons')
  );

drop policy "scholarship_records_select_owner_or_shared_parent" on public.scholarship_records;
create policy "scholarship_records_select_owner_or_shared_parent" on public.scholarship_records
  for select to authenticated using (
    student_id = auth.uid()
    or public.is_family_info_shared(family_id, student_id, 'scholarship_progress')
  );

comment on table public.family_sharing_preferences is
  'Student-controlled sharing switches. Revocation prevents future database reads; it cannot erase information already viewed or copied.';

-- Budget and expense details are family-owned, but a parent who did not create
-- them only sees them after a student explicitly shares the budget summary.
drop policy "family_budgets_select_members" on public.family_budgets;
create policy "family_budgets_select_members" on public.family_budgets for select to authenticated
  using (
    created_by = auth.uid()
    or public.is_active_family_student(family_id)
    or exists (
      select 1 from public.family_sharing_preferences p
      where p.family_id = family_budgets.family_id
        and p.budget_summary_shared
        and public.is_active_family_parent(family_budgets.family_id)
    )
  );

drop policy "expenses_select_members" on public.expenses;
create policy "expenses_select_members" on public.expenses for select to authenticated
  using (
    created_by = auth.uid()
    or public.is_active_family_student(family_id)
    or exists (
      select 1 from public.family_sharing_preferences p
      where p.family_id = expenses.family_id
        and p.budget_summary_shared
        and public.is_active_family_parent(expenses.family_id)
    )
  );
