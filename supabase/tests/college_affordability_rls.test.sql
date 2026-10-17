-- Run with: supabase test db --local supabase/tests/college_affordability_rls.test.sql
begin;
select plan(8);

insert into auth.users (id, email) values
  ('99999999-0000-0000-0000-000000000001', 'college-student-a@example.test'),
  ('99999999-0000-0000-0000-000000000002', 'college-parent-a@example.test'),
  ('99999999-0000-0000-0000-000000000003', 'college-parent-b@example.test');
insert into public.families (id, name, created_by) values
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'College Family A', '99999999-0000-0000-0000-000000000002'),
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'College Family B', '99999999-0000-0000-0000-000000000003');
insert into public.family_members (family_id, user_id, role, status) values
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '99999999-0000-0000-0000-000000000001', 'student', 'active'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '99999999-0000-0000-0000-000000000002', 'parent', 'active'),
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', '99999999-0000-0000-0000-000000000003', 'parent', 'active');

set local role authenticated;
set local request.jwt.claim.sub = '99999999-0000-0000-0000-000000000001';
select results_eq(
  $$insert into public.college_comparisons (family_id, student_id, title, eapcet_rank, preferred_branches, created_by)
    values ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '99999999-0000-0000-0000-000000000001', 'A comparison', 12000, array['CSE'], '99999999-0000-0000-0000-000000000001')
    returning title$$,
  array['A comparison'], 'a student can create a comparison for their family'
);
select throws_ok(
  $$insert into public.college_comparisons (family_id, student_id, title, eapcet_rank, preferred_branches, created_by)
    values ('ffffffff-ffff-ffff-ffff-ffffffffffff', '99999999-0000-0000-0000-000000000001', 'Cross-family', 1, array['CSE'], '99999999-0000-0000-0000-000000000001')$$,
  '42501', null, 'a student cannot create a comparison in another family'
);
select throws_ok(
  $$update public.college_comparisons set family_id = 'ffffffff-ffff-ffff-ffff-ffffffffffff'
    where family_id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee' returning id$$,
  'P0001', 'A record cannot be moved to another family',
  'a student cannot move a comparison to another family'
);

insert into public.college_comparisons (id, family_id, student_id, title, eapcet_rank, preferred_branches, created_by)
  values ('eeeeeeee-0000-0000-0000-000000000001', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '99999999-0000-0000-0000-000000000001', 'Stored comparison', 12000, array['CSE'], '99999999-0000-0000-0000-000000000001');
select results_eq(
  $$insert into public.college_comparison_options (comparison_id, family_id, college_name, branch_name, data_status, annual_tuition_paise, annual_hostel_living_paise, created_by)
    values ('eeeeeeee-0000-0000-0000-000000000001', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Manual college', 'CSE', 'estimate', 200000, 100000, '99999999-0000-0000-0000-000000000001')
    returning college_name$$,
  array['Manual college'], 'a student can add an option to their comparison'
);
set local request.jwt.claim.sub = '99999999-0000-0000-0000-000000000002';
select is_empty($$select id from public.college_comparisons$$, 'a parent cannot read an unshared student comparison');
select is_empty($$select id from public.college_comparison_options$$, 'a parent cannot read options for an unshared comparison');
set local request.jwt.claim.sub = '99999999-0000-0000-0000-000000000003';
select is_empty($$select id from public.college_comparisons$$, 'an unrelated parent cannot read comparisons');
select is_empty($$delete from public.college_comparison_options where family_id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee' returning id$$, 'an unrelated parent cannot delete options');

select * from finish();
rollback;
