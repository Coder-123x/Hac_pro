-- Reviewer-only import preview and atomic publication workflow.
-- Direct catalogue writes are removed from the client role; all writes flow
-- through the functions below, which check the private reviewer allowlist.

alter table public.education_source_batches
  add column if not exists preview_summary jsonb not null default '{}'::jsonb;

revoke insert, update, delete on table public.education_source_batches,
  public.education_institutions,
  public.education_institution_source_ids,
  public.education_branches,
  public.education_branch_source_ids,
  public.education_cutoffs,
  public.education_import_quarantine,
  public.education_catalogue_audit_events from authenticated;

create or replace function public.education_preview_cutoff_import(
  p_source_system text,
  p_source_title text,
  p_source_url text,
  p_artifact_sha256 text,
  p_academic_year smallint,
  p_academic_period text,
  p_retrieval_date date,
  p_extraction_method text,
  p_source_row_count integer,
  p_rows jsonb,
  p_rejected_rows jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  batch_id uuid;
  row jsonb;
  input_index bigint;
  rejected jsonb;
  seen_row jsonb;
  existing_cutoff public.education_cutoffs%rowtype;
  existing_batch public.education_source_batches%rowtype;
  v_institution_id uuid;
  v_branch_id uuid;
  row_number integer;
  source_sno integer;
  cutoff_rank integer;
  v_cutoff_year smallint;
  source_key text;
  institution_code text;
  branch_code text;
  v_admission_region text;
  v_cutoff_category text;
  v_counselling_round text;
  source_url text;
  reason text;
  same_row boolean;
  accepted_count integer := 0;
  rejected_count integer := 0;
  replay_count integer := 0;
  conflict_count integer := 0;
  quarantined_count integer := 0;
begin
  if not public.is_education_catalogue_reviewer() then
    raise exception 'Education catalogue reviewer authorization required' using errcode = '42501';
  end if;
  if p_source_system is null or btrim(p_source_system) = '' or p_source_system !~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$' then
    raise exception 'Invalid source system' using errcode = '22023';
  end if;
  if p_source_url is null or p_source_url !~ '^https://' then
    raise exception 'Source URL must use HTTPS' using errcode = '22023';
  end if;
  if p_artifact_sha256 is null or p_artifact_sha256 !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid artifact SHA-256' using errcode = '22023';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Rows must be a JSON array' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('education_catalogue_artifact:' || p_source_system || ':' || p_artifact_sha256));
  select * into existing_batch
  from public.education_source_batches
  where source_system = p_source_system and artifact_sha256 = p_artifact_sha256;
  if found then
    return jsonb_build_object(
      'batchId', existing_batch.id, 'status', existing_batch.status,
      'accepted', coalesce(existing_batch.preview_summary->>'accepted', '0')::integer,
      'rejected', coalesce(existing_batch.preview_summary->>'rejected', '0')::integer,
      'duplicateReplay', coalesce(existing_batch.preview_summary->>'duplicateReplay', '0')::integer,
      'conflicts', coalesce(existing_batch.preview_summary->>'conflicts', '0')::integer,
      'quarantined', coalesce(existing_batch.preview_summary->>'quarantined', '0')::integer,
      'idempotentReplay', true
    );
  end if;

  insert into public.education_source_batches (
    source_system, source_title, source_url, artifact_sha256, academic_year,
    academic_period, retrieval_date, extraction_method, source_row_count,
    record_count, status, preview_summary
  ) values (
    p_source_system, p_source_title, p_source_url, p_artifact_sha256,
    p_academic_year, p_academic_period, p_retrieval_date, p_extraction_method,
    greatest(coalesce(p_source_row_count, 0), 0), 0, 'review_required', '{}'::jsonb
  ) returning id into batch_id;

  for rejected in select value from jsonb_array_elements(coalesce(p_rejected_rows, '[]'::jsonb)) loop
    rejected_count := rejected_count + 1;
    quarantined_count := quarantined_count + 1;
    insert into public.education_import_quarantine (
      source_batch_id, source_row_number, reason_code, details
    ) values (
      batch_id, nullif(rejected->>'rowNumber', '')::integer,
      'parser_rejected', coalesce(rejected->'details', rejected)
    );
  end loop;

  for row, input_index in select value, ordinality from jsonb_array_elements(p_rows) with ordinality loop
    reason := null;
    begin
      if coalesce(row->>'dataStatus', '') <> 'historical' then reason := 'data_status_must_be_historical'; end if;
      if coalesce(row->>'institutionCode', '') !~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,31}$' then reason := 'invalid_institution_code'; end if;
      if coalesce(row->>'branchCode', '') !~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,31}$' then reason := 'invalid_branch_code'; end if;
      if coalesce(row->>'admissionRegion', '') !~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,31}$' then reason := 'invalid_admission_region'; end if;
      if coalesce(row->>'cutoffCategory', '') = '' then reason := 'missing_cutoff_category'; end if;
      if coalesce(row->>'sourceRecordKey', '') !~ '^[a-f0-9]{64}$' then reason := 'invalid_source_record_key'; end if;
      if coalesce(row->>'sourceUrl', '') !~ '^https://' then reason := 'invalid_row_source_url'; end if;
      if coalesce(row->>'lastVerifiedAt', '') !~ '^\d{4}-\d{2}-\d{2}$' then reason := 'invalid_review_date'; end if;
      if coalesce(row->>'cutoffRank', '') !~ '^[0-9]+$' or (row->>'cutoffRank')::integer <= 0 then reason := 'invalid_cutoff_rank'; end if;
      if coalesce(row->>'cutoffYear', '') !~ '^[0-9]+$' or (row->>'cutoffYear')::integer not between 2000 and 2100 then reason := 'invalid_cutoff_year'; end if;
      if coalesce(row->>'sourceRowNumber', '') !~ '^[0-9]+$' or (row->>'sourceRowNumber')::integer <= 0 then reason := 'invalid_source_row_number'; end if;
      if coalesce(row->>'sourceSno', '') !~ '^[0-9]+$' or (row->>'sourceSno')::integer <= 0 then reason := 'invalid_source_sno'; end if;
    exception when others then
      reason := 'malformed_numeric_value';
    end;
    if reason is not null then
      rejected_count := rejected_count + 1;
      quarantined_count := quarantined_count + 1;
      insert into public.education_import_quarantine (source_batch_id, source_row_number, source_record_key, reason_code, details)
      values (batch_id, nullif(row->>'sourceRowNumber', '')::integer, row->>'sourceRecordKey', reason, row);
      continue;
    end if;

    source_key := row->>'sourceRecordKey';
    perform pg_advisory_xact_lock(hashtext('education_catalogue_source:' || source_key));
    row_number := (row->>'sourceRowNumber')::integer;
    source_sno := (row->>'sourceSno')::integer;
    cutoff_rank := (row->>'cutoffRank')::integer;
    v_cutoff_year := (row->>'cutoffYear')::smallint;
    institution_code := row->>'institutionCode';
    branch_code := row->>'branchCode';
    v_admission_region := row->>'admissionRegion';
    v_cutoff_category := row->>'cutoffCategory';
    v_counselling_round := nullif(row->>'counsellingRound', '');
    source_url := row->>'sourceUrl';

    select previous.value into seen_row
    from jsonb_array_elements(p_rows) with ordinality previous(value, ordinality)
    where previous.ordinality < input_index
      and previous.value->>'sourceRecordKey' = source_key
    limit 1;
    if seen_row is not null then
      same_row := (seen_row->>'cutoffRank' = row->>'cutoffRank'
        and seen_row->>'institutionCode' = row->>'institutionCode'
        and seen_row->>'branchCode' = row->>'branchCode'
        and seen_row->>'admissionRegion' = row->>'admissionRegion'
        and seen_row->>'cutoffCategory' = row->>'cutoffCategory'
        and coalesce(seen_row->>'counsellingRound', '') = coalesce(row->>'counsellingRound', '')
        and seen_row->>'cutoffYear' = row->>'cutoffYear');
      if same_row then replay_count := replay_count + 1; reason := 'duplicate_source_record_in_batch';
      else conflict_count := conflict_count + 1; reason := 'conflicting_source_record_in_batch'; end if;
      quarantined_count := quarantined_count + 1;
      insert into public.education_import_quarantine (source_batch_id, source_row_number, source_record_key, reason_code, details)
      values (batch_id, row_number, source_key, reason, row);
      continue;
    end if;
    select source_id.institution_id into v_institution_id
    from public.education_institution_source_ids source_id
    where source_id.source_system = p_source_system
      and source_id.source_institution_code = institution_code
      and source_id.review_status = 'approved';
    if v_institution_id is null then
      conflict_count := conflict_count + 1; quarantined_count := quarantined_count + 1;
      insert into public.education_import_quarantine (source_batch_id, source_row_number, source_record_key, reason_code, details)
      values (batch_id, row_number, source_key, 'unresolved_institution_identity', row);
      continue;
    end if;
    select source_id.branch_id into v_branch_id
    from public.education_branch_source_ids source_id
    where source_id.source_system = p_source_system
      and source_id.source_branch_code = branch_code
      and source_id.review_status = 'approved';
    if v_branch_id is null then
      conflict_count := conflict_count + 1; quarantined_count := quarantined_count + 1;
      insert into public.education_import_quarantine (source_batch_id, source_row_number, source_record_key, reason_code, details)
      values (batch_id, row_number, source_key, 'unresolved_branch_identity', row);
      continue;
    end if;

    select * into existing_cutoff from public.education_cutoffs where source_record_key = source_key;
    if found then
      same_row := existing_cutoff.institution_id = v_institution_id
        and existing_cutoff.branch_id = v_branch_id
        and existing_cutoff.admission_region = v_admission_region
        and existing_cutoff.cutoff_category = v_cutoff_category
        and existing_cutoff.cutoff_rank = cutoff_rank
        and existing_cutoff.academic_year = v_cutoff_year
        and coalesce(existing_cutoff.counselling_round, '') = coalesce(v_counselling_round, '');
      if same_row then replay_count := replay_count + 1; reason := 'duplicate_source_record_replay';
      else conflict_count := conflict_count + 1; reason := 'conflicting_existing_source_key'; end if;
      quarantined_count := quarantined_count + 1;
      insert into public.education_import_quarantine (source_batch_id, source_row_number, source_record_key, reason_code, details)
      values (batch_id, row_number, source_key, reason, row);
      continue;
    end if;

    perform 1 from public.education_cutoffs existing
    where existing.institution_id = v_institution_id and existing.branch_id = v_branch_id
      and existing.admission_region = v_admission_region and existing.cutoff_category = v_cutoff_category
      and existing.academic_year = v_cutoff_year
      and coalesce(existing.counselling_round, '') = coalesce(v_counselling_round, '');
    if found then
      conflict_count := conflict_count + 1; quarantined_count := quarantined_count + 1;
      insert into public.education_import_quarantine (source_batch_id, source_row_number, source_record_key, reason_code, details)
      values (batch_id, row_number, source_key, 'conflicting_business_key', row);
      continue;
    end if;

    insert into public.education_cutoffs (
      institution_id, branch_id, source_batch_id, admission_region,
      cutoff_category, cutoff_rank, academic_year, counselling_round,
      source_row_number, source_sno, source_record_key, source_url,
      data_status, publication_state
    ) values (
      v_institution_id, v_branch_id, batch_id, v_admission_region, v_cutoff_category,
      cutoff_rank, v_cutoff_year, v_counselling_round, row_number, source_sno,
      source_key, source_url, 'historical', 'draft'
    );
    accepted_count := accepted_count + 1;
  end loop;

  update public.education_source_batches
  set record_count = accepted_count,
      preview_summary = jsonb_build_object(
        'accepted', accepted_count, 'rejected', rejected_count,
        'duplicateReplay', replay_count, 'conflicts', conflict_count,
        'quarantined', quarantined_count
      )
  where id = batch_id;

  insert into public.education_catalogue_audit_events (
    source_batch_id, entity_type, entity_id, action, actor_user_id, details
  ) values (
    batch_id, 'source_batch', batch_id, 'preview', auth.uid(),
    jsonb_build_object('accepted', accepted_count, 'rejected', rejected_count,
      'duplicateReplay', replay_count, 'conflicts', conflict_count,
      'quarantined', quarantined_count)
  );
  return jsonb_build_object('batchId', batch_id, 'accepted', accepted_count,
    'rejected', rejected_count, 'duplicateReplay', replay_count,
    'conflicts', conflict_count, 'quarantined', quarantined_count,
    'status', 'review_required');
