-- Phase 2: family workspace, financial planning, and access-control foundation.
-- This migration is intentionally local-only until applied through the Supabase CLI
-- or dashboard by a project administrator.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 120),
  preferred_language text not null default 'en' check (preferred_language in ('en', 'te')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.family_members (
  family_id uuid not null references public.families (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('student', 'parent')),
  status text not null default 'active' check (status in ('active', 'inactive', 'removed')),
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (family_id, user_id)
);

create table public.family_invitations (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  invited_by uuid not null references auth.users (id) on delete restrict,
  recipient_email text not null check (
    recipient_email = lower(recipient_email)
    and char_length(recipient_email) between 3 and 320
  ),
  role text not null check (role in ('student', 'parent')),
  token_digest bytea not null unique check (octet_length(token_digest) = 32),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at > created_at),
  check (accepted_at is null or accepted_by is not null),
  check (not (accepted_at is not null and revoked_at is not null))
);

create table public.student_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  family_id uuid not null references public.families (id) on delete cascade,
  education_stage text not null check (education_stage in (
    'secondary', 'higher_secondary', 'entrance_preparation', 'engineering_student', 'graduate'
  )),
  state_code text not null default 'AP' check (state_code ~ '^[A-Z]{2}$'),
  entrance_exam text check (entrance_exam is null or char_length(entrance_exam) <= 80),
  entrance_rank integer check (entrance_rank is null or entrance_rank > 0),
  preferred_branches text[] not null default '{}',
  career_goals text not null default '' check (char_length(career_goals) <= 4000),
  is_shared_with_parents boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, family_id),
  check (cardinality(preferred_branches) <= 20),
  check (entrance_rank is null or entrance_exam is not null)
);

create table public.family_budgets (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  period_start date not null,
  period_end date not null,
  planned_family_contribution numeric(14, 2) not null default 0 check (planned_family_contribution >= 0),
  available_education_funds numeric(14, 2) not null default 0 check (available_education_funds >= 0),
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end >= period_start)
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  student_id uuid,
  category text not null check (char_length(btrim(category)) between 1 and 80),
  amount numeric(14, 2) not null check (amount >= 0),
  expense_period date not null,
  status text not null default 'estimated' check (status in ('estimated', 'committed', 'actual')),
  description text not null default '' check (char_length(description) <= 2000),
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (student_id, family_id)
    references public.student_profiles (user_id, family_id)
    on delete set null (student_id)
);

create index family_members_user_active_idx
  on public.family_members (user_id, family_id) where status = 'active';
create index family_invitations_family_pending_idx
  on public.family_invitations (family_id, expires_at) where accepted_at is null and revoked_at is null;
create index student_profiles_family_idx on public.student_profiles (family_id);
create index family_budgets_family_period_idx on public.family_budgets (family_id, period_start, period_end);
create index expenses_family_period_idx on public.expenses (family_id, expense_period desc);
create index expenses_student_idx on public.expenses (student_id) where student_id is not null;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.prevent_family_creator_change()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if new.created_by is distinct from old.created_by then
    raise exception 'A family creator cannot be changed';
  end if;
  return new;
end;
$$;

create or replace function public.prevent_student_profile_identity_change()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if new.user_id is distinct from old.user_id or new.family_id is distinct from old.family_id then
    raise exception 'A student profile identity cannot be changed';
  end if;
  return new;
end;
$$;

create or replace function public.prevent_membership_identity_change()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if new.family_id is distinct from old.family_id or new.user_id is distinct from old.user_id then
    raise exception 'A family membership identity cannot be changed';
  end if;
  return new;
end;
$$;

create or replace function public.prevent_record_creator_change()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if new.created_by is distinct from old.created_by then
    raise exception 'A record creator cannot be changed';
  end if;
  return new;
end;
$$;

