-- Run with: supabase test db --local supabase/tests/family_sharing_rls.test.sql
begin;
select plan(8);
insert into auth.users (id, email) values
  ('bbbb9999-0000-0000-0000-000000000001', 'sharing-student@example.test'),
  ('bbbb9999-0000-0000-0000-000000000002', 'sharing-parent@example.test'),
  ('bbbb9999-0000-0000-0000-000000000003', 'sharing-outsider@example.test');
insert into public.families (id, name, created_by) values
  ('bcbcbcbc-bcbc-bcbc-bcbc-bcbcbcbcbcbc', 'Sharing Family A', 'bbbb9999-0000-0000-0000-000000000002'),
  ('dededede-dede-dede-dede-dededededede', 'Sharing Family B', 'bbbb9999-0000-0000-0000-000000000003');
insert into public.family_members (family_id, user_id, role, status) values
  ('bcbcbcbc-bcbc-bcbc-bcbc-bcbcbcbcbcbc', 'bbbb9999-0000-0000-0000-000000000001', 'student', 'active'),
  ('bcbcbcbc-bcbc-bcbc-bcbc-bcbcbcbcbcbc', 'bbbb9999-0000-0000-0000-000000000002', 'parent', 'active'),
  ('dededede-dede-dede-dede-dededededede', 'bbbb9999-0000-0000-0000-000000000003', 'parent', 'active');
insert into public.student_profiles (user_id, family_id, education_stage, state_code, career_goals)
  values ('bbbb9999-0000-0000-0000-000000000001', 'bcbcbcbc-bcbc-bcbc-bcbc-bcbcbcbcbcbc', 'engineering_student', 'AP', 'Engineering');
insert into public.college_comparisons (id, family_id, student_id, title, eapcet_rank, preferred_branches, created_by)
  values ('bcbcbcbc-0000-0000-0000-000000000001', 'bcbcbcbc-bcbc-bcbc-bcbc-bcbcbcbcbcbc', 'bbbb9999-0000-0000-0000-000000000001', 'Shared comparison', 1, array['CSE'], 'bbbb9999-0000-0000-0000-000000000001');
insert into public.scholarship_records (id, family_id, student_id, name, provider, source_type, verification_status, created_by)
  values ('bcbcbcbc-0000-0000-0000-000000000001', 'bcbcbcbc-bcbc-bcbc-bcbc-bcbcbcbcbcbc', 'bbbb9999-0000-0000-0000-000000000001', 'Private scholarship record', 'Provider', 'user_provided', 'unverified', 'bbbb9999-0000-0000-0000-000000000001');

set local role authenticated;
set local request.jwt.claim.sub = 'bbbb9999-0000-0000-0000-000000000002';
select is_empty($$select id from public.college_comparisons$$, 'parent cannot read comparisons before consent');
select is_empty($$select id from public.scholarship_records$$, 'parent cannot read scholarships before consent');
set local request.jwt.claim.sub = 'bbbb9999-0000-0000-0000-000000000001';
select results_eq(
  $$insert into public.family_sharing_preferences (family_id, student_id, college_comparisons_shared)
    values ('bcbcbcbc-bcbc-bcbc-bcbc-bcbcbcbcbcbc', 'bbbb9999-0000-0000-0000-000000000001', true)
    returning college_comparisons_shared::text$$, array['true'], 'student can explicitly share one category');
set local request.jwt.claim.sub = 'bbbb9999-0000-0000-0000-000000000002';
select results_eq($$select id::text from public.college_comparisons$$, array['bcbcbcbc-0000-0000-0000-000000000001'], 'parent can read only the shared comparison category');
select is_empty($$select id from public.scholarship_records$$, 'parent still cannot read unshared scholarship progress');
set local request.jwt.claim.sub = 'bbbb9999-0000-0000-0000-000000000001';
select results_eq(
  $$update public.family_sharing_preferences set college_comparisons_shared = false where family_id = 'bcbcbcbc-bcbc-bcbc-bcbc-bcbcbcbcbcbc' returning college_comparisons_shared::text$$,
  array['false'], 'student can revoke sharing');
set local request.jwt.claim.sub = 'bbbb9999-0000-0000-0000-000000000002';
select is_empty($$select id from public.college_comparisons$$, 'revocation blocks future parent reads');
set local request.jwt.claim.sub = 'bbbb9999-0000-0000-0000-000000000003';
select is_empty($$select family_id from public.family_sharing_preferences$$, 'unrelated parent cannot read sharing settings');
select * from finish();
rollback;
