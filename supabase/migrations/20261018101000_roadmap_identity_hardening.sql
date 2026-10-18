-- Keep roadmap ownership and parent-child scope immutable after insert.
create or replace function public.prevent_roadmap_identity_change()
returns trigger language plpgsql set search_path = pg_catalog as $$
begin
  if new.student_id is distinct from old.student_id
    or (tg_table_name <> 'roadmap_plans' and new.plan_id is distinct from old.plan_id)
    or (tg_table_name = 'roadmap_tasks' and new.milestone_id is distinct from old.milestone_id) then
    raise exception 'A roadmap record identity cannot be changed';
  end if;
  return new;
end;
$$;
create trigger roadmap_plans_prevent_identity_change before update on public.roadmap_plans for each row execute function public.prevent_roadmap_identity_change();
create trigger roadmap_milestones_prevent_identity_change before update on public.roadmap_milestones for each row execute function public.prevent_roadmap_identity_change();
create trigger roadmap_tasks_prevent_identity_change before update on public.roadmap_tasks for each row execute function public.prevent_roadmap_identity_change();
create trigger roadmap_resources_prevent_identity_change before update on public.roadmap_resources for each row execute function public.prevent_roadmap_identity_change();

comment on function public.prevent_roadmap_identity_change() is 'Prevents changing student or roadmap parent identity after insert.';