create or replace function public.prevent_family_scope_change()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if new.family_id is distinct from old.family_id then
    raise exception 'A record cannot be moved to another family';
  end if;
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger families_set_updated_at before update on public.families
  for each row execute function public.set_updated_at();
create trigger families_prevent_creator_change before update on public.families
  for each row execute function public.prevent_family_creator_change();
create trigger family_members_set_updated_at before update on public.family_members
  for each row execute function public.set_updated_at();
create trigger family_members_prevent_identity_change before update on public.family_members
  for each row execute function public.prevent_membership_identity_change();
create trigger family_invitations_set_updated_at before update on public.family_invitations
  for each row execute function public.set_updated_at();
create trigger student_profiles_set_updated_at before update on public.student_profiles
  for each row execute function public.set_updated_at();
create trigger student_profiles_prevent_identity_change before update on public.student_profiles
  for each row execute function public.prevent_student_profile_identity_change();
create trigger family_budgets_set_updated_at before update on public.family_budgets
  for each row execute function public.set_updated_at();
create trigger family_budgets_prevent_creator_change before update on public.family_budgets
  for each row execute function public.prevent_record_creator_change();
create trigger family_budgets_prevent_family_scope_change before update on public.family_budgets
  for each row execute function public.prevent_family_scope_change();
create trigger expenses_set_updated_at before update on public.expenses
  for each row execute function public.set_updated_at();
create trigger expenses_prevent_creator_change before update on public.expenses
  for each row execute function public.prevent_record_creator_change();
create trigger expenses_prevent_family_scope_change before update on public.expenses
  for each row execute function public.prevent_family_scope_change();

-- These SECURITY DEFINER predicates bypass table RLS to avoid recursive policy
-- evaluation. They disclose only whether the current user has a qualifying role.
create or replace function public.is_active_family_member(p_family_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1 from public.family_members
    where family_id = p_family_id
      and user_id = auth.uid()
      and status = 'active'
  );
$$;

create or replace function public.is_active_family_parent(p_family_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1 from public.family_members
    where family_id = p_family_id
      and user_id = auth.uid()
      and role = 'parent'
      and status = 'active'
  );
$$;

create or replace function public.is_active_family_student(p_family_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1 from public.family_members
    where family_id = p_family_id
      and user_id = auth.uid()
      and role = 'student'
      and status = 'active'
  );
$$;

-- Workspace creation atomically creates the initial authorized parent membership.
create or replace function public.create_family_workspace(p_name text)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_family_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required';
  end if;

  insert into public.families (name, created_by)
  values (p_name, auth.uid())
  returning id into v_family_id;

  insert into public.family_members (family_id, user_id, role, status)
  values (v_family_id, auth.uid(), 'parent', 'active');

  return v_family_id;
end;
$$;

