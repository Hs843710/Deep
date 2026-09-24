
-- PIOS Step 1: bounded, private, on-platform attention monitoring.
-- No outbound messages, irreversible actions, or automatic contact.
create table if not exists public.personal_monitor_config (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default true,
  last_checked_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);
create table if not exists public.personal_attention_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_key text not null,
  kind text not null check (kind in ('commitment_due','quote_followup')),
  severity text not null check (severity in ('attention','important')),
  status text not null default 'open' check (status in ('open','acknowledged','resolved')),
  headline text not null,
  detail text not null,
  source_kind text not null,
  source_id uuid not null,
  due_at timestamptz,
  evidence jsonb not null default '{}'::jsonb,
  first_observed_at timestamptz not null default now(),
  last_observed_at timestamptz not null default now(),
  unique(user_id,event_key)
);
create index if not exists personal_attention_user_state_idx on public.personal_attention_events(user_id,status,first_observed_at desc);
create index if not exists personal_attention_source_idx on public.personal_attention_events(source_kind,source_id);
alter table public.personal_monitor_config enable row level security;
alter table public.personal_attention_events enable row level security;
grant select,insert on public.personal_monitor_config to authenticated;
grant update(enabled) on public.personal_monitor_config to authenticated;
grant select on public.personal_attention_events to authenticated;
grant update(status) on public.personal_attention_events to authenticated;
drop policy if exists pios_monitor_config_select on public.personal_monitor_config;
create policy pios_monitor_config_select on public.personal_monitor_config for select to authenticated using ((select auth.uid())=user_id);
drop policy if exists pios_monitor_config_insert on public.personal_monitor_config;
create policy pios_monitor_config_insert on public.personal_monitor_config for insert to authenticated with check ((select auth.uid())=user_id);
drop policy if exists pios_monitor_config_update on public.personal_monitor_config;
create policy pios_monitor_config_update on public.personal_monitor_config for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
drop policy if exists pios_attention_select on public.personal_attention_events;
create policy pios_attention_select on public.personal_attention_events for select to authenticated using ((select auth.uid())=user_id);
drop policy if exists pios_attention_update on public.personal_attention_events;
create policy pios_attention_update on public.personal_attention_events for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
insert into public.personal_monitor_config(user_id,enabled)
select p.user_id,true from public.profiles p where p.onboarding_complete=true
on conflict(user_id) do nothing;

create or replace function public.monitor_personal_attention()
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  run_at timestamptz := clock_timestamp();
  commitment_rows integer := 0;
  quote_rows integer := 0;
  resolved_rows integer := 0;
begin
  -- Only pending, recorded commitments with a specific due date within 48 hours.
  insert into public.personal_attention_events
  (user_id,event_key,kind,severity,headline,detail,source_kind,source_id,due_at,evidence,last_observed_at)
  select c.user_id,'commitment:'||c.id::text||':'||extract(epoch from c.due_at)::bigint::text,
   'commitment_due',
   case when c.due_at<=run_at then 'important' else 'attention' end,
   'A recorded commitment needs a status check',
   case when c.due_at<=run_at
     then 'The recorded due time has passed. Confirm whether this commitment is still open and what action is necessary.'
     else 'This recorded commitment is due within 48 hours. Confirm it is still open and whether preparation is needed.' end,
   'life_commitments',c.id,c.due_at,
   jsonb_build_object('source_updated_at',c.updated_at,'observed_due_at',c.due_at,'status_at_observation',c.status),
   run_at
  from public.life_commitments c
  join public.personal_monitor_config m on m.user_id=c.user_id and m.enabled
  where c.due_at is not null and c.due_at<=run_at+interval '48 hours'
    and coalesce(c.status,'open') not in ('completed','done','cancelled','canceled','resolved')
  on conflict(user_id,event_key) do update set
     last_observed_at=excluded.last_observed_at,
     severity=excluded.severity,
     detail=excluded.detail,
     evidence=excluded.evidence
  where public.personal_attention_events.status in ('open','acknowledged');
  get diagnostics commitment_rows = row_count;

  -- An owned quotation unanswered for 72 hours needs a bounded, internal review.
  -- A missing margin is an uncertainty, NOT proven unprofitability.
  insert into public.personal_attention_events
  (user_id,event_key,kind,severity,headline,detail,source_kind,source_id,due_at,evidence,last_observed_at)
  select q.user_id,'quote:'||q.id::text||':'||extract(epoch from q.quote_sent_at)::bigint::text,
   'quote_followup','attention','An existing quotation may need a follow-up',
   case when q.estimated_margin_pct is null and q.estimated_direct_cost is null
      then 'The quotation is still recorded as quoted and its margin is unverified. Review customer status and direct costs before making any commitment.'
      else 'The quotation is still recorded as quoted. Verify the customer response and next step before making any commitment.' end,
   'operating_opportunities',q.id,null,
   jsonb_build_object('quote_sent_at',q.quote_sent_at,'source_updated_at',q.updated_at,'stage_at_observation',q.stage,
      'margin_known',q.estimated_margin_pct is not null or q.estimated_direct_cost is not null),
   run_at
  from public.operating_opportunities q
  join public.personal_monitor_config m on m.user_id=q.user_id and m.enabled
  where q.stage='quoted' and q.quote_sent_at is not null and q.quote_sent_at<=run_at-interval '72 hours'
  on conflict(user_id,event_key) do update set
    last_observed_at=excluded.last_observed_at,
    detail=excluded.detail,evidence=excluded.evidence
  where public.personal_attention_events.status in ('open','acknowledged');
  get diagnostics quote_rows = row_count;

  -- Resolve an open alert when its underlying condition is no longer observed.
  update public.personal_attention_events e set status='resolved'
   from public.personal_monitor_config m
  where e.user_id=m.user_id and m.enabled
    and e.status in ('open','acknowledged')
    and e.last_observed_at<run_at;
  get diagnostics resolved_rows = row_count;

  update public.personal_monitor_config set last_checked_at=run_at,last_error=null where enabled;
  return jsonb_build_object('checked_at',run_at,'commitment_rows_observed',commitment_rows,
     'quote_rows_observed',quote_rows,'resolved_rows',resolved_rows);
end $$;
revoke all on function public.monitor_personal_attention() from public,anon,authenticated;
-- pg_cron runs this internal query as the database owner. No service token is exposed.
select cron.schedule('pios-personal-attention-hourly','9 * * * *',
  'select public.monitor_personal_attention();')
where not exists (select 1 from cron.job where jobname='pios-personal-attention-hourly');
