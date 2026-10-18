-- Run with: supabase test db --local supabase/tests/education_career_roadmap_rls.test.sql
begin;
select plan(15);
insert into auth.users (id, email) values
  ('aaaa8888-0000-0000-0000-000000000001', 'roadmap-student@example.test'),
  ('aaaa8888-0000-0000-0000-000000000002', 'roadmap-parent@example.test'),
  ('aaaa8888-0000-0000-0000-000000000003', 'roadmap-outsider@example.test');
insert into public.families (id, name, created_by) values
  ('abababab-abab-abab-abab-abababababab', 'Roadmap Family A', 'aaaa8888-0000-0000-0000-000000000002'),
  ('cdcdcdcd-cdcd-cdcd-cdcd-cdcdcdcdcdcd', 'Roadmap Family B', 'aaaa8888-0000-0000-0000-000000000003');
insert into public.family_members (family_id, user_id, role, status) values
  ('abababab-abab-abab-abab-abababababab', 'aaaa8888-0000-0000-0000-000000000001', 'student', 'active'),
  ('abababab-abab-abab-abab-abababababab', 'aaaa8888-0000-0000-0000-000000000002', 'parent', 'active'),
  ('cdcdcdcd-cdcd-cdcd-cdcd-cdcdcdcdcdcd', 'aaaa8888-0000-0000-0000-000000000003', 'parent', 'active');
set local role authenticated;
set local request.jwt.claim.sub = 'aaaa8888-0000-0000-0000-000000000001';
select results_eq($$insert into public.roadmap_plans (family_id, student_id, created_by, journey, career_goal) values ('abababab-abab-abab-abab-abababababab','aaaa8888-0000-0000-0000-000000000001','aaaa8888-0000-0000-0000-000000000001','aspirant','Synthetic engineering goal') returning career_goal$$, array['Synthetic engineering goal'], 'student can create a private roadmap');
select results_eq($$insert into public.roadmap_milestones (plan_id, family_id, student_id, created_by, phase, title) select id, family_id, student_id, student_id, 'foundation', 'Clarify goals' from public.roadmap_plans where family_id = 'abababab-abab-abab-abab-abababababab' returning title$$, array['Clarify goals'], 'student can create roadmap milestones');
select results_eq($$insert into public.roadmap_tasks (milestone_id, plan_id, family_id, student_id, created_by, title) select m.id, m.plan_id, m.family_id, m.student_id, m.student_id, 'Record next action' from public.roadmap_milestones m where m.family_id = 'abababab-abab-abab-abab-abababababab' returning title$$, array['Record next action'], 'student can create roadmap tasks');
select results_eq($$update public.roadmap_milestones set status = 'completed' where family_id = 'abababab-abab-abab-abab-abababababab' returning status$$, array['completed'], 'student can update milestone status');
select results_eq($$select status from public.roadmap_milestones where family_id = 'abababab-abab-abab-abab-abababababab'$$, array['completed'], 'milestone status persists after update');
select results_eq($$update public.roadmap_tasks set status = 'completed' where family_id = 'abababab-abab-abab-abab-abababababab' returning status$$, array['completed'], 'student can update task status');
select results_eq($$select status from public.roadmap_tasks where family_id = 'abababab-abab-abab-abab-abababababab'$$, array['completed'], 'task status persists after update');
set local request.jwt.claim.sub = 'aaaa8888-0000-0000-0000-000000000002';
select is_empty($$select id from public.roadmap_plans$$, 'parent cannot read private roadmap');
select is_empty($$select id from public.roadmap_milestones$$, 'parent cannot read private milestones');
set local request.jwt.claim.sub = 'aaaa8888-0000-0000-0000-000000000001';
select results_eq($$insert into public.family_sharing_preferences (family_id, student_id, professional_development_shared) values ('abababab-abab-abab-abab-abababababab','aaaa8888-0000-0000-0000-000000000001',true) returning professional_development_shared::text$$, array['true'], 'student can share professional development');
set local request.jwt.claim.sub = 'aaaa8888-0000-0000-0000-000000000002';
select results_eq($$select career_goal from public.roadmap_plans$$, array['Synthetic engineering goal'], 'parent can read shared roadmap');
set local request.jwt.claim.sub = 'aaaa8888-0000-0000-0000-000000000003';
select is_empty($$select id from public.roadmap_plans$$, 'unrelated family cannot read roadmap');
select is_empty($$update public.roadmap_milestones set status = 'blocked' where family_id = 'abababab-abab-abab-abab-abababababab' returning id$$, 'unrelated family cannot update roadmap milestones');
set local request.jwt.claim.sub = 'aaaa8888-0000-0000-0000-000000000001';
select results_eq($$update public.family_sharing_preferences set professional_development_shared = false where family_id = 'abababab-abab-abab-abab-abababababab' returning professional_development_shared::text$$, array['false'], 'student can revoke roadmap sharing');
set local request.jwt.claim.sub = 'aaaa8888-0000-0000-0000-000000000002';
select is_empty($$select id from public.roadmap_plans$$, 'revocation blocks future parent reads');
select * from finish();
rollback;
