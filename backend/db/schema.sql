-- Rootwork canonical schema
-- Includes tables, constraints, RLS policies, indexes, and triggers.

create extension if not exists "pgcrypto";

-- Shared trigger function for updated_at columns.
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Helper for RLS policies on org-scoped records.
create or replace function public.is_org_member(target_org_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.org_members om
    where om.org_id = target_org_id
      and om.user_id = auth.uid()
  );
$$;

-- Organizations
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  tier text not null default 'freemium' check (tier in ('freemium', 'starter', 'growth', 'enterprise')),
  org_type text,
  org_phase text,
  budget_range text,
  primary_geography text,
  zip_codes text[],
  languages_served text[],
  tier_enforced_at timestamptz,
  stripe_customer_id text,
  mission text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

alter table public.organizations enable row level security;

create policy "organizations_member_read"
  on public.organizations
  for select
  using (public.is_org_member(id));

create policy "organizations_member_write"
  on public.organizations
  for update
  using (public.is_org_member(id))
  with check (public.is_org_member(id));

create trigger organizations_set_updated_at
  before update on public.organizations
  for each row execute function public.handle_updated_at();

-- Organization members
create table if not exists public.org_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  unique (org_id, user_id)
);

alter table public.org_members enable row level security;

create policy "org_members_read"
  on public.org_members
  for select
  using (public.is_org_member(org_id));

create policy "org_members_write"
  on public.org_members
  for insert
  with check (public.is_org_member(org_id));

create policy "org_members_update"
  on public.org_members
  for update
  using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

create policy "org_members_delete"
  on public.org_members
  for delete
  using (public.is_org_member(org_id));

create trigger org_members_set_updated_at
  before update on public.org_members
  for each row execute function public.handle_updated_at();

