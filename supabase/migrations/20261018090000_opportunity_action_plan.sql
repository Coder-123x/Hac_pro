-- Phase 8: opportunity action plans layered on scholarship records.
-- No schemes or eligibility facts are seeded by this migration.

alter table public.scholarship_records
  add column applicable_academic_year smallint,
  add column required_documents text[] not null default '{}',
  add column application_steps text[] not null default '{}';

alter table public.scholarship_records
  add constraint scholarship_records_academic_year_valid
    check (applicable_academic_year is null or applicable_academic_year between 2000 and 2100),
  add constraint scholarship_records_required_documents_valid
    check (cardinality(required_documents) <= 50),
  add constraint scholarship_records_application_steps_valid
    check (cardinality(application_steps) <= 50);

alter table public.scholarship_applications
  add column opportunity_state text not null default 'researching'
    check (opportunity_state in ('researching', 'preparing', 'ready_to_apply', 'submitted', 'approved', 'rejected', 'expired'));

create table public.opportunity_criteria (
  id uuid primary key default gen_random_uuid(),
  scholarship_id uuid not null,
  family_id uuid not null,
  student_id uuid not null references auth.users (id) on delete cascade,
  criterion_type text not null check (criterion_type in ('fixed', 'actionable')),
  label text not null check (char_length(btrim(label)) between 1 and 240),
  status text not null default 'unknown' check (status in ('eligible', 'not_eligible', 'unknown')),
  evidence_reason text not null default '' check (char_length(evidence_reason) <= 3000),
  source_url text check (source_url is null or source_url ~ '^https?://'),
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (scholarship_id, family_id)
    references public.scholarship_records (id, family_id) on delete cascade
);

create table public.opportunity_tasks (
  id uuid primary key default gen_random_uuid(),
  scholarship_id uuid not null,
  family_id uuid not null,
  student_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 240),
  description text not null default '' check (char_length(description) <= 3000),
  due_date date,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'completed', 'blocked')),
  blocker text not null default '' check (char_length(blocker) <= 2000),
  next_step text not null default '' check (char_length(next_step) <= 2000),
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (scholarship_id, family_id)
    references public.scholarship_records (id, family_id) on delete cascade
);

create table public.opportunity_alternatives (
  id uuid primary key default gen_random_uuid(),
  scholarship_id uuid not null,
  alternative_scholarship_id uuid not null,
  family_id uuid not null,
  student_id uuid not null references auth.users (id) on delete cascade,
  rationale text not null default '' check (char_length(rationale) <= 2000),
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (scholarship_id, alternative_scholarship_id, student_id),
  check (scholarship_id <> alternative_scholarship_id),
  foreign key (scholarship_id, family_id)
    references public.scholarship_records (id, family_id) on delete cascade,
  foreign key (alternative_scholarship_id, family_id)
    references public.scholarship_records (id, family_id) on delete cascade
);

create index opportunity_criteria_scope_idx on public.opportunity_criteria (scholarship_id, family_id, student_id);
create index opportunity_tasks_scope_idx on public.opportunity_tasks (scholarship_id, family_id, student_id, status, due_date);
create index opportunity_alternatives_scope_idx on public.opportunity_alternatives (scholarship_id, family_id, student_id);

create trigger opportunity_criteria_set_updated_at before update on public.opportunity_criteria
  for each row execute function public.set_updated_at();
create trigger opportunity_tasks_set_updated_at before update on public.opportunity_tasks
  for each row execute function public.set_updated_at();
create trigger opportunity_alternatives_set_updated_at before update on public.opportunity_alternatives
  for each row execute function public.set_updated_at();
create trigger opportunity_criteria_prevent_creator_change before update on public.opportunity_criteria
  for each row execute function public.prevent_record_creator_change();
create trigger opportunity_tasks_prevent_creator_change before update on public.opportunity_tasks
  for each row execute function public.prevent_record_creator_change();
create trigger opportunity_alternatives_prevent_creator_change before update on public.opportunity_alternatives
  for each row execute function public.prevent_record_creator_change();
create trigger opportunity_criteria_prevent_family_scope_change before update on public.opportunity_criteria
  for each row execute function public.prevent_family_scope_change();
create trigger opportunity_tasks_prevent_family_scope_change before update on public.opportunity_tasks
  for each row execute function public.prevent_family_scope_change();