end;
$$;

create or replace function public.education_catalogue_batch_action(
  p_batch_id uuid,
  p_action text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  current_batch public.education_source_batches%rowtype;
  next_status text;
begin
  if not public.is_education_catalogue_reviewer() then
    raise exception 'Education catalogue reviewer authorization required' using errcode = '42501';
  end if;
  if p_action not in ('approve', 'publish', 'retire') then
    raise exception 'Unsupported catalogue batch action' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtext('education_catalogue_batch:' || p_batch_id::text));
  select * into current_batch from public.education_source_batches where id = p_batch_id for update;
  if not found then raise exception 'Catalogue batch not found' using errcode = 'P0002'; end if;

  if p_action = 'approve' then
    if current_batch.status <> 'review_required' then raise exception 'Only review-required batches can be approved' using errcode = 'P0001'; end if;
    next_status := 'approved';
    update public.education_source_batches set status = next_status, reviewed_by = auth.uid(), reviewed_at = now() where id = p_batch_id;
  elsif p_action = 'publish' then
    if current_batch.status <> 'approved' then raise exception 'Only approved batches can be published' using errcode = 'P0001'; end if;
    next_status := 'published';
    update public.education_source_batches set status = next_status, published_at = now() where id = p_batch_id;
    update public.education_cutoffs set publication_state = 'published' where source_batch_id = p_batch_id and publication_state = 'draft';
  else
    if current_batch.status <> 'published' then raise exception 'Only published batches can be retired' using errcode = 'P0001'; end if;
    next_status := 'retired';
    update public.education_source_batches set status = next_status, retired_at = now() where id = p_batch_id;
    update public.education_cutoffs set publication_state = 'retired' where source_batch_id = p_batch_id and publication_state = 'published';
  end if;

  insert into public.education_catalogue_audit_events (
    source_batch_id, entity_type, entity_id, action, actor_user_id, details
  ) values (
    p_batch_id, 'source_batch', p_batch_id,
    case p_action when 'approve' then 'approve' when 'publish' then 'publish' else 'retire' end,
    auth.uid(), jsonb_build_object('previousStatus', current_batch.status, 'nextStatus', next_status)
  );
  return jsonb_build_object('batchId', p_batch_id, 'status', next_status, 'action', p_action);
end;
$$;

revoke all on function public.education_preview_cutoff_import(text, text, text, text, smallint, text, date, text, integer, jsonb, jsonb) from public, anon;
revoke all on function public.education_catalogue_batch_action(uuid, text) from public, anon;
grant execute on function public.education_preview_cutoff_import(text, text, text, text, smallint, text, date, text, integer, jsonb, jsonb) to authenticated;
grant execute on function public.education_catalogue_batch_action(uuid, text) to authenticated;

comment on function public.education_preview_cutoff_import(text, text, text, text, smallint, text, date, text, integer, jsonb, jsonb) is
  'Reviewer-only atomic v2 cutoff preview. Inserts a review-required batch, draft rows and quarantine evidence; never publishes.';
comment on function public.education_catalogue_batch_action(uuid, text) is
  'Reviewer-only atomic approve/publish/retire transition with advisory locking and append-only audit event.';