-- Stage 01 profile inputs
create table if not exists public.org_profiles (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null unique references public.organizations(id) on delete cascade,
  who_is_most_affected text,
  definition_of_success text,
  theory_of_change text,
  draft_mission_statement text,
  claude_mission_flags jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

alter table public.org_profiles enable row level security;

create policy "org_profiles_read"
  on public.org_profiles
  for select
  using (public.is_org_member(org_id));

create policy "org_profiles_write"
  on public.org_profiles
  for insert
  with check (public.is_org_member(org_id));

create policy "org_profiles_update"
  on public.org_profiles
  for update
  using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

create policy "org_profiles_delete"
  on public.org_profiles
  for delete
  using (public.is_org_member(org_id));

create trigger org_profiles_set_updated_at
  before update on public.org_profiles
  for each row execute function public.handle_updated_at();

-- Stage 01 stakeholder mapping
create table if not exists public.stakeholders (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  stakeholder_type text,
  relationship_to_program text,
  in_decision_making_role boolean default false,
  influence_level text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

alter table public.stakeholders enable row level security;

create policy "stakeholders_read"
  on public.stakeholders
  for select
  using (public.is_org_member(org_id));

create policy "stakeholders_write"
  on public.stakeholders
  for insert
  with check (public.is_org_member(org_id));

create policy "stakeholders_update"
  on public.stakeholders
  for update
  using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

create policy "stakeholders_delete"
  on public.stakeholders
  for delete
  using (public.is_org_member(org_id));

create trigger stakeholders_set_updated_at
  before update on public.stakeholders
  for each row execute function public.handle_updated_at();

-- Versioned program design records
create table if not exists public.program_designs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  version integer not null check (version > 0),
  version_label text not null,
  program_model jsonb not null default '{}'::jsonb,
  reconciliation_source text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  unique (org_id, version)
);

alter table public.program_designs enable row level security;

create policy "program_designs_read"
  on public.program_designs
  for select
  using (public.is_org_member(org_id));

create policy "program_designs_write"
  on public.program_designs
  for insert
  with check (public.is_org_member(org_id));

create policy "program_designs_update"
  on public.program_designs
  for update
  using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

create policy "program_designs_delete"
  on public.program_designs
  for delete
  using (public.is_org_member(org_id));

create trigger program_designs_set_updated_at
  before update on public.program_designs
  for each row execute function public.handle_updated_at();

-- Stage 02 SOW uploads
create table if not exists public.sow_uploads (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  storage_path text not null,
  original_filename text not null,
  mime_type text,
  file_size_bytes bigint,
  uploaded_by uuid references auth.users(id),
  uploaded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

alter table public.sow_uploads enable row level security;

create policy "sow_uploads_read"
  on public.sow_uploads
  for select
  using (public.is_org_member(org_id));

create policy "sow_uploads_write"
  on public.sow_uploads
  for insert
  with check (public.is_org_member(org_id));

create policy "sow_uploads_update"
  on public.sow_uploads
  for update
  using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

create policy "sow_uploads_delete"
  on public.sow_uploads
  for delete
  using (public.is_org_member(org_id));

create trigger sow_uploads_set_updated_at
  before update on public.sow_uploads
  for each row execute function public.handle_updated_at();

-- Stage 02 extracted funder metrics
create table if not exists public.funder_metrics (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  sow_upload_id uuid references public.sow_uploads(id) on delete set null,
  metric_name text not null,
  metric_definition text,
  target_value numeric,
  period text,
  extracted_by text default 'agent04_sowExtraction',
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

alter table public.funder_metrics enable row level security;

create policy "funder_metrics_read"
  on public.funder_metrics
  for select
  using (public.is_org_member(org_id));

create policy "funder_metrics_write"
  on public.funder_metrics
  for insert
  with check (public.is_org_member(org_id));

create policy "funder_metrics_update"
  on public.funder_metrics
  for update
  using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

create policy "funder_metrics_delete"
  on public.funder_metrics
  for delete
  using (public.is_org_member(org_id));

create trigger funder_metrics_set_updated_at
  before update on public.funder_metrics
  for each row execute function public.handle_updated_at();

-- Stage 02 engagement templates
create table if not exists public.engagement_templates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  template_name text not null,
  template_type text not null,
  prompt_text text not null,
  generated_by text default 'agent05_engagementTemplates',
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

alter table public.engagement_templates enable row level security;

create policy "engagement_templates_read"
  on public.engagement_templates
  for select
  using (public.is_org_member(org_id));

create policy "engagement_templates_write"
  on public.engagement_templates
  for insert
  with check (public.is_org_member(org_id));

create policy "engagement_templates_update"
  on public.engagement_templates
  for update
  using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

create policy "engagement_templates_delete"
  on public.engagement_templates
  for delete
  using (public.is_org_member(org_id));

create trigger engagement_templates_set_updated_at
  before update on public.engagement_templates
  for each row execute function public.handle_updated_at();

-- Stage 02 engagement documentation (hard stop gate source)
create table if not exists public.community_engagements (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  title text,
  engagement_context text,
  occurred_at timestamptz,
  who_was_present text,
  who_was_absent text,
  why_absent text,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

alter table public.community_engagements enable row level security;

create policy "community_engagements_read"
  on public.community_engagements
  for select
  using (public.is_org_member(org_id));

create policy "community_engagements_write"
  on public.community_engagements
  for insert
  with check (public.is_org_member(org_id));

create policy "community_engagements_update"
  on public.community_engagements
  for update
  using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

create policy "community_engagements_delete"
  on public.community_engagements
  for delete
  using (public.is_org_member(org_id));

create trigger community_engagements_set_updated_at
  before update on public.community_engagements
  for each row execute function public.handle_updated_at();

-- Stage 02b community voice records (verbatim only)
create table if not exists public.community_voice_records (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  engagement_id uuid not null references public.community_engagements(id) on delete cascade,
  voice_content text not null,
  speaker_role text,
  engagement_context text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

alter table public.community_voice_records enable row level security;

create policy "community_voice_records_read"
  on public.community_voice_records
  for select
  using (public.is_org_member(org_id));

create policy "community_voice_records_write"
  on public.community_voice_records
  for insert
  with check (public.is_org_member(org_id));

create policy "community_voice_records_update"
  on public.community_voice_records
  for update
  using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

create policy "community_voice_records_delete"
  on public.community_voice_records
  for delete
  using (public.is_org_member(org_id));

create trigger community_voice_records_set_updated_at
  before update on public.community_voice_records
  for each row execute function public.handle_updated_at();

-- Stage 02b reconciliation outputs
create table if not exists public.program_design_reconciliations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  previous_program_design_id uuid references public.program_designs(id) on delete set null,
  reconciled_program_design_id uuid references public.program_designs(id) on delete set null,
  tensions jsonb not null default '[]'::jsonb,
  decisions jsonb not null default '[]'::jsonb,
  reconciliation_completed_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

alter table public.program_design_reconciliations enable row level security;

create policy "program_design_reconciliations_read"
  on public.program_design_reconciliations
  for select
  using (public.is_org_member(org_id));

create policy "program_design_reconciliations_write"
  on public.program_design_reconciliations
  for insert
  with check (public.is_org_member(org_id));

create policy "program_design_reconciliations_update"
  on public.program_design_reconciliations
  for update
  using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

create policy "program_design_reconciliations_delete"
  on public.program_design_reconciliations
  for delete
  using (public.is_org_member(org_id));

create trigger program_design_reconciliations_set_updated_at
  before update on public.program_design_reconciliations
  for each row execute function public.handle_updated_at();

-- Stage 03 collection tools
create table if not exists public.collection_tools (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  tool_name text not null,
  tool_type text not null,
  configuration jsonb not null default '{}'::jsonb,
  consent_language text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

alter table public.collection_tools enable row level security;

create policy "collection_tools_read"
  on public.collection_tools
  for select
  using (public.is_org_member(org_id));

create policy "collection_tools_write"
  on public.collection_tools
  for insert
  with check (public.is_org_member(org_id));

create policy "collection_tools_update"
  on public.collection_tools
  for update
  using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

create policy "collection_tools_delete"
  on public.collection_tools
  for delete
  using (public.is_org_member(org_id));

create trigger collection_tools_set_updated_at
  before update on public.collection_tools
  for each row execute function public.handle_updated_at();

-- Stage 03 responses
create table if not exists public.collection_responses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  collection_tool_id uuid not null references public.collection_tools(id) on delete cascade,
  respondent_external_id text,
  response_payload jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

alter table public.collection_responses enable row level security;

create policy "collection_responses_read"
  on public.collection_responses
  for select
  using (public.is_org_member(org_id));

create policy "collection_responses_write"
  on public.collection_responses
  for insert
  with check (public.is_org_member(org_id));

create policy "collection_responses_update"
  on public.collection_responses
  for update
  using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

create policy "collection_responses_delete"
  on public.collection_responses
  for delete
  using (public.is_org_member(org_id));

create trigger collection_responses_set_updated_at
  before update on public.collection_responses
  for each row execute function public.handle_updated_at();

-- Server-owned stage progression
create table if not exists public.stage_progress (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  stage text not null check (stage in ('01', '02', '02b', '03', '04', '05')),
  status text not null default 'locked' check (status in ('locked', 'in_progress', 'completed')),
  completed_at timestamptz,
  completed_by uuid references auth.users(id),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  unique (org_id, stage)
);

alter table public.stage_progress enable row level security;

create policy "stage_progress_read"
  on public.stage_progress
  for select
  using (public.is_org_member(org_id));

-- No direct client writes. Service role bypasses RLS on server.
create policy "server_write_only_stage_progress_insert"
  on public.stage_progress
  for insert
  with check (false);

create policy "server_write_only_stage_progress_update"
  on public.stage_progress
  for update
  using (false)
  with check (false);

create policy "server_write_only_stage_progress_delete"
  on public.stage_progress
  for delete
  using (false);

create trigger stage_progress_set_updated_at
  before update on public.stage_progress
  for each row execute function public.handle_updated_at();

-- Server-owned Claude interaction logs
create table if not exists public.claude_interactions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  stage text not null,
  interaction_type text not null,
  prompt_summary text,
  output_summary text,
  model text not null default 'claude-sonnet-4-6',
  tokens_used integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

alter table public.claude_interactions enable row level security;

create policy "claude_interactions_read"
  on public.claude_interactions
  for select
  using (public.is_org_member(org_id));

-- No direct client writes. Service role bypasses RLS on server.
create policy "server_write_only_claude_interactions_insert"
  on public.claude_interactions
  for insert
  with check (false);

create policy "server_write_only_claude_interactions_update"
  on public.claude_interactions
  for update
  using (false)
  with check (false);

create policy "server_write_only_claude_interactions_delete"
  on public.claude_interactions
  for delete
  using (false);

create trigger claude_interactions_set_updated_at
  before update on public.claude_interactions
  for each row execute function public.handle_updated_at();

-- Stage 05 funding opportunities
create table if not exists public.funding_opportunities (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  funder_name text not null,
  opportunity_type text not null check (opportunity_type in ('grant', 'contract', 'fellowship', 'other')),
  description text,
  eligibility_notes text,
  amount_min numeric,
  amount_max numeric,
  deadline_at timestamptz,
  url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

alter table public.funding_opportunities enable row level security;

create policy "admin_read_all"
  on public.funding_opportunities
  for select
  using (is_active = true);

create policy "admin_write"
  on public.funding_opportunities
  for all
  using (auth.jwt() ->> 'role' = 'service_role')
  with check (auth.jwt() ->> 'role' = 'service_role');

create trigger funding_opportunities_set_updated_at
  before update on public.funding_opportunities
  for each row execute function public.handle_updated_at();

-- Required indexes from schema rules
create index if not exists org_members_org_id_idx on public.org_members (org_id);
create index if not exists org_members_user_id_idx on public.org_members (user_id);
create index if not exists stakeholders_org_id_idx on public.stakeholders (org_id);
create index if not exists program_designs_org_id_version_idx on public.program_designs (org_id, version);
create index if not exists sow_uploads_org_id_idx on public.sow_uploads (org_id);
create index if not exists funder_metrics_org_id_idx on public.funder_metrics (org_id);
create index if not exists engagement_templates_org_id_idx on public.engagement_templates (org_id);
create index if not exists community_engagements_org_id_idx on public.community_engagements (org_id);
create index if not exists community_voice_records_org_engagement_idx on public.community_voice_records (org_id, engagement_id);
create index if not exists program_design_reconciliations_org_id_idx on public.program_design_reconciliations (org_id);
create index if not exists collection_tools_org_id_idx on public.collection_tools (org_id);
create index if not exists collection_responses_org_tool_idx on public.collection_responses (org_id, collection_tool_id);
create index if not exists stage_progress_org_stage_idx on public.stage_progress (org_id, stage);
create index if not exists claude_interactions_org_created_idx on public.claude_interactions (org_id, created_at);
create index if not exists funding_opportunities_active_type_idx on public.funding_opportunities (is_active, opportunity_type);

-- If org_profiles already existed without mission-draft columns, run once:
alter table public.org_profiles add column if not exists draft_mission_statement text;
alter table public.org_profiles add column if not exists claude_mission_flags jsonb not null default '[]'::jsonb;
alter table public.organizations add column if not exists org_phase text;

alter table public.program_designs add column if not exists claude_alignment_flags jsonb not null default '{}'::jsonb;

-- Stage 01 optional program documents (upload before program design)
create table if not exists public.stage01_program_documents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  storage_path text not null,
  original_filename text not null,
  mime_type text,
  file_size_bytes bigint,
  uploaded_by uuid references auth.users(id),
  extracted_data jsonb,
  uploaded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

alter table public.stage01_program_documents enable row level security;

create policy "stage01_program_documents_read"
  on public.stage01_program_documents
  for select
  using (public.is_org_member(org_id));

create policy "stage01_program_documents_write"
  on public.stage01_program_documents
  for insert
  with check (public.is_org_member(org_id));

create policy "stage01_program_documents_update"
  on public.stage01_program_documents
  for update
  using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

create policy "stage01_program_documents_delete"
  on public.stage01_program_documents
  for delete
  using (public.is_org_member(org_id));

create trigger stage01_program_documents_set_updated_at
  before update on public.stage01_program_documents
  for each row execute function public.handle_updated_at();

create index if not exists stage01_program_documents_org_id_idx
  on public.stage01_program_documents (org_id);

alter table public.stage01_program_documents add column if not exists extracted_data jsonb;
