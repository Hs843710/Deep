import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const U=Deno.env.get('SUPABASE_URL')!,A=Deno.env.get('SUPABASE_ANON_KEY')!,K=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;const C={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,x-client-info,apikey,content-type,x-pios-cron-token','Access-Control-Allow-Methods':'POST,OPTIONS'};const J=(d:any,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{...C,'Content-Type':'application/json','Cache-Control':'no-store'}});
async function F(url:string,init:RequestInit={}){let r=await fetch(url,init),t=await r.text();if(!r.ok&&r.status===401&&t.includes('JWT issued at future')){await new Promise(x=>setTimeout(x,700));r=await fetch(url,init);t=await r.text()}if(!r.ok)throw Error(`${r.status} ${t.slice(0,700)}`);return t?JSON.parse(t):null}
async function R(path:string,init:RequestInit={}){const h=new Headers(init.headers||{});h.set('apikey',K);h.set('Authorization',`Bearer ${K}`);if(init.body)h.set('Content-Type','application/json');return F(`${U}/rest/v1/${path}`,{...init,headers:h})}
async function auth(jwt:string){try{return await F(`${U}/auth/v1/user`,{headers:{apikey:A,Authorization:`Bearer ${jwt}`}})}catch{return null}}
async function secret(){return(await R('system_secrets?name=eq.scheduled_intelligence&select=secret'))?.[0]?.secret||''}
function safe(a:string,b:string){if(!a||!b||a.length!==b.length)return false;let x=0;for(let i=0;i<a.length;i++)x|=a.charCodeAt(i)^b.charCodeAt(i);return x===0}
const eq=(a:any,b:any)=>JSON.stringify(a??{})===JSON.stringify(b??{});
async function upNode(uid:string,node_type:string,label:string,state:any,source_ref:string,confidence=100,sensitive=false){const old=(await R(`personal_graph_nodes?user_id=eq.${uid}&source_kind=eq.system_sync&source_ref=eq.${encodeURIComponent(source_ref)}&select=*&limit=1`))?.[0];if(old&&!eq(old.state,state))await R('state_changes',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify([{user_id:uid,domain:'personal_model',entity_type:node_type,entity_ref:source_ref,change_type:'state_updated',before_state:old.state,after_state:state,materiality:node_type==='finance'?85:node_type==='goal'?80:node_type==='goal_contract'?80:60,source_kind:'personal_graph_core'}])});const row={user_id:uid,node_type,label,state,source_kind:'system_sync',source_ref,confidence,sensitive,valid_from:old?.valid_from||new Date().toISOString(),valid_to:null,updated_at:new Date().toISOString()};return(await R('personal_graph_nodes?on_conflict=user_id,source_kind,source_ref',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify([row])}))?.[0]}
async function edge(uid:string,from:string,to:string,relation_type:string,confidence:number,evidence:any[],metadata:any={}){return(await R('personal_graph_edges?on_conflict=user_id,from_node_id,to_node_id,relation_type',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify([{user_id:uid,from_node_id:from,to_node_id:to,relation_type,confidence,evidence,metadata,updated_at:new Date().toISOString()}])}))?.[0]}
async function prov(uid:string,entity_type:string,entity_id:string|null,claim:string,fact_class:string,source_kind:string,source_ref:string|null,confidence:number|null){await R('provenance_records',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify([{user_id:uid,entity_type,entity_id,claim,fact_class,source_kind,source_ref,confidence,metadata:{generated_by:'personal-graph-core-v2-life-state'}}])})}
Deno.serve(async(req:Request)=>{if(req.method==='OPTIONS')return new Response('ok',{headers:C});if(req.method!=='POST')return J({error:'POST required'},405);let uid='';const jwt=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');if(jwt){const u=await auth(jwt);if(u?.id)uid=u.id}if(!uid){const supplied=req.headers.get('x-pios-cron-token')||'',s=await secret();if(!safe(supplied,s))return J({error:'unauthorized'},401);const b=await req.json().catch(()=>({}));uid=String(b.user_id||'')}if(!uid)return J({error:'user_id required'},400);try{const [p,g,gc,b,c,k,r,f,oc,ol,cm,op,ds,pw,obs,ss,ra]=await Promise.all([
R(`profiles?user_id=eq.${uid}&select=*`),
R(`goals?user_id=eq.${uid}&status=eq.active&select=*`),
R(`goal_contracts?user_id=eq.${uid}&select=*`),
R(`businesses?user_id=eq.${uid}&active=eq.true&select=*`),
R(`capabilities?user_id=eq.${uid}&active=eq.true&select=*`),
R(`constraints?user_id=eq.${uid}&select=*`),
R(`resources_assets?user_id=eq.${uid}&active=eq.true&select=*`),
R(`financial_snapshots?user_id=eq.${uid}&select=*&order=captured_at.desc&limit=1`),
R(`opportunity_candidates?user_id=eq.${uid}&is_material=eq.true&status=in.(new,investigate,watch,approved,executing)&select=*&limit=150`),
R(`opportunity_links?user_id=eq.${uid}&select=*`),
R(`life_commitments?user_id=eq.${uid}&select=*&order=updated_at.desc&limit=250`),
R(`operating_opportunities?user_id=eq.${uid}&select=*&order=updated_at.desc&limit=250`),
R(`decisions?user_id=eq.${uid}&select=*&order=decided_at.desc&limit=150`),
R(`prepared_work?user_id=eq.${uid}&status=eq.prepared&select=*&order=created_at.desc&limit=150`),
R(`observed_outcome_events?user_id=eq.${uid}&select=*&order=observed_at.desc&limit=150`),
R(`connected_source_sync_state?user_id=eq.${uid}&select=*&order=updated_at.desc&limit=50`),
R(`research_artifacts?user_id=eq.${uid}&select=*&order=created_at.desc&limit=200`)
]);const nodes:any[]=[],nodeByRef=new Map<string,any>(),seenRefs=new Set<string>();const add=async(t:string,l:string,s:any,ref:string,conf=100,sens=false)=>{seenRefs.add(ref);const n=await upNode(uid,t,l,s,ref,conf,sens);if(n){nodes.push(n);nodeByRef.set(ref,n)}return n};const prof=p?.[0];if(prof)await add('person',prof.display_name||'User',{home_region:prof.home_region,timezone:prof.timezone,currency:prof.preferred_currency,risk_posture:prof.risk_posture,attention_budget_minutes:prof.attention_budget_minutes},'profile');for(const x of g||[])await add('goal',x.title,{domain:x.domain,description:x.description,target_value:x.target_value,current_value:x.current_value,target_unit:x.target_unit,currency:x.currency,target_date:x.target_date,priority:x.priority},`goal:${x.id}`);for(const x of gc||[])await add('goal_contract','Goal Contract',{goal_id:x.goal_id,desired_state:x.desired_state,success_criteria:x.success_criteria,guardrails:x.guardrails,unacceptable_outcomes:x.unacceptable_outcomes,evidence_required:x.evidence_required,milestones:x.milestones,review_cadence:x.review_cadence,strategy_horizon:x.strategy_horizon},`goal_contract:${x.id}`);for(const x of b||[])await add('business',x.name,{industry:x.industry,description:x.description,primary_region:x.primary_region},`business:${x.id}`);for(const x of c||[])await add('capability',x.name,{category:x.category,proficiency:x.proficiency,evidence:x.evidence},`capability:${x.id}`);for(const x of k||[])await add('constraint',x.category||'Constraint',{description:x.description,severity:x.severity,metadata:x.metadata},`constraint:${x.id}`);for(const x of r||[])await add('resource',x.name,{category:x.category,description:x.description,monetary_value:x.monetary_value,currency:x.currency},`resource:${x.id}`);if(f?.[0]){const x=f[0];await add('finance','Financial State',{currency:x.currency,cash:x.cash,cash_equivalents:x.cash_equivalents,debt:x.debt,monthly_fixed_costs:x.monthly_fixed_costs,taxes_reserved:x.taxes_reserved,payroll_reserved:x.payroll_reserved,emergency_reserve:x.emergency_reserve,operating_reserve:x.operating_reserve,deployable_capital:x.deployable_capital,net_worth:x.net_worth,captured_at:x.captured_at},`finance:${x.id}`,100,true)}for(const x of oc||[])await add('opportunity',x.title,{candidate_id:x.id,module_code:x.module_code,opportunity_type:x.opportunity_type,status:x.status,total_score:x.total_score,confidence_score:x.confidence_score,relevance_score:x.relevance_score,executability_score:x.executability_score,risk_score:x.risk_score,capital_required_low:x.capital_required_low,capital_required_high:x.capital_required_high,next_action:x.next_action},`candidate:${x.id}`,Number(x.confidence_score||70));
for(const x of cm||[])await add('commitment',x.title,{commitment_type:x.commitment_type,domain:x.domain,starts_at:x.starts_at,ends_at:x.ends_at,due_at:x.due_at,status:x.status,importance:x.importance,source_kind:x.source_kind,source_ref:x.source_ref},`commitment:${x.id}`,100,false);
for(const x of op||[])await add('operating_record',x.title,{candidate_id:x.candidate_id,business_id:x.business_id,customer:x.customer,service_type:x.service_type,location:x.location,stage:x.stage,quoted_value:x.quoted_value,contract_value:x.contract_value,estimated_direct_cost:x.estimated_direct_cost,actual_direct_cost:x.actual_direct_cost,estimated_margin_pct:x.estimated_margin_pct,actual_margin_pct:x.actual_margin_pct,estimator_hours:x.estimator_hours,quote_sent_at:x.quote_sent_at,won_at:x.won_at,lost_at:x.lost_at,completed_at:x.completed_at,source_kind:x.source_kind,source_ref:x.source_ref},`operating:${x.id}`,100,false);
for(const x of ds||[])await add('decision','Decision: '+String(x.action||'recorded'),{candidate_id:x.candidate_id,action:x.action,rationale:x.rationale,decided_at:x.decided_at,reasoning_run_id:x.reasoning_run_id},`decision:${x.id}`,100,false);
for(const x of pw||[]){const content=x.content||{};await add('prepared_work',content.headline||String(x.work_type||'Prepared work'),{work_type:x.work_type,status:x.status,operating_id:x.operating_id,candidate_id:x.candidate_id,source_updated_at:x.source_updated_at,created_at:x.created_at,kind:content.kind||null,action_status:content.action_status||null,recommendation:content.recommendation||null},`prepared_work:${x.id}`,100,false)}
for(const x of obs||[])await add('outcome_observation','Observed operating state',{operating_id:x.operating_id,candidate_id:x.candidate_id,decision_id:x.decision_id,event_type:x.event_type,observed_at:x.observed_at,source_updated_at:x.source_updated_at,facts:x.facts,source_kind:x.source_kind,source_ref:x.source_ref},`outcome_observation:${x.id}`,100,false);
for(const x of ss||[])await add('source_connection',String(x.source_kind||'Connected source'),{source_kind:x.source_kind,source_account:x.source_account,status:x.status,last_observed_at:x.last_observed_at,last_sync_at:x.last_sync_at,evidence_count:x.evidence_count,metadata:x.metadata||{}},`source_connection:${x.id}`,100,true);
for(const x of ra||[])await add('research_artifact','Research: '+String(x.question||'decision evidence'),{candidate_id:x.candidate_id,signal_id:x.signal_id,research_type:x.research_type,status:x.status,question:x.question,source_url:x.source_url,source_updated_at:x.source_updated_at,conclusion:x.conclusion,unresolved:x.unresolved,created_at:x.created_at},`research_artifact:${x.id}`,100,false);
let edges=0;
const personNode=nodeByRef.get('profile');
if(personNode){
  for(const x of g||[]){const n=nodeByRef.get(`goal:${x.id}`);if(n){await edge(uid,personNode.id,n.id,'has_goal',100,['Active goal is recorded for this user.']);edges++}}
  for(const x of b||[]){const n=nodeByRef.get(`business:${x.id}`);if(n){await edge(uid,personNode.id,n.id,'operates_business',100,['Active business is recorded for this user.']);edges++}}
  for(const x of c||[]){const n=nodeByRef.get(`capability:${x.id}`);if(n){await edge(uid,personNode.id,n.id,'has_capability',100,['Capability is recorded in the Personal Model.']);edges++}}
  for(const x of k||[]){const n=nodeByRef.get(`constraint:${x.id}`);if(n){await edge(uid,personNode.id,n.id,'has_constraint',100,['Constraint is recorded for this user.']);edges++}}
  for(const x of r||[]){const n=nodeByRef.get(`resource:${x.id}`);if(n){await edge(uid,personNode.id,n.id,'has_resource',100,['Resource or asset is recorded for this user.']);edges++}}
  if(f?.[0]){const n=nodeByRef.get(`finance:${f[0].id}`);if(n){await edge(uid,n.id,personNode.id,'financial_state_of',100,['Latest financial snapshot belongs to this user.']);edges++}}
  for(const x of cm||[]){const n=nodeByRef.get(`commitment:${x.id}`);if(n){await edge(uid,personNode.id,n.id,'has_commitment',100,['Commitment is recorded for this user.'],{domain:x.domain||null});edges++}}
  for(const x of op||[]){const n=nodeByRef.get(`operating:${x.id}`);if(n){await edge(uid,personNode.id,n.id,'tracks_operating_record',100,['Operating record belongs to this user.']);edges++}}
  for(const x of ss||[]){const n=nodeByRef.get(`source_connection:${x.id}`);if(n){await edge(uid,n.id,personNode.id,'evidence_source_for',100,['Connection is scoped to this user.'],{status:x.status});edges++}}
}
for(const contract of gc||[]){const cn=nodeByRef.get(`goal_contract:${contract.id}`),gn=nodeByRef.get(`goal:${contract.goal_id}`);if(cn&&gn){await edge(uid,cn.id,gn.id,'specifies',100,['Goal contract belongs to this goal.']);edges++}}const primary=(g||[]).sort((a:any,b:any)=>Number(a.priority)-Number(b.priority))[0],primaryNode=primary?nodeByRef.get(`goal:${primary.id}`):null;if(primaryNode)for(const x of oc||[]){const on=nodeByRef.get(`candidate:${x.id}`);if(on){await edge(uid,on.id,primaryNode.id,'advances_goal',Math.round((Number(x.strategic_fit_score||50)+Number(x.relevance_score||50))/2),[`Candidate strategic fit: ${x.strategic_fit_score}.`,`Candidate personal relevance: ${x.relevance_score}.`],{module_code:x.module_code});edges++}}for(const l of ol||[]){const a=nodeByRef.get(`candidate:${l.from_candidate_id}`),z=nodeByRef.get(`candidate:${l.to_candidate_id}`);if(a&&z){await edge(uid,a.id,z.id,l.relation_type,Number(l.confidence||70),Array.isArray(l.evidence)?l.evidence:[],{source:'opportunity_links'});edges++}}if(primaryNode)for(const x of c||[]){const n=nodeByRef.get(`capability:${x.id}`);if(n){await edge(uid,n.id,primaryNode.id,'supports_goal',70,[`Capability '${x.name}' is part of the current Personal Model.`]);edges++}}
for(const x of cm||[]){
  const cn=nodeByRef.get(`commitment:${x.id}`);
  if(cn&&x.domain){for(const goal of g||[]){if(String(goal.domain||'')===String(x.domain)){const gn=nodeByRef.get(`goal:${goal.id}`);if(gn){await edge(uid,cn.id,gn.id,'relates_to_goal',95,[`Commitment domain matches goal domain: ${x.domain}.`]);edges++}}}}
}
for(const x of op||[]){
  const on=nodeByRef.get(`operating:${x.id}`);
  const cand=x.candidate_id?nodeByRef.get(`candidate:${x.candidate_id}`):null;
  if(on&&cand){await edge(uid,on.id,cand.id,'realizes_candidate',100,['Operating record explicitly references this candidate.']);edges++}
  const bn=x.business_id?nodeByRef.get(`business:${x.business_id}`):null;
  if(on&&bn){await edge(uid,on.id,bn.id,'belongs_to_business',100,['Operating record explicitly references this business.']);edges++}
}
for(const x of ds||[]){
  const dn=nodeByRef.get(`decision:${x.id}`),cand=x.candidate_id?nodeByRef.get(`candidate:${x.candidate_id}`):null;
  if(dn&&cand){await edge(uid,dn.id,cand.id,'acts_on',100,['Decision explicitly references this candidate.']);edges++}
}
for(const x of pw||[]){
  const wn=nodeByRef.get(`prepared_work:${x.id}`);
  const on=x.operating_id?nodeByRef.get(`operating:${x.operating_id}`):null;
  const cand=x.candidate_id?nodeByRef.get(`candidate:${x.candidate_id}`):null;
  if(wn&&on){await edge(uid,wn.id,on.id,'prepares_for',100,['Prepared work explicitly references this operating record.']);edges++}
  else if(wn&&cand){await edge(uid,wn.id,cand.id,'prepares_for',100,['Prepared work explicitly references this candidate.']);edges++}
}
for(const x of ra||[]){
  const rn=nodeByRef.get(`research_artifact:${x.id}`),cand=x.candidate_id?nodeByRef.get(`candidate:${x.candidate_id}`):null;
  if(rn&&cand){await edge(uid,rn.id,cand.id,'investigates',100,['Research artifact explicitly references this candidate.'],{status:x.status});edges++}
}
for(const x of obs||[]){
  const en=nodeByRef.get(`outcome_observation:${x.id}`),on=nodeByRef.get(`operating:${x.operating_id}`);
  if(en&&on){await edge(uid,en.id,on.id,'observes',100,['Outcome observation was captured from this operating record.']);edges++}
  const dn=x.decision_id?nodeByRef.get(`decision:${x.decision_id}`):null;
  if(en&&dn){await edge(uid,en.id,dn.id,'observes_result_of',100,['Observation is explicitly linked to this decision.']);edges++}
}
const managedPrefixes=['goal:','goal_contract:','business:','capability:','constraint:','resource:','finance:','candidate:','commitment:','operating:','decision:','prepared_work:','outcome_observation:','source_connection:','research_artifact:'];
const currentNodes=(await R(`personal_graph_nodes?user_id=eq.${uid}&source_kind=eq.system_sync&valid_to=is.null&select=id,source_ref,node_type`))||[];
const closedAt=new Date().toISOString();let nodesClosed=0,edgesClosed=0;
for(const old of currentNodes){
  const ref=String(old.source_ref||'');
  const managed=ref==='profile'||managedPrefixes.some(p=>ref.startsWith(p));
  if(!managed||seenRefs.has(ref))continue;
  await R(`personal_graph_nodes?id=eq.${old.id}&user_id=eq.${uid}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({valid_to:closedAt,updated_at:closedAt})});nodesClosed++;
  for(const filter of [`from_node_id=eq.${old.id}`,`to_node_id=eq.${old.id}`]){
    const affected=(await R(`personal_graph_edges?user_id=eq.${uid}&valid_to=is.null&${filter}&select=id`))||[];
    if(affected.length){await R(`personal_graph_edges?user_id=eq.${uid}&valid_to=is.null&${filter}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({valid_to:closedAt,updated_at:closedAt})});edgesClosed+=affected.length}
  }
}
for(const n of nodes){if(n.source_ref==='profile')continue;const fc=n.node_type==='opportunity'?'inference':'personal_fact';await prov(uid,n.node_type,n.id,`${n.label}: ${JSON.stringify(n.state).slice(0,700)}`,fc,n.source_kind,n.source_ref,n.confidence)}
return J({ok:true,graph_version:'personal_graph_core_v4_research_memory',user_id:uid,nodes_synced:nodes.length,edges_synced:edges,nodes_closed:nodesClosed,edges_closed:edgesClosed,recent_changes:await R(`state_changes?user_id=eq.${uid}&select=*&order=detected_at.desc&limit=10`)})}catch(e){return J({error:String(e)},500)}});