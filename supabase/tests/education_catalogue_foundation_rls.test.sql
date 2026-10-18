-- Run with: supabase test db --local supabase/tests/education_catalogue_foundation_rls.test.sql
begin;
select plan(40);

insert into auth.users (id, email) values
  ('12121212-1212-1212-1212-121212121212', 'catalogue-user@example.test'),
  ('34343434-3434-3434-3434-343434343434', 'catalogue-outsider@example.test');

-- Fixtures are inserted as the database owner. Ordinary API roles cannot write
-- catalogue records until a future reviewer-provisioning migration exists.
insert into public.education_source_batches (
  id, source_system, source_title, source_url, artifact_sha256, academic_year,
  academic_period, retrieval_date, extraction_method, source_row_count,
  record_count, status, published_at
) values
  ('11111111-aaaa-aaaa-aaaa-111111111111', 'APSCHE_EAPCET', 'Published cutoff source', 'https://example.gov/ap.xlsx', repeat('a', 64), 2024, '2024 admission', current_date, 'test fixture', 1, 1, 'published', now()),
  ('22222222-bbbb-bbbb-bbbb-222222222222', 'APHERMC', 'Published fee identity source', 'https://example.gov/fee.pdf', repeat('b', 64), 2024, '2024 fee', current_date, 'test fixture', 1, 0, 'published', now()),
  ('33333333-cccc-cccc-cccc-333333333333', 'APSCHE_EAPCET', 'Draft cutoff source', 'https://example.gov/draft.xlsx', repeat('c', 64), 2024, '2024 admission', current_date, 'test fixture', 1, 1, 'review_required', null);

insert into public.education_institutions (id, display_name, identity_status) values
  ('44444444-dddd-dddd-dddd-444444444444', 'Example APSCHE Institution', 'reviewed'),
  ('55555555-eeee-eeee-eeee-555555555555', 'Example APHERMC Institution', 'reviewed');
insert into public.education_institution_source_ids (
  institution_id, source_system, source_institution_code, raw_name, source_batch_id, review_status
) values
  ('44444444-dddd-dddd-dddd-444444444444', 'APSCHE_EAPCET', 'SAME01', 'Example APSCHE Institution', '11111111-aaaa-aaaa-aaaa-111111111111', 'approved'),
  ('55555555-eeee-eeee-eeee-555555555555', 'APHERMC', 'SAME01', 'Example APHERMC Institution', '22222222-bbbb-bbbb-bbbb-222222222222', 'approved');
insert into public.education_branches (id, display_name, status) values
  ('66666666-ffff-ffff-ffff-666666666666', 'Computer Science', 'active');
insert into public.education_branch_source_ids (
  branch_id, source_system, source_branch_code, raw_name, source_batch_id, review_status
) values
  ('66666666-ffff-ffff-ffff-666666666666', 'APSCHE_EAPCET', 'CSE', 'CSE', '11111111-aaaa-aaaa-aaaa-111111111111', 'approved');
insert into public.education_cutoffs (
  id, institution_id, branch_id, source_batch_id, admission_region, cutoff_category,
  cutoff_rank, academic_year, source_row_number, source_sno, source_record_key,
  source_url, publication_state
) values (
  '77777777-aaaa-aaaa-aaaa-777777777777', '44444444-dddd-dddd-dddd-444444444444',
  '66666666-ffff-ffff-ffff-666666666666', '11111111-aaaa-aaaa-aaaa-111111111111',
  'AU', 'OC_BOYS', 12000, 2024, 76, 74, repeat('d', 64), 'https://example.gov/ap.xlsx', 'published'
);
insert into public.education_catalogue_audit_events (
  source_batch_id, entity_type, entity_id, action, actor_user_id, details
) values (
  '11111111-aaaa-aaaa-aaaa-111111111111', 'source_batch', '11111111-aaaa-aaaa-aaaa-111111111111',
  'publish', '12121212-1212-1212-1212-121212121212', '{"fixture": true}'::jsonb
);

set local role anon;
select throws_ok($$select id from public.education_cutoffs$$, '42501', null, 'anonymous users cannot read the catalogue');

