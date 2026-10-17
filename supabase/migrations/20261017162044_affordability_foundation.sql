-- Phase 4: exact-money affordability planning.
-- Existing family ownership and RLS policies remain in force.

-- Existing numeric(14,2) values represent rupees. Convert them to integer paise
-- before changing the column type so no floating-point arithmetic is introduced.
alter table public.family_budgets
  rename column planned_family_contribution to annual_family_contribution_paise;
alter table public.family_budgets
  rename column available_education_funds to confirmed_available_funds_paise;
alter table public.expenses rename column amount to amount_paise;

alter table public.family_budgets
  alter column annual_family_contribution_paise drop default,
  alter column confirmed_available_funds_paise drop default;
alter table public.expenses
  alter column amount_paise drop default;

alter table public.family_budgets
  alter column annual_family_contribution_paise type bigint
    using round(annual_family_contribution_paise * 100)::bigint,
  alter column confirmed_available_funds_paise type bigint
    using round(confirmed_available_funds_paise * 100)::bigint;
alter table public.expenses
  alter column amount_paise type bigint
    using round(amount_paise * 100)::bigint;

alter table public.family_budgets
  alter column annual_family_contribution_paise set default 0,
  alter column confirmed_available_funds_paise set default 0;
alter table public.expenses
  alter column amount_paise set default 0;

alter table public.family_budgets
  add column monthly_family_contribution_paise bigint not null default 0,
  add column plan_duration_years smallint not null default 4;

alter table public.expenses
  add column plan_year smallint not null default 1,
  add column annual_increase_bps integer not null default 0;

alter table public.family_budgets
  add constraint family_budgets_annual_contribution_nonnegative
    check (annual_family_contribution_paise >= 0),
  add constraint family_budgets_monthly_contribution_nonnegative
    check (monthly_family_contribution_paise >= 0),
  add constraint family_budgets_confirmed_funds_nonnegative
    check (confirmed_available_funds_paise >= 0),
  add constraint family_budgets_duration_valid
    check (plan_duration_years between 1 and 8),
  add constraint family_budgets_contribution_inputs_consistent
    check (
      monthly_family_contribution_paise = 0
      or annual_family_contribution_paise = 0
      or annual_family_contribution_paise = monthly_family_contribution_paise * 12
    );

alter table public.expenses
  add constraint expenses_amount_paise_nonnegative check (amount_paise >= 0),
  add constraint expenses_plan_year_valid check (plan_year between 1 and 8),
  add constraint expenses_annual_increase_valid check (annual_increase_bps between 0 and 10000);

-- One active affordability plan per family prevents contradictory budget rows.
create unique index family_budgets_one_plan_per_family_idx
  on public.family_budgets (family_id);

-- One estimate per category, plan year, and optional student. The normalized
-- expression treats case and surrounding whitespace as the same category.
create unique index expenses_one_category_per_year_idx
  on public.expenses (
    family_id,
    plan_year,
    lower(btrim(category)),
    coalesce(student_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

comment on column public.family_budgets.monthly_family_contribution_paise is
  'Expected future monthly education contribution, in integer paise; not money available now.';
comment on column public.family_budgets.annual_family_contribution_paise is
  'Expected future annual education contribution, in integer paise; not money available now.';
comment on column public.family_budgets.confirmed_available_funds_paise is
  'Confirmed education funds available now, in integer paise; never include expected future contributions here.';
comment on column public.family_budgets.plan_duration_years is
  'Number of education-plan years used by affordability calculations.';
comment on column public.expenses.amount_paise is
  'User-entered estimate or committed/actual amount, in integer paise.';
comment on column public.expenses.annual_increase_bps is
  'Annual cost increase in basis points: 100 bps equals 1 percent.';
