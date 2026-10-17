-- Run with: supabase test db --local supabase/tests/family_foundation_rls.test.sql
-- Fixtures are inserted before switching to the API roles, then rolled back.
begin;
select plan(26);

insert into auth.users (id, email)
values
  ('11111111-1111-1111-1111-111111111111', 'parent-a@example.test'),
  ('22222222-2222-2222-2222-222222222222', 'student-a@example.test'),
  ('33333333-3333-3333-3333-333333333333', 'outsider@example.test'),
  ('44444444-4444-4444-4444-444444444444', 'parent-b@example.test'),
  ('55555555-5555-5555-5555-555555555555', 'invitee@example.test'),
  ('66666666-5555-5555-5555-555555555555', null);

insert into public.families (id, name, created_by)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Family A', '11111111-1111-1111-1111-111111111111'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Family B', '44444444-4444-4444-4444-444444444444');

insert into public.family_members (family_id, user_id, role, status)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'parent', 'active'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'student', 'active'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '44444444-4444-4444-4444-444444444444', 'parent', 'active');

insert into public.student_profiles (
  user_id, family_id, education_stage, state_code, career_goals, is_shared_with_parents
) values (
  '22222222-2222-2222-2222-222222222222',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'entrance_preparation', 'AP', 'Engineering', false
);

insert into public.family_budgets (
  id, family_id, name, period_start, period_end, annual_family_contribution_paise,
  confirmed_available_funds_paise, created_by
) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'A budget', '2026-01-01', '2026-12-31', 1000000, 500000, '11111111-1111-1111-1111-111111111111'),
  ('bbbbbbbb-0000-0000-0000-000000000001', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   'B budget', '2026-01-01', '2026-12-31', 900000, 400000, '44444444-4444-4444-4444-444444444444');

insert into public.family_invitations (
  id, family_id, invited_by, recipient_email, role, token_digest, expires_at, created_at
) values
  ('aaaaaaaa-0000-0000-0000-000000000010', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   '11111111-1111-1111-1111-111111111111', 'invitee@example.test', 'student',
   extensions.digest('valid-token', 'sha256'), now() + interval '1 day', now()),
  ('aaaaaaaa-0000-0000-0000-000000000011', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   '11111111-1111-1111-1111-111111111111', 'invitee@example.test', 'student',
   extensions.digest('expired-token', 'sha256'), now() - interval '1 day', now() - interval '2 days'),
  ('aaaaaaaa-0000-0000-0000-000000000012', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   '11111111-1111-1111-1111-111111111111', 'null-email@example.test', 'student',
   extensions.digest('null-email-token', 'sha256'), now() + interval '1 day', now());

select ok(
  not has_function_privilege('anon', 'public.create_family_workspace(text)', 'execute'),
  'anon cannot execute create_family_workspace'
);
select ok(
  not has_function_privilege('anon', 'public.accept_family_invitation(text)', 'execute'),
  'anon cannot execute accept_family_invitation'
);

set local role authenticated;
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select results_eq(
  $$select user_id::text from public.student_profiles$$,
  array['22222222-2222-2222-2222-222222222222'],
  'a student reads their own unshared profile'
);
select results_eq(
  $$select id::text from public.family_budgets where family_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'$$,
  array['aaaaaaaa-0000-0000-0000-000000000001'],
  'a student can read their linked family budget'
);
select is_empty(
  $$select id from public.family_budgets where family_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'$$,
  'a student cannot read an unrelated family budget'
);
select is_empty(
  $$update public.family_budgets set name = 'student edit'
    where id = 'aaaaaaaa-0000-0000-0000-000000000001' returning id$$,
  'a student cannot edit a family budget'
);
select is_empty(
  $$select id from public.family_invitations$$,
  'a student cannot read invitation metadata'
);
select throws_ok(
  $$select public.create_family_invitation(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'new@example.test', 'student', now() + interval '1 day'
  )$$,
  'P0001', 'Only an active parent can invite family members',
  'a student cannot create an invitation'
);