set local role authenticated;
set local request.jwt.claim.sub = '12121212-1212-1212-1212-121212121212';
select ok(not public.is_education_catalogue_reviewer(), 'ordinary authenticated user is not a reviewer');
select results_eq($$select source_system from public.education_source_batches order by source_system$$, array['APHERMC', 'APSCHE_EAPCET'], 'authenticated users see published batches only');
select results_eq($$select admission_region from public.education_cutoffs$$, array['AU'], 'authenticated users see published historical cutoffs');
select is_empty($$select id from public.education_source_batches where status = 'review_required'$$, 'draft/review-required batches are hidden');
select results_eq($$select source_institution_code from public.education_institution_source_ids order by source_system$$, array['SAME01', 'SAME01'], 'source identifiers are namespaced by source system');
select throws_ok(
  $$insert into public.education_source_batches (source_system, source_title, source_url, artifact_sha256, academic_year, academic_period, retrieval_date, extraction_method) values ('APSCHE_EAPCET', 'Unauthorized', 'https://example.gov/x', repeat('e', 64), 2024, '2024', current_date, 'test')$$,
  '42501', null, 'ordinary authenticated users cannot insert source batches'
);
select throws_ok($$update public.education_source_batches set status = 'retired' where id = '11111111-aaaa-aaaa-aaaa-111111111111'$$, '42501', null, 'ordinary authenticated users cannot publish or retire batches');
select throws_ok($$delete from public.education_catalogue_audit_events where source_batch_id = '11111111-aaaa-aaaa-aaaa-111111111111'$$, '42501', null, 'ordinary authenticated users cannot delete audit events');
select throws_ok($$update public.education_catalogue_audit_events set action = 'retire' where source_batch_id = '11111111-aaaa-aaaa-aaaa-111111111111'$$, '42501', null, 'ordinary authenticated users cannot update audit events');
select throws_ok($$insert into public.education_catalogue_audit_events (source_batch_id, entity_type, action, actor_user_id) values ('11111111-aaaa-aaaa-aaaa-111111111111', 'source_batch', 'publish', '12121212-1212-1212-1212-121212121212')$$, '42501', null, 'ordinary authenticated users cannot append audit events');
select throws_ok($$select user_id from public.education_catalogue_reviewers$$, '42501', null, 'reviewer allowlist is not readable by clients');
select throws_ok($$insert into public.education_catalogue_reviewers (user_id) values ('34343434-3434-3434-3434-343434343434')$$, '42501', null, 'ordinary users cannot grant reviewer access');
select throws_ok($$update public.education_catalogue_reviewers set active = true where user_id = '12121212-1212-1212-1212-121212121212'$$, '42501', null, 'ordinary users cannot change reviewer access');

set local request.jwt.claim.sub = '34343434-3434-3434-3434-343434343434';
select results_eq($$select id::text from public.education_cutoffs$$, array['77777777-aaaa-aaaa-aaaa-777777777777'], 'catalogue reads do not depend on family membership');

select throws_ok(
  $$insert into public.education_institution_source_ids (institution_id, source_system, source_institution_code, raw_name, source_batch_id, review_status) values ('44444444-dddd-dddd-dddd-444444444444', 'APSCHE_EAPCET', 'SAME01', 'Duplicate', '11111111-aaaa-aaaa-aaaa-111111111111', 'approved')$$,
  '42501', null, 'ordinary users cannot create duplicate source identifiers'
);

set local role postgres;
insert into public.education_catalogue_reviewers (user_id)
values ('12121212-1212-1212-1212-121212121212');
set local role authenticated;
set local request.jwt.claim.sub = '12121212-1212-1212-1212-121212121212';
select ok(public.is_education_catalogue_reviewer(), 'provisioned reviewer passes the authorization helper');
\o /dev/null
select public.education_preview_cutoff_import(
  'APSCHE_EAPCET', 'Reviewer batch', 'https://example.gov/reviewer.xlsx', repeat('8', 64),
  2024::smallint, '2024 admission', current_date, 'review test', 1,
  jsonb_build_array(jsonb_build_object(
    'dataStatus', 'historical', 'institutionCode', 'SAME01', 'branchCode', 'CSE',
    'admissionRegion', 'AU', 'cutoffCategory', 'SC_BOYS', 'cutoffRank', '13000',
    'cutoffYear', '2024', 'sourceRowNumber', '80', 'sourceSno', '80',
    'sourceRecordKey', repeat('8', 64), 'sourceUrl', 'https://example.gov/reviewer.xlsx',
    'lastVerifiedAt', '2026-10-18', 'counsellingRound', null
  )), '[]'::jsonb) as preview_result \gset
