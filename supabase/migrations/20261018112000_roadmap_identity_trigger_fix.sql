-- Fix roadmap identity validation for tables with different parent columns.
-- roadmap_milestones has plan_id but no milestone_id; only roadmap_tasks has both.
-- Keep student, plan and milestone identities immutable after insert.
create or replace function public.prevent_roadmap_identity_change()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if new.student_id is distinct from old.student_id then
    raise exception 'A roadmap record identity cannot be changed';
  end if;

  if tg_table_name <> 'roadmap_plans'
    and new.plan_id is distinct from old.plan_id then
    raise exception 'A roadmap record identity cannot be changed';
  end if;

  if tg_table_name = 'roadmap_tasks'
    and new.milestone_id is distinct from old.milestone_id then
    raise exception 'A roadmap record identity cannot be changed';
  end if;

  return new;
end;
$$;

comment on function public.prevent_roadmap_identity_change() is
  'Prevents changing student or roadmap parent identity after insert without reading columns absent from other roadmap tables.';
