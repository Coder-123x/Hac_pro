-- Run with: supabase test db --local supabase/tests/scholarship_navigator_rls.test.sql
begin;
select plan(7);
insert into auth.users (id, email) values
  ('aaaa9999-0000-0000-0000-000000000001', 'scholarship-student@example.test'),
  ('aaaa9999-0000-0000-0000-000000000002', 'scholarship-parent@example.test'),
  ('aaaa9999-0000-0000-0000-000000000003', 'scholarship-outsider@example.test');
insert into public.families (id, name, created_by) values
  ('abababab-abab-abab-abab-abababababab', 'Scholarship Family A', 'aaaa9999-0000-0000-0000-000000000002'),
  ('cdcdcdcd-cdcd-cdcd-cdcd-cdcdcdcdcdcd', 'Scholarship Family B', 'aaaa9999-0000-0000-0000-000000000003');
insert into public.family_members (family_id, user_id, role, status) values
  ('abababab-abab-abab-abab-abababababab', 'aaaa9999-0000-0000-0000-000000000001', 'student', 'active'),
  ('abababab-abab-abab-abab-abababababab', 'aaaa9999-0000-0000-0000-000000000002', 'parent', 'active'),
  ('cdcdcdcd-cdcd-cdcd-cdcd-cdcdcdcdcdcd', 'aaaa9999-0000-0000-0000-000000000003', 'parent', 'active');
set local role authenticated;
set local request.jwt.claim.sub = 'aaaa9999-0000-0000-0000-000000000001';
select results_eq(
  $$insert into public.scholarship_records (family_id, student_id, name, provider, source_type, verification_status, created_by)
    values ('abababab-abab-abab-abab-abababababab', 'aaaa9999-0000-0000-0000-000000000001', 'Manual aid', 'Provider', 'user_provided', 'unverified', 'aaaa9999-0000-0000-0000-000000000001')
    returning name$$, array['Manual aid'], 'a student can create a scholarship record');
insert into public.scholarship_records (id, family_id, student_id, name, provider, source_type, verification_status, created_by)
  values ('abababab-0000-0000-0000-000000000001', 'abababab-abab-abab-abab-abababababab', 'aaaa9999-0000-0000-0000-000000000001', 'Stored aid', 'Provider', 'user_provided', 'unverified', 'aaaa9999-0000-0000-0000-000000000001');
select results_eq(
  $$insert into public.scholarship_applications (scholarship_id, family_id, student_id, status, created_by)
    values ('abababab-0000-0000-0000-000000000001', 'abababab-abab-abab-abab-abababababab', 'aaaa9999-0000-0000-0000-000000000001', 'saved', 'aaaa9999-0000-0000-0000-000000000001')
    returning status$$, array['saved'], 'a student can track their scholarship');
select throws_ok(
  $$insert into public.scholarship_records (family_id, student_id, name, provider, source_type, verification_status, created_by)
    values ('cdcdcdcd-cdcd-cdcd-cdcd-cdcdcdcdcdcd', 'aaaa9999-0000-0000-0000-000000000001', 'Cross-family', 'Provider', 'user_provided', 'unverified', 'aaaa9999-0000-0000-0000-000000000001')$$,
  '42501', null, 'a student cannot create a record in another family');
set local request.jwt.claim.sub = 'aaaa9999-0000-0000-0000-000000000002';
select is_empty($$select id from public.scholarship_records$$, 'a parent cannot read an unshared scholarship record');
select is_empty($$select id from public.scholarship_applications$$, 'a parent cannot read an unshared application');
set local request.jwt.claim.sub = 'aaaa9999-0000-0000-0000-000000000003';
select is_empty($$select id from public.scholarship_records$$, 'an unrelated parent cannot read records');
select is_empty($$delete from public.scholarship_applications where family_id = 'abababab-abab-abab-abab-abababababab' returning id$$, 'an unrelated parent cannot delete applications');
select * from finish();
rollback;