-- Returns the raw token exactly once. Only its SHA-256 digest is persisted.
create or replace function public.create_family_invitation(
  p_family_id uuid,
  p_recipient_email text,
  p_role text,
  p_expires_at timestamptz
)
returns table (invitation_id uuid, invitation_token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = pg_catalog, extensions
as $$
declare
  v_token text;
  v_invitation_id uuid;
  v_normalized_email text;
begin
  if not public.is_active_family_parent(p_family_id) then
    raise exception 'Only an active parent can invite family members';
  end if;
  if p_role not in ('student', 'parent') then
    raise exception 'Invalid invitation role';
  end if;
  if p_expires_at <= now() or p_expires_at > now() + interval '30 days' then
    raise exception 'Invitation expiry must be within the next 30 days';
  end if;

  v_normalized_email := lower(btrim(p_recipient_email));
  if char_length(v_normalized_email) not between 3 and 320 then
    raise exception 'A recipient email is required';
  end if;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.family_invitations (
    family_id, invited_by, recipient_email, role, token_digest, expires_at
  ) values (
    p_family_id, auth.uid(), v_normalized_email, p_role,
    extensions.digest(v_token, 'sha256'), p_expires_at
  ) returning id into v_invitation_id;

  return query select v_invitation_id, v_token, p_expires_at;
end;
$$;

-- Acceptance is transactionally locked, recipient-bound, expiry-bound, and single-use.
create or replace function public.accept_family_invitation(p_invitation_token text)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, extensions
as $$
declare
  v_invitation public.family_invitations%rowtype;
  v_email text;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required';
  end if;
  -- Use the current Auth value, not a JWT claim that can be stale after an
  -- email change until the caller refreshes their session.
  select lower(email) into v_email
  from auth.users
  where id = auth.uid();
  if v_email = '' then
    raise exception 'An authenticated email address is required';
  end if;

  select * into v_invitation
  from public.family_invitations
  where token_digest = extensions.digest(p_invitation_token, 'sha256')
  for update;

  if not found then
    raise exception 'Invitation is invalid';
  end if;
  if v_invitation.accepted_at is not null or v_invitation.revoked_at is not null then
    raise exception 'Invitation has already been used or revoked';
  end if;
  if v_invitation.expires_at <= now() then
    raise exception 'Invitation has expired';
  end if;
  if v_invitation.recipient_email <> v_email then
    raise exception 'Invitation was issued to a different email address';
  end if;
  if not exists (
    select 1 from public.family_members
    where family_id = v_invitation.family_id
      and user_id = v_invitation.invited_by
      and role = 'parent'
      and status = 'active'
  ) then
    raise exception 'The invitation issuer is no longer authorized';
  end if;
  if exists (
    select 1 from public.family_members
    where family_id = v_invitation.family_id and user_id = auth.uid()
  ) then
    raise exception 'You are already associated with this family';
  end if;

  insert into public.family_members (family_id, user_id, role, status)
  values (v_invitation.family_id, auth.uid(), v_invitation.role, 'active');

  update public.family_invitations
  set accepted_at = now(), accepted_by = auth.uid()
  where id = v_invitation.id;

  return v_invitation.family_id;
end;
$$;

alter table public.profiles enable row level security;
alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.family_invitations enable row level security;
alter table public.student_profiles enable row level security;
alter table public.family_budgets enable row level security;
alter table public.expenses enable row level security;

-- RLS is a row filter, not a grant. Make the Data API surface explicit.
revoke all on table public.profiles, public.families, public.family_members,
  public.family_invitations, public.student_profiles, public.family_budgets,
  public.expenses from anon, authenticated;
grant select, insert, update, delete on table public.profiles to authenticated;
grant select, update, delete on table public.families to authenticated;
grant select on table public.family_members to authenticated;
-- The digest is only an internal verifier for the acceptance RPC. Parents can
-- list invitation metadata but cannot retrieve or reuse its stored digest.
grant select (id, family_id, invited_by, recipient_email, role, expires_at,
  accepted_at, accepted_by, revoked_at, created_at, updated_at)
  on table public.family_invitations to authenticated;
grant select, insert, update, delete on table public.student_profiles to authenticated;
grant select, insert, update, delete on table public.family_budgets to authenticated;
grant select, insert, update, delete on table public.expenses to authenticated;

create policy "profiles_select_own" on public.profiles for select to authenticated
  using (id = auth.uid());
create policy "profiles_insert_own" on public.profiles for insert to authenticated
  with check (id = auth.uid());
create policy "profiles_update_own" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles_delete_own" on public.profiles for delete to authenticated
  using (id = auth.uid());

create policy "families_select_members" on public.families for select to authenticated
  using (public.is_active_family_member(id));
-- A family and its initial membership must be created atomically by the RPC.
create policy "families_insert_via_rpc" on public.families for insert to authenticated
  with check (false);
create policy "families_update_parents" on public.families for update to authenticated
  using (public.is_active_family_parent(id)) with check (public.is_active_family_parent(id));
create policy "families_delete_parents" on public.families for delete to authenticated
  using (public.is_active_family_parent(id));

create policy "family_members_select_self_or_parent" on public.family_members for select to authenticated
  using (user_id = auth.uid() or public.is_active_family_parent(family_id));
-- Membership is established only by the workspace and invitation RPCs.
create policy "family_members_insert_via_rpc" on public.family_members for insert to authenticated
  with check (false);
-- A future membership-management RPC can add narrowly audited role/status changes.
create policy "family_members_update_denied" on public.family_members for update to authenticated
  using (false) with check (false);
create policy "family_members_delete_denied" on public.family_members for delete to authenticated
  using (false);

-- Invites are created and accepted only through the hardened RPCs above.
create policy "family_invitations_select_parents" on public.family_invitations for select to authenticated
  using (public.is_active_family_parent(family_id));
create policy "family_invitations_insert_denied" on public.family_invitations for insert to authenticated
  with check (false);
create policy "family_invitations_update_denied" on public.family_invitations for update to authenticated
  using (false) with check (false);
create policy "family_invitations_delete_denied" on public.family_invitations for delete to authenticated
  using (false);

create policy "student_profiles_select_owner_or_shared_parent" on public.student_profiles for select to authenticated
  using (
    user_id = auth.uid()
    or (is_shared_with_parents and public.is_active_family_parent(family_id))
  );
create policy "student_profiles_insert_own_student_membership" on public.student_profiles for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.is_active_family_student(family_id)
  );
