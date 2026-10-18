-- PL/pgSQL record fields must be accessed only inside table-specific branches.
create or replace function public.prevent_roadmap_identity_change()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if new.student_id is distinct from old.student_id then
    raise exception 'A roadmap record identity cannot be changed';
  end if;

  if tg_table_name = 'roadmap_milestones'
    or tg_table_name = 'roadmap_tasks'
    or tg_table_name = 'roadmap_resources' then
    if new.plan_id is distinct from old.plan_id then
      raise exception 'A roadmap record identity cannot be changed';
    end if;
  end if;

  if tg_table_name = 'roadmap_tasks' then
    if new.milestone_id is distinct from old.milestone_id then
      raise exception 'A roadmap record identity cannot be changed';
    end if;
  end if;

  return new;
end;
$$;

comment on function public.prevent_roadmap_identity_change() is
  'Prevents changing student, plan or task milestone identity with table-safe record field access.';