\o
select is(:'preview_result'::jsonb->>'accepted', '1', 'reviewer preview accepts a source-resolved row');
select is(:'preview_result'::jsonb->>'status', 'review_required', 'preview remains unpublished');
\o /dev/null
select :'preview_result'::jsonb->>'batchId' as reviewer_batch_id \gset
\o
select is((select status from public.education_source_batches where id = :'reviewer_batch_id'::uuid), 'review_required', 'reviewer can read an unpublished batch');
select is((public.education_catalogue_batch_action(:'reviewer_batch_id'::uuid, 'approve')->>'status'), 'approved', 'reviewer can approve a batch');
select is((public.education_catalogue_batch_action(:'reviewer_batch_id'::uuid, 'publish')->>'status'), 'published', 'reviewer can publish an approved batch');
select is((select count(*)::integer from public.education_cutoffs where source_record_key = repeat('8', 64)), 1, 'accepted source row is persisted');
select is((public.education_preview_cutoff_import(
  'APSCHE_EAPCET', 'Reviewer batch', 'https://example.gov/reviewer.xlsx', repeat('8', 64),
  2024::smallint, '2024 admission', current_date, 'review test', 1,
  '[]'::jsonb, '[]'::jsonb
)->>'idempotentReplay'), 'true', 'repeating the same artifact is idempotent');
select is((public.education_preview_cutoff_import(
  'APSCHE_EAPCET', 'Malformed batch', 'https://example.gov/malformed.xlsx', repeat('9', 64),
  2024::smallint, '2024 admission', current_date, 'review test', 1,
  jsonb_build_array(jsonb_build_object('dataStatus', 'historical', 'institutionCode', 'SAME01', 'branchCode', 'CSE', 'admissionRegion', 'AU', 'cutoffCategory', 'SC_BOYS', 'cutoffRank', 'bad', 'cutoffYear', '2024', 'sourceRowNumber', '81', 'sourceSno', '81', 'sourceRecordKey', repeat('9', 64), 'sourceUrl', 'https://example.gov/malformed.xlsx', 'lastVerifiedAt', '2026-10-18')), '[]'::jsonb
)->>'rejected'), '1', 'malformed rows are rejected and quarantined');
\o /dev/null
select public.education_preview_cutoff_import(
  'APSCHE_EAPCET', 'Replay batch', 'https://example.gov/replay.xlsx', repeat('7', 64),
  2024::smallint, '2024 admission', current_date, 'review test', 1, jsonb_build_array(jsonb_build_object(
    'dataStatus', 'historical', 'institutionCode', 'SAME01', 'branchCode', 'CSE', 'admissionRegion', 'AU', 'cutoffCategory', 'SC_BOYS', 'cutoffRank', '13000', 'cutoffYear', '2024', 'sourceRowNumber', '80', 'sourceSno', '80', 'sourceRecordKey', repeat('8', 64), 'sourceUrl', 'https://example.gov/replay.xlsx', 'lastVerifiedAt', '2026-10-18'
  )), '[]'::jsonb) as replay_result \gset
\o
select is(:'replay_result'::jsonb->>'duplicateReplay', '1', 'an existing source key is reported as a replay');
select is((select reason_code from public.education_import_quarantine where source_batch_id = (:'replay_result'::jsonb->>'batchId')::uuid), 'duplicate_source_record_replay', 'replay evidence is quarantined with its cause');
select is((public.education_preview_cutoff_import(
  'APSCHE_EAPCET', 'Conflict batch', 'https://example.gov/conflict.xlsx', repeat('6', 64),
  2024::smallint, '2024 admission', current_date, 'review test', 1, jsonb_build_array(jsonb_build_object(
    'dataStatus', 'historical', 'institutionCode', 'SAME01', 'branchCode', 'CSE', 'admissionRegion', 'AU', 'cutoffCategory', 'SC_BOYS', 'cutoffRank', '13001', 'cutoffYear', '2024', 'sourceRowNumber', '80', 'sourceSno', '80', 'sourceRecordKey', repeat('8', 64), 'sourceUrl', 'https://example.gov/conflict.xlsx', 'lastVerifiedAt', '2026-10-18'
  )), '[]'::jsonb)->>'conflicts'), '1', 'a conflicting source key is quarantined');