create policy "student_profiles_update_own" on public.student_profiles for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "student_profiles_delete_own" on public.student_profiles for delete to authenticated
  using (user_id = auth.uid());

create policy "family_budgets_select_members" on public.family_budgets for select to authenticated
  using (public.is_active_family_member(family_id));
create policy "family_budgets_insert_parents" on public.family_budgets for insert to authenticated
  with check (public.is_active_family_parent(family_id) and created_by = auth.uid());
create policy "family_budgets_update_parents" on public.family_budgets for update to authenticated
  using (public.is_active_family_parent(family_id))
  with check (public.is_active_family_parent(family_id));
create policy "family_budgets_delete_parents" on public.family_budgets for delete to authenticated
  using (public.is_active_family_parent(family_id));

create policy "expenses_select_members" on public.expenses for select to authenticated
  using (public.is_active_family_member(family_id));
create policy "expenses_insert_parents" on public.expenses for insert to authenticated
  with check (public.is_active_family_parent(family_id) and created_by = auth.uid());
create policy "expenses_update_parents" on public.expenses for update to authenticated
  using (public.is_active_family_parent(family_id))
  with check (public.is_active_family_parent(family_id));
create policy "expenses_delete_parents" on public.expenses for delete to authenticated
  using (public.is_active_family_parent(family_id));

revoke all on function public.is_active_family_member(uuid) from public;
revoke all on function public.is_active_family_parent(uuid) from public;
revoke all on function public.is_active_family_student(uuid) from public;
revoke all on function public.create_family_workspace(text) from public;
revoke all on function public.create_family_invitation(uuid, text, text, timestamptz) from public;
revoke all on function public.accept_family_invitation(text) from public;
revoke all on function public.is_active_family_member(uuid) from anon;
revoke all on function public.is_active_family_parent(uuid) from anon;
revoke all on function public.is_active_family_student(uuid) from anon;
revoke all on function public.create_family_workspace(text) from anon;
revoke all on function public.create_family_invitation(uuid, text, text, timestamptz) from anon;
revoke all on function public.accept_family_invitation(text) from anon;

grant execute on function public.is_active_family_member(uuid) to authenticated;
grant execute on function public.is_active_family_parent(uuid) to authenticated;
grant execute on function public.is_active_family_student(uuid) to authenticated;
grant execute on function public.create_family_workspace(text) to authenticated;
grant execute on function public.create_family_invitation(uuid, text, text, timestamptz) to authenticated;
grant execute on function public.accept_family_invitation(text) to authenticated;
