-- Phase 9: student-owned education-to-career roadmaps.
-- Templates are planning prompts only; they do not assert skills, eligibility or outcomes.

create table public.roadmap_plans (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  student_id uuid not null,
  journey text not null check (journey in ('aspirant', 'current_student')),
  career_goal text not null check (char_length(trim(career_goal)) between 1 and 240),
  current_branch text,
  current_year smallint check (current_year is null or current_year between 1 and 4),
  skill_level text check (skill_level is null or skill_level in ('beginner', 'developing', 'intermediate', 'advanced')),
  weekly_study_hours numeric(5,2) check (weekly_study_hours is null or weekly_study_hours between 0 and 168),
  budget_constraint_paise bigint check (budget_constraint_paise is null or budget_constraint_paise >= 0),
  target_date date,
  goal_notes text not null default '',
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, family_id)
);

create table public.roadmap_milestones (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null,
  family_id uuid not null,
  student_id uuid not null,
  phase text not null check (phase in ('foundation', 'selection', 'admission', 'first_year', 'semester', 'skills', 'portfolio', 'experience', 'higher_education')),
  title text not null check (char_length(trim(title)) between 1 and 240),
  description text not null default '',
  estimated_effort_hours numeric(7,2) check (estimated_effort_hours is null or estimated_effort_hours >= 0),
  prerequisites text[] not null default '{}',
  due_date date,
  status text not null default 'not_started' check (status in ('not_started', 'in_progress', 'completed', 'blocked')),
  evidence_url text,
  notes text not null default '',
  sort_order smallint not null default 0 check (sort_order >= 0),
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, family_id),
  foreign key (plan_id, family_id) references public.roadmap_plans (id, family_id) on delete cascade
);

create table public.roadmap_tasks (
  id uuid primary key default gen_random_uuid(),
  milestone_id uuid not null,
  plan_id uuid not null,
  family_id uuid not null,
  student_id uuid not null,
  title text not null check (char_length(trim(title)) between 1 and 240),
  description text not null default '',
  due_date date,
  estimated_effort_hours numeric(7,2) check (estimated_effort_hours is null or estimated_effort_hours >= 0),
  status text not null default 'not_started' check (status in ('not_started', 'in_progress', 'completed', 'blocked')),
  blocker text not null default '',
  next_step text not null default '',
  evidence_url text,
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, family_id),
  foreign key (milestone_id, family_id) references public.roadmap_milestones (id, family_id) on delete cascade,
  foreign key (plan_id, family_id) references public.roadmap_plans (id, family_id) on delete cascade
);

create table public.roadmap_resources (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null,
  family_id uuid not null,
  student_id uuid not null,
  title text not null check (char_length(trim(title)) between 1 and 240),
  source_url text not null check (source_url ~* '^https?://'),
  resource_type text not null default 'other' check (resource_type in ('course', 'documentation', 'practice', 'project_guide', 'other')),
  pricing_type text not null default 'unknown' check (pricing_type in ('free', 'paid', 'unknown')),
  price_paise bigint check (price_paise is null or price_paise >= 0),
  provider text not null default '',
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  verification_status text not null default 'unverified' check (verification_status in ('official_verified', 'secondary_verified', 'unverified')),
  last_verified_at timestamptz,
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plan_id, source_url),
  foreign key (plan_id, family_id) references public.roadmap_plans (id, family_id) on delete cascade
);

create index roadmap_plans_student_idx on public.roadmap_plans (student_id, family_id, updated_at desc);
create index roadmap_milestones_plan_idx on public.roadmap_milestones (plan_id, family_id, sort_order);
create index roadmap_tasks_milestone_idx on public.roadmap_tasks (milestone_id, plan_id, family_id, due_date);
create index roadmap_resources_plan_idx on public.roadmap_resources (plan_id, family_id);

create trigger roadmap_plans_set_updated_at before update on public.roadmap_plans for each row execute function public.set_updated_at();
create trigger roadmap_milestones_set_updated_at before update on public.roadmap_milestones for each row execute function public.set_updated_at();
create trigger roadmap_tasks_set_updated_at before update on public.roadmap_tasks for each row execute function public.set_updated_at();
create trigger roadmap_resources_set_updated_at before update on public.roadmap_resources for each row execute function public.set_updated_at();
create trigger roadmap_plans_prevent_family_scope_change before update on public.roadmap_plans for each row execute function public.prevent_family_scope_change();
create trigger roadmap_milestones_prevent_family_scope_change before update on public.roadmap_milestones for each row execute function public.prevent_family_scope_change();
create trigger roadmap_tasks_prevent_family_scope_change before update on public.roadmap_tasks for each row execute function public.prevent_family_scope_change();
create trigger roadmap_resources_prevent_family_scope_change before update on public.roadmap_resources for each row execute function public.prevent_family_scope_change();