select is((public.education_catalogue_batch_action(:'reviewer_batch_id'::uuid, 'retire')->>'status'), 'retired', 'reviewer can retire a published batch without deleting records');
select throws_ok(format('delete from public.education_source_batches where id = %L::uuid', :'reviewer_batch_id'), '42501', null, 'reviewers cannot delete source batches');
select throws_ok(format('insert into public.education_catalogue_audit_events (source_batch_id, entity_type, action, actor_user_id) values (%L::uuid, ''source_batch'', ''publish'', ''12121212-1212-1212-1212-121212121212'')', :'reviewer_batch_id'), '42501', null, 'reviewers cannot append audit events directly');
select throws_ok($$update public.education_catalogue_audit_events set action = 'retire' where source_batch_id = '88888888-aaaa-aaaa-aaaa-888888888888'$$, '42501', null, 'reviewers cannot update audit history');
select throws_ok($$delete from public.education_catalogue_audit_events where source_batch_id = '88888888-aaaa-aaaa-aaaa-888888888888'$$, '42501', null, 'reviewers cannot delete audit history');
set local role postgres;
update public.education_catalogue_reviewers set active = false where user_id = '12121212-1212-1212-1212-121212121212';
set local role authenticated;
select ok(not public.is_education_catalogue_reviewer(), 'revoked reviewer no longer passes the authorization helper');
select throws_ok(format('select public.education_catalogue_batch_action(%L::uuid, ''retire'')', :'reviewer_batch_id'), '42501', null, 'revoked reviewer cannot mutate catalogue records');

set local role postgres;
select throws_ok(
  $$update public.education_catalogue_audit_events set action = 'retire' where source_batch_id = '11111111-aaaa-aaaa-aaaa-111111111111'$$,
  'P0001', 'Education catalogue audit events are append-only', 'audit events cannot be updated even by the database owner'
);
select throws_ok(
  $$delete from public.education_catalogue_audit_events where source_batch_id = '11111111-aaaa-aaaa-aaaa-111111111111'$$,
  'P0001', 'Education catalogue audit events are append-only', 'audit events cannot be deleted even by the database owner'
);
select throws_ok(
  $$insert into public.education_cutoffs (institution_id, branch_id, source_batch_id, admission_region, cutoff_category, cutoff_rank, academic_year, source_row_number, source_sno, source_record_key, source_url) values ('44444444-dddd-dddd-dddd-444444444444', '66666666-ffff-ffff-ffff-666666666666', '11111111-aaaa-aaaa-aaaa-111111111111', 'AU', 'OC_BOYS', 13000, 2024, 77, 75, repeat('d', 64), 'https://example.gov/ap.xlsx')$$,
  '23505', null, 'duplicate source-record keys are rejected'
);
select throws_ok(
  $$insert into public.education_cutoffs (institution_id, branch_id, source_batch_id, admission_region, cutoff_category, cutoff_rank, academic_year, source_row_number, source_sno, source_record_key, source_url) values ('44444444-dddd-dddd-dddd-444444444444', '66666666-ffff-ffff-ffff-666666666666', '11111111-aaaa-aaaa-aaaa-111111111111', 'AU', 'OC_BOYS', 13000, 2024, 76, 74, repeat('f', 64), 'https://example.gov/ap.xlsx')$$,
  '23505', null, 'duplicate source-row/category keys are rejected'
);
select throws_ok(
  $$insert into public.education_institution_source_ids (institution_id, source_system, source_institution_code, raw_name, source_batch_id, review_status) values ('44444444-dddd-dddd-dddd-444444444444', 'APSCHE_EAPCET', 'SAME01', 'Duplicate', '11111111-aaaa-aaaa-aaaa-111111111111', 'approved')$$,
  '23505', null, 'duplicate identifiers within a source namespace are rejected'
);
select * from finish();
rollback;
