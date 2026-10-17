-- Release hardening: reject email-less Auth identities during invitation acceptance.
-- In PostgreSQL, NULL <> value is NULL, not true; use IS DISTINCT FROM.

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

  select lower(email) into v_email
  from auth.users
  where id = auth.uid();
  if v_email is null or v_email = '' then
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
  if v_invitation.recipient_email is distinct from v_email then
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