alter table public.roadmap_plans enable row level security;
alter table public.roadmap_milestones enable row level security;
alter table public.roadmap_tasks enable row level security;
alter table public.roadmap_resources enable row level security;
revoke all on public.roadmap_plans, public.roadmap_milestones, public.roadmap_tasks, public.roadmap_resources from anon, authenticated;
grant select, insert, update, delete on public.roadmap_plans, public.roadmap_milestones, public.roadmap_tasks, public.roadmap_resources to authenticated;

create policy roadmap_plans_select_owner_or_shared on public.roadmap_plans for select to authenticated using (student_id = auth.uid() or public.is_family_info_shared(family_id, student_id, 'professional_development'));
create policy roadmap_plans_insert_student on public.roadmap_plans for insert to authenticated with check (student_id = auth.uid() and created_by = auth.uid() and public.is_active_family_student(family_id));
create policy roadmap_plans_update_student on public.roadmap_plans for update to authenticated using (student_id = auth.uid() and public.is_active_family_student(family_id)) with check (student_id = auth.uid() and created_by = auth.uid() and public.is_active_family_student(family_id));
create policy roadmap_plans_delete_student on public.roadmap_plans for delete to authenticated using (student_id = auth.uid() and public.is_active_family_student(family_id));

create policy roadmap_milestones_select_owner_or_shared on public.roadmap_milestones for select to authenticated using (student_id = auth.uid() or public.is_family_info_shared(family_id, student_id, 'professional_development'));
create policy roadmap_milestones_insert_student on public.roadmap_milestones for insert to authenticated with check (student_id = auth.uid() and created_by = auth.uid() and public.is_active_family_student(family_id) and exists (select 1 from public.roadmap_plans p where p.id = plan_id and p.family_id = roadmap_milestones.family_id and p.student_id = auth.uid()));
create policy roadmap_milestones_update_student on public.roadmap_milestones for update to authenticated using (student_id = auth.uid() and public.is_active_family_student(family_id)) with check (student_id = auth.uid() and created_by = auth.uid() and public.is_active_family_student(family_id));
create policy roadmap_milestones_delete_student on public.roadmap_milestones for delete to authenticated using (student_id = auth.uid() and public.is_active_family_student(family_id));

create policy roadmap_tasks_select_owner_or_shared on public.roadmap_tasks for select to authenticated using (student_id = auth.uid() or public.is_family_info_shared(family_id, student_id, 'professional_development'));
create policy roadmap_tasks_insert_student on public.roadmap_tasks for insert to authenticated with check (student_id = auth.uid() and created_by = auth.uid() and public.is_active_family_student(family_id) and exists (select 1 from public.roadmap_milestones m where m.id = milestone_id and m.plan_id = roadmap_tasks.plan_id and m.family_id = roadmap_tasks.family_id and m.student_id = auth.uid()));
create policy roadmap_tasks_update_student on public.roadmap_tasks for update to authenticated using (student_id = auth.uid() and public.is_active_family_student(family_id)) with check (student_id = auth.uid() and created_by = auth.uid() and public.is_active_family_student(family_id));
create policy roadmap_tasks_delete_student on public.roadmap_tasks for delete to authenticated using (student_id = auth.uid() and public.is_active_family_student(family_id));

create policy roadmap_resources_select_owner_or_shared on public.roadmap_resources for select to authenticated using (student_id = auth.uid() or public.is_family_info_shared(family_id, student_id, 'professional_development'));
create policy roadmap_resources_insert_student on public.roadmap_resources for insert to authenticated with check (student_id = auth.uid() and created_by = auth.uid() and public.is_active_family_student(family_id) and exists (select 1 from public.roadmap_plans p where p.id = plan_id and p.family_id = roadmap_resources.family_id and p.student_id = auth.uid()));
create policy roadmap_resources_update_student on public.roadmap_resources for update to authenticated using (student_id = auth.uid() and public.is_active_family_student(family_id)) with check (student_id = auth.uid() and created_by = auth.uid() and public.is_active_family_student(family_id));
create policy roadmap_resources_delete_student on public.roadmap_resources for delete to authenticated using (student_id = auth.uid() and public.is_active_family_student(family_id));

comment on table public.roadmap_plans is 'Private-by-default student career and education planning goals; generated templates are not verified advice.';
comment on table public.roadmap_resources is 'Student-curated resources with provenance and pricing metadata; no catalog is seeded by this migration.';
