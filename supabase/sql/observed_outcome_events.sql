-- PIOS Step 3: factual operating observations for outcome learning.
-- Observations remain descriptive; they are not automatically classified as positive/negative.
create table if not exists public.observed_outcome_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  operating_id uuid not null references public.operating_opportunities(id) on delete cascade,
  candidate_id uuid references public.opportunity_candidates(id) on delete set null,
  decision_id uuid references public.decisions(id) on delete set null,
  event_type text not null default 'operating_snapshot',
  observed_at timestamptz not null default now(),
  source_updated_at timestamptz not null,
  fingerprint text not null,
  facts jsonb not null default '{}'::jsonb,
  source_kind text,
  source_ref text,
  created_at timestamptz not null default now(),
  unique(user_id,operating_id,fingerprint)
);
create index if not exists observed_outcome_user_time_idx on public.observed_outcome_events(user_id,observed_at desc);
create index if not exists observed_outcome_candidate_idx on public.observed_outcome_events(candidate_id,observed_at desc);
create index if not exists observed_outcome_decision_idx on public.observed_outcome_events(decision_id,observed_at desc);
alter table public.observed_outcome_events enable row level security;
revoke all on public.observed_outcome_events from anon;
revoke insert,update,delete on public.observed_outcome_events from authenticated;
grant select on public.observed_outcome_events to authenticated;
drop policy if exists observed_outcome_select_own on public.observed_outcome_events;
create policy observed_outcome_select_own on public.observed_outcome_events for select to authenticated using ((select auth.uid())=user_id);
-- Trigger implementation is kept in the live database under private.capture_operating_observation().
