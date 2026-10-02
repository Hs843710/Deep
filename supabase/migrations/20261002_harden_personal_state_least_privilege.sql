-- PIOS personal-state least privilege.
revoke all on table public.personal_monitor_config from public, anon, authenticated;
revoke all on table public.personal_attention_events from public, anon, authenticated;
revoke all on table public.prepared_work from public, anon, authenticated;
revoke all on table public.research_artifacts from public, anon, authenticated;
revoke all on table public.observed_outcome_events from public, anon, authenticated;
revoke all on table public.personal_graph_nodes from public, anon, authenticated;
revoke all on table public.personal_graph_edges from public, anon, authenticated;

grant select, insert on table public.personal_monitor_config to authenticated;
grant update(enabled) on table public.personal_monitor_config to authenticated;
grant select on table public.personal_attention_events to authenticated;
grant update(status) on table public.personal_attention_events to authenticated;
grant select, insert on table public.prepared_work to authenticated;
grant select, insert on table public.research_artifacts to authenticated;
grant select on table public.observed_outcome_events to authenticated;
grant select on table public.personal_graph_nodes to authenticated;
grant select on table public.personal_graph_edges to authenticated;

drop policy if exists prepared_work_delete_own on public.prepared_work;
drop policy if exists personal_graph_nodes_owner on public.personal_graph_nodes;
create policy personal_graph_nodes_select_own on public.personal_graph_nodes for select to authenticated using ((select auth.uid())=user_id);
drop policy if exists personal_graph_edges_owner on public.personal_graph_edges;
create policy personal_graph_edges_select_own on public.personal_graph_edges for select to authenticated using ((select auth.uid())=user_id);
