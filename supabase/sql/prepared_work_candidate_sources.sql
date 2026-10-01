-- PIOS Step 2: allow verified internal work to originate from either an owned operating record or a personal opportunity candidate.
alter table public.prepared_work alter column operating_id drop not null;

drop policy if exists prepared_work_insert_own on public.prepared_work;
create policy prepared_work_insert_own on public.prepared_work
for insert to authenticated
with check (
  (select auth.uid())=user_id
  and (
    (operating_id is not null and exists (
      select 1 from public.operating_opportunities o
      where o.id=operating_id and o.user_id=(select auth.uid())
    ))
    or
    (candidate_id is not null and exists (
      select 1 from public.opportunity_candidates c
      where c.id=candidate_id and c.user_id=(select auth.uid())
    ))
  )
);

create unique index if not exists prepared_work_candidate_version_uidx
on public.prepared_work(user_id,candidate_id,work_type,source_updated_at)
where operating_id is null and candidate_id is not null;