set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select is_empty(
  $$select user_id from public.student_profiles where user_id = '22222222-2222-2222-2222-222222222222'$$,
  'a parent cannot read an unshared student profile'
);

set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select results_eq(
  $$update public.student_profiles set is_shared_with_parents = true
    where user_id = '22222222-2222-2222-2222-222222222222'
    returning is_shared_with_parents::text$$,
  array['true'],
  'a student can explicitly share their profile'
);

set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select results_eq(
  $$select user_id::text from public.student_profiles$$,
  array['22222222-2222-2222-2222-222222222222'],
  'a linked parent can read an explicitly shared student profile'
);
select results_eq(
  $$update public.family_budgets set annual_family_contribution_paise = 1200000
    where id = 'aaaaaaaa-0000-0000-0000-000000000001'
    returning annual_family_contribution_paise::text$$,
  array['1200000'],
  'a linked parent can update their family budget'
);
select throws_ok(
  $$update public.family_budgets
    set family_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
    where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
  'P0001', 'A record cannot be moved to another family',
  'a parent cannot move a budget to another family'
);
select ok(
  not has_table_privilege('authenticated', 'public.family_members', 'UPDATE'),
  'authenticated users have no direct UPDATE privilege on family membership'
);
select results_eq(
  $$select role from public.family_members
    where family_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
      and user_id = '22222222-2222-2222-2222-222222222222'$$,
  array['student'],
  'the denied role change leaves the student role intact'
);
select throws_ok(
  $$select token_digest from public.family_invitations$$,
  '42501', null,
  'a parent cannot read invitation digests'
);

set local request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
select is_empty(
  $$select user_id from public.student_profiles$$,
  'a parent from another family cannot read the shared profile'
);
select is_empty(
  $$update public.family_budgets set name = 'other family edit'
    where id = 'aaaaaaaa-0000-0000-0000-000000000001' returning id$$,
  'a parent from another family cannot edit the budget'
);

set local request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select is_empty(
  $$select id from public.family_budgets$$,
  'an unrelated user cannot read either family budget'
);
select throws_ok(
  $$insert into public.family_budgets (
    family_id, name, period_start, period_end, annual_family_contribution_paise,
    confirmed_available_funds_paise, created_by
  ) values (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'unauthorized', '2026-01-01', '2026-12-31', 1, 1,
    '33333333-3333-3333-3333-333333333333'
  )$$,
  '42501', null,
  'an unrelated user cannot create a budget in another family'
);
select throws_ok(
  $$select public.accept_family_invitation('valid-token')$$,
  'P0001', 'Invitation was issued to a different email address',
  'a user who is not the intended recipient cannot accept an invitation'
);

set local request.jwt.claim.sub = '66666666-5555-5555-5555-555555555555';
select throws_ok(
  $$select public.accept_family_invitation('null-email-token')$$,
  'P0001', 'An authenticated email address is required',
  'an authenticated account without an email cannot accept an invitation'
);

set local request.jwt.claim.sub = '55555555-5555-5555-5555-555555555555';
select throws_ok(
  $$select public.accept_family_invitation('expired-token')$$,
  'P0001', 'Invitation has expired',
  'an expired invitation cannot be accepted'
);
select results_eq(
  $$select public.accept_family_invitation('valid-token')::text$$,
  array['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'],
  'the intended recipient can accept a valid invitation once'
);
select throws_ok(
  $$select public.accept_family_invitation('valid-token')$$,
  'P0001', 'Invitation has already been used or revoked',
  'a used invitation cannot be accepted twice'
);
select results_eq(
  $$select role from public.family_members
    where family_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
      and user_id = '55555555-5555-5555-5555-555555555555'$$,
  array['student'],
  'acceptance creates only the invited membership role'
);

select * from finish();
rollback;
