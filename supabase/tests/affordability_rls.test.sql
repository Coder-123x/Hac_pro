-- Run with: supabase test db --local supabase/tests/affordability_rls.test.sql
begin;
select plan(9);

insert into auth.users (id, email)
values
  ('66666666-6666-6666-6666-666666666666', 'budget-parent-a@example.test'),
  ('77777777-7777-7777-7777-777777777777', 'budget-student-a@example.test'),
  ('88888888-8888-8888-8888-888888888888', 'budget-parent-b@example.test');

insert into public.families (id, name, created_by)
values
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Budget Family A', '66666666-6666-6666-6666-666666666666'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Budget Family B', '88888888-8888-8888-8888-888888888888');

insert into public.family_members (family_id, user_id, role, status)
values
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '66666666-6666-6666-6666-666666666666', 'parent', 'active'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '77777777-7777-7777-7777-777777777777', 'student', 'active'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '88888888-8888-8888-8888-888888888888', 'parent', 'active');

insert into public.family_budgets (
  family_id, name, period_start, period_end, monthly_family_contribution_paise,
  annual_family_contribution_paise, confirmed_available_funds_paise, plan_duration_years, created_by
) values (
  'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Budget plan', '2026-01-01', '2029-12-31',
  100000, 0, 500000, 4, '66666666-6666-6666-6666-666666666666'
);

set local role authenticated;
set local request.jwt.claim.sub = '66666666-6666-6666-6666-666666666666';
select results_eq(
  $$insert into public.expenses (
    family_id, category, amount_paise, expense_period, plan_year,
    annual_increase_bps, status, description, created_by
  ) values (
    'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Tuition', 100000, '2026-01-01', 1,
    500, 'estimated', 'User-entered estimate', '66666666-6666-6666-6666-666666666666'
  ) returning amount_paise::text$$,
  array['100000'],
  'a family parent can add an estimate to their family'
);
select results_eq(
  $$select category from public.expenses where family_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'$$,
  array['Tuition'],
  'the owning parent can read the estimate'
);
select throws_ok(
  $$insert into public.expenses (
    family_id, category, amount_paise, expense_period, plan_year,
    annual_increase_bps, status, description, created_by
  ) values (
    'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Student edit', 1, '2026-01-01', 1,
    0, 'estimated', '', '77777777-7777-7777-7777-777777777777'
  )$$,
  '42501', null,
  'a student cannot create an expense estimate'
);

set local request.jwt.claim.sub = '77777777-7777-7777-7777-777777777777';
select results_eq(
  $$select category from public.expenses where family_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'$$,
  array['Tuition'],
  'a linked student can read shared estimates'
);

set local request.jwt.claim.sub = '88888888-8888-8888-8888-888888888888';
select is_empty(
  $$select id from public.expenses where family_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'$$,
  'an unrelated parent cannot read estimates'
);
select is_empty(
  $$update public.expenses set amount_paise = 2
    where family_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc' returning id$$,
  'an unrelated parent cannot update estimates'
);
select is_empty(
  $$delete from public.expenses where family_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc' returning id$$,
  'an unrelated parent cannot delete estimates'
);

set local request.jwt.claim.sub = '66666666-6666-6666-6666-666666666666';
select throws_ok(
  $$insert into public.expenses (
    family_id, category, amount_paise, expense_period, plan_year,
    annual_increase_bps, status, description, created_by
  ) values (
    'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Tuition', 200000, '2026-01-01', 1,
    500, 'estimated', 'Duplicate estimate', '66666666-6666-6666-6666-666666666666'
  )$$,
  '23505', null,
  'a family cannot add a duplicate category for the same plan year'
);
select throws_ok(
  $$update public.family_budgets
    set monthly_family_contribution_paise = 100,
        annual_family_contribution_paise = 1
    where family_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'$$,
  '23514', null,
  'contradictory monthly and annual contributions are rejected'
);

select * from finish();
rollback;
