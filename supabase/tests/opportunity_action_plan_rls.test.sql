-- Run with: supabase test db --local supabase/tests/opportunity_action_plan_rls.test.sql
begin;
select plan(10);
insert into auth.users (id, email) values
  ('eeee9999-0000-0000-0000-000000000001', 'opportunity-student@example.test'),
  ('eeee9999-0000-0000-0000-000000000002', 'opportunity-parent@example.test'),
  ('eeee9999-0000-0000-0000-000000000003', 'opportunity-outsider@example.test');
insert into public.families (id, name, created_by) values
  ('bcbcbcbc-bcbc-bcbc-bcbc-bcbcbcbcbcbc', 'Opportunity Family A', 'eeee9999-0000-0000-0000-000000000002'),
  ('dededede-dede-dede-dede-dededededede', 'Opportunity Family B', 'eeee9999-0000-0000-0000-000000000003');
insert into public.family_members (family_id, user_id, role, status) values
  ('bcbcbcbc-bcbc-bcbc-bcbc-bcbcbcbcbcbc', 'eeee9999-0000-0000-0000-000000000001', 'student', 'active'),
  ('bcbcbcbc-bcbc-bcbc-bcbc-bcbcbcbcbcbc', 'eeee9999-0000-0000-0000-000000000002', 'parent', 'active'),
  ('dededede-dede-dede-dede-dededededede', 'eeee9999-0000-0000-0000-000000000003', 'parent', 'active');
insert into public.scholarship_records (id, family_id, student_id, name, provider, eligibility_rules, applicable_academic_year, required_documents, application_steps, created_by)
  values ('efefefef-0000-0000-0000-000000000001', 'bcbcbcbc-bcbc-bcbc-bcbc-bcbcbcbcbcbc', 'eeee9999-0000-0000-0000-000000000001', 'Synthetic opportunity', 'Synthetic provider', 'Verify domicile', 2026, array['income certificate'], array['Open official portal','Submit application'], 'eeee9999-0000-0000-0000-000000000001');
set local role authenticated;
set local request.jwt.claim.sub = 'eeee9999-0000-0000-0000-000000000001';
select results_eq($$insert into public.opportunity_criteria (scholarship_id, family_id, student_id, criterion_type, label, status, evidence_reason, created_by) values ('efefefef-0000-0000-0000-000000000001','bcbcbcbc-bcbc-bcbc-bcbc-bcbcbcbcbcbc','eeee9999-0000-0000-0000-000000000001','fixed','Domicile','unknown','Needs evidence','eeee9999-0000-0000-0000-000000000001') returning status$$, array['unknown'], 'student can record an unknown criterion');
select results_eq($$insert into public.opportunity_tasks (scholarship_id, family_id, student_id, title, priority, next_step, created_by) values ('efefefef-0000-0000-0000-000000000001','bcbcbcbc-bcbc-bcbc-bcbc-bcbcbcbcbcbc','eeee9999-0000-0000-0000-000000000001','Gather income certificate','high','Request from office','eeee9999-0000-0000-0000-000000000001') returning title$$, array['Gather income certificate'], 'student can create a preparation task');
set local request.jwt.claim.sub = 'eeee9999-0000-0000-0000-000000000002';
select is_empty($$select id from public.opportunity_tasks$$, 'parent cannot read an unshared action plan');
select is_empty($$select id from public.opportunity_criteria$$, 'parent cannot read unshared criteria');
set local request.jwt.claim.sub = 'eeee9999-0000-0000-0000-000000000001';
select results_eq($$insert into public.family_sharing_preferences (family_id, student_id, scholarship_progress_shared) values ('bcbcbcbc-bcbc-bcbc-bcbc-bcbcbcbcbcbc','eeee9999-0000-0000-0000-000000000001',true) returning scholarship_progress_shared::text$$, array['true'], 'student can share scholarship progress');
set local request.jwt.claim.sub = 'eeee9999-0000-0000-0000-000000000002';
select results_eq($$select title from public.opportunity_tasks$$, array['Gather income certificate'], 'parent can read shared action plan');
select throws_ok($$insert into public.opportunity_tasks (scholarship_id, family_id, student_id, title, created_by) values ('efefefef-0000-0000-0000-000000000001','bcbcbcbc-bcbc-bcbc-bcbc-bcbcbcbcbcbc','eeee9999-0000-0000-0000-000000000002','Unauthorized','eeee9999-0000-0000-0000-000000000002')$$, '42501', null, 'parent cannot create action-plan tasks');
set local request.jwt.claim.sub = 'eeee9999-0000-0000-0000-000000000003';
select is_empty($$select id from public.opportunity_tasks$$, 'unrelated parent cannot read action plans');
set local request.jwt.claim.sub = 'eeee9999-0000-0000-0000-000000000001';
select results_eq($$update public.family_sharing_preferences set scholarship_progress_shared = false where family_id = 'bcbcbcbc-bcbc-bcbc-bcbc-bcbcbcbcbcbc' returning scholarship_progress_shared::text$$, array['false'], 'student can revoke scholarship sharing');
set local request.jwt.claim.sub = 'eeee9999-0000-0000-0000-000000000002';
select is_empty($$select id from public.opportunity_tasks$$, 'revocation blocks future action-plan reads');
select * from finish();
rollback;