create trigger opportunity_alternatives_prevent_family_scope_change before update on public.opportunity_alternatives
  for each row execute function public.prevent_family_scope_change();

alter table public.opportunity_criteria enable row level security;
alter table public.opportunity_tasks enable row level security;
alter table public.opportunity_alternatives enable row level security;
revoke all on table public.opportunity_criteria, public.opportunity_tasks, public.opportunity_alternatives from anon, authenticated;
grant select, insert, update, delete on table public.opportunity_criteria, public.opportunity_tasks, public.opportunity_alternatives to authenticated;

create policy "opportunity_criteria_select_allowed" on public.opportunity_criteria
  for select to authenticated using (
    student_id = auth.uid()
    or public.is_family_info_shared(family_id, student_id, 'scholarship_progress')
  );
create policy "opportunity_criteria_insert_student" on public.opportunity_criteria
  for insert to authenticated with check (
    student_id = auth.uid() and created_by = auth.uid() and public.is_active_family_student(family_id)
    and exists (select 1 from public.scholarship_records s where s.id = scholarship_id and s.family_id = opportunity_criteria.family_id and s.student_id = auth.uid())
  );
create policy "opportunity_criteria_update_student" on public.opportunity_criteria
  for update to authenticated using (student_id = auth.uid() and public.is_active_family_student(family_id))
  with check (student_id = auth.uid() and public.is_active_family_student(family_id));
create policy "opportunity_criteria_delete_student" on public.opportunity_criteria
  for delete to authenticated using (student_id = auth.uid() and public.is_active_family_student(family_id));

create policy "opportunity_tasks_select_allowed" on public.opportunity_tasks
  for select to authenticated using (
    student_id = auth.uid()
    or public.is_family_info_shared(family_id, student_id, 'scholarship_progress')
  );
create policy "opportunity_tasks_insert_student" on public.opportunity_tasks
  for insert to authenticated with check (
    student_id = auth.uid() and created_by = auth.uid() and public.is_active_family_student(family_id)
    and exists (select 1 from public.scholarship_records s where s.id = scholarship_id and s.family_id = opportunity_tasks.family_id and s.student_id = auth.uid())
  );
create policy "opportunity_tasks_update_student" on public.opportunity_tasks
  for update to authenticated using (student_id = auth.uid() and public.is_active_family_student(family_id))
  with check (student_id = auth.uid() and public.is_active_family_student(family_id));
create policy "opportunity_tasks_delete_student" on public.opportunity_tasks
  for delete to authenticated using (student_id = auth.uid() and public.is_active_family_student(family_id));

create policy "opportunity_alternatives_select_allowed" on public.opportunity_alternatives
  for select to authenticated using (
    student_id = auth.uid()
    or public.is_family_info_shared(family_id, student_id, 'scholarship_progress')
  );
create policy "opportunity_alternatives_insert_student" on public.opportunity_alternatives
  for insert to authenticated with check (
    student_id = auth.uid() and created_by = auth.uid() and public.is_active_family_student(family_id)
    and exists (select 1 from public.scholarship_records s where s.id = scholarship_id and s.family_id = opportunity_alternatives.family_id and s.student_id = auth.uid())
    and exists (select 1 from public.scholarship_records s where s.id = alternative_scholarship_id and s.family_id = opportunity_alternatives.family_id and s.student_id = auth.uid())
  );
create policy "opportunity_alternatives_update_student" on public.opportunity_alternatives
  for update to authenticated using (student_id = auth.uid() and public.is_active_family_student(family_id))
  with check (student_id = auth.uid() and public.is_active_family_student(family_id));
create policy "opportunity_alternatives_delete_student" on public.opportunity_alternatives
  for delete to authenticated using (student_id = auth.uid() and public.is_active_family_student(family_id));

comment on table public.opportunity_criteria is 'Student-recorded eligibility assessments. Unknown is the safe default; evidence_reason is required context for decisions.';
comment on table public.opportunity_tasks is 'Student-owned preparation and follow-up tasks. Completion does not prove application submission or approval.';
comment on table public.opportunity_alternatives is 'Student-selected alternative opportunities within the same family and student scope.';
comment on column public.scholarship_applications.opportunity_state is 'Opportunity-plan lifecycle, separate from financial application status and never an evidence claim by itself.';
