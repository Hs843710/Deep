const SUPABASE_URL='https://filwikflcfkytajancpj.supabase.co';
const SUPABASE_KEY='sb_publishable_bqkvtp7tlMykMbYgBWNSoA_Uz4vlI9z';
let token=localStorage.getItem('pios_token')||'';
let currentCandidateId='';
let latestExperience=null;
let globeController=null;
let onboardingStep=0;
const onboardingAnswers={goal:'',region:'',capabilities:'',guardrails:'',attention:'30'};

const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=value=>Number(value||0);
const money=(value,currency='CAD')=>value==null?'—':Number(value).toLocaleString('en-CA',{style:'currency',currency,maximumFractionDigits:0});
const splitLines=value=>String(value||'').split(/\n+/).map(x=>x.trim()).filter(Boolean);
const splitFlexible=value=>String(value||'').split(/[\n,]+/).map(x=>x.trim()).filter(Boolean);
const valueOrNull=id=>$(id).value.trim()===''?null:Number($(id).value);
const validUrl=value=>/^https?:\/\//i.test(String(value||''));
const fmtDate=value=>{if(!value)return'';const d=new Date(value);return Number.isNaN(d.getTime())?'':d.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})};

function humanText(value){
  if(value==null)return'';
  if(typeof value==='string'||typeof value==='number'||typeof value==='boolean')return String(value);
  if(Array.isArray(value))return value.map(humanText).filter(Boolean).join(' · ');
  if(typeof value==='object'){
    const preferred=['title','description','text','rule','name','label','criterion','outcome','value','target'];
    for(const key of preferred)if(value[key]!=null&&typeof value[key]!=='object')return String(value[key]);
    const primitives=Object.entries(value).filter(([,v])=>v!=null&&typeof v!=='object').slice(0,3).map(([k,v])=>`${k.replaceAll('_',' ')}: ${v}`);
    return primitives.join(' · ');
  }
  return String(value);
}

async function api(path,options={}){
  const headers={apikey:SUPABASE_KEY,...(options.headers||{})};
  if(options.body)headers['Content-Type']='application/json';
  if(token)headers.Authorization=`Bearer ${token}`;
  const response=await fetch(`${SUPABASE_URL}${path}`,{...options,headers});
  const text=await response.text();let data={};
  try{data=text?JSON.parse(text):{}}catch{data={raw:text}}
  if(!response.ok)throw new Error(data.error_description||data.message||data.error||`HTTP ${response.status}`);
  return data;
}

function showToast(message){const t=$('toast');t.textContent=message;t.classList.remove('hidden');clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>t.classList.add('hidden'),3200)}
function openAuth(){$('authOverlay').classList.remove('hidden')}
function closeAuth(){$('authOverlay').classList.add('hidden')}
function openSettings(){$('settingsDrawer').classList.remove('hidden')}
function closeSettings(){$('settingsDrawer').classList.add('hidden')}
function openEvidence(){$('evidenceDrawer').classList.remove('hidden')}
function closeEvidence(){$('evidenceDrawer').classList.add('hidden')}
function openOnboarding(){onboardingStep=0;renderOnboarding();$('onboardingOverlay').classList.remove('hidden')}
function closeOnboarding(){$('onboardingOverlay').classList.add('hidden')}

async function signIn(){
  $('authMessage').textContent='Connecting…';
  try{const d=await api('/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify({email:$('email').value.trim(),password:$('password').value})});token=d.access_token;localStorage.setItem('pios_token',token);closeAuth();await bootConnected();showToast('PIOS connected.');}
  catch(e){$('authMessage').textContent=e.message}
}
async function signUp(){
  $('authMessage').textContent='Creating account…';
  try{const d=await api('/auth/v1/signup',{method:'POST',body:JSON.stringify({email:$('email').value.trim(),password:$('password').value})});if(d.access_token){token=d.access_token;localStorage.setItem('pios_token',token);closeAuth();await bootConnected()}else $('authMessage').textContent='Account created. Confirm your email if required, then sign in.';}
  catch(e){$('authMessage').textContent=e.message}
}
function signOut(){localStorage.removeItem('pios_token');sessionStorage.removeItem('pios_auto_review_done');token='';location.reload()}

function metricRow(label,value,invert=false){let v=Math.max(0,Math.min(100,num(value)));if(invert)v=100-v;return`<div class="barrow"><label>${esc(label)}</label><div class="bar"><i style="width:${v}%"></i></div><b>${Math.round(v)}</b></div>`}
function humanGoal(goal){if(!goal)return'Build a stronger future with better decisions.';if(typeof goal==='string')return goal;return humanText(goal.title||goal.description||goal)||'Improve my economic position'}

function renderExperience(d){
  latestExperience=d;
  const strategy=d.strategy||{},move=strategy.next_best_move||{},why=d.why_number_one||{},metrics=why.metrics||{},impact=d.personal_model_impact||{},health=d.quality_health||{},comparison=d.comparison||{};
  currentCandidateId=move.candidate_id||'';
  $('engineChip').textContent=String(health.strategy_core||strategy.engine||'STRATEGY CORE').replaceAll('_',' ').toUpperCase();
  $('decisionLabel').textContent=move.decision||'DO NOTHING';
  $('moveTitle').textContent=move.title||'No move currently clears the strategy threshold.';
  $('moveWhy').textContent=humanText(move.why||move.action)||'PIOS is preserving your capital, time and attention until a stronger option appears.';
  const reasoning=move.reasoning||{},robust=reasoning.robustness?.score,cf=move.cognition||{}; $('moveMetrics').innerHTML=robust!=null?metricRow('Decision robustness',robust)+metricRow('Confidence',move.confidence??metrics.confidence)+metricRow('Information value',cf.information_value??0)+metricRow('Reversibility',cf.reversibility??0)+metricRow('Urgency',cf.urgency??metrics.timing)+metricRow('Opportunity cost',cf.opportunity_cost??0,true):metrics&&Object.keys(metrics).length?metricRow('Relevance',metrics.relevance)+metricRow('Confidence',metrics.confidence)+metricRow('Executability',metrics.executability)+metricRow('Strategic fit',metrics.strategic_fit)+metricRow('Risk safety',metrics.risk,true)+metricRow('Capital efficiency',metrics.capital_burden,true):'<div class="empty-copy">No decision metrics currently available.</div>';
  $('moveActions').innerHTML=currentCandidateId?`<button class="btn" data-decision="investigate">Investigate</button><button class="btn" data-decision="watch">Watch</button><button class="btn primary" data-decision="approve">Do This</button><button class="btn" data-decision="reject">Reject</button><button class="btn ghost" id="evidenceBtn">Evidence</button>`:'';
  document.querySelectorAll('[data-decision]').forEach(btn=>btn.onclick=()=>recordDecision(btn.dataset.decision));
  if($('evidenceBtn'))$('evidenceBtn').onclick=explainDecision;

  const goal=impact.goal||{};$('goalTitle').textContent=humanGoal(goal);
  const guardrails=[...(impact.guardrails||[]),...(impact.unacceptable_outcomes||[])].map(humanText).filter(Boolean);
  $('goalSummary').textContent=guardrails.length?`PIOS is protecting: ${guardrails.slice(0,3).join(' · ')}`:'PIOS is comparing world changes against this desired future.';
  $('goalChip').textContent=goal&&typeof goal==='object'&&goal.domain?String(goal.domain).replaceAll('_',' ').toUpperCase():'GOAL';
  $('strategyDelta').textContent=comparison.summary||'No previous strategy snapshot yet.';
  $('deployableCapital').textContent=money(impact.deployable_capital,impact.currency||'CAD');
  $('protectedCapital').textContent=money(impact.protected_amount,impact.currency||'CAD');
  $('riskPosture').textContent=(impact.risk_posture||'—').toUpperCase();
  $('attentionBudget').textContent=impact.attention_budget_minutes?`${impact.attention_budget_minutes}m`:'—';

  const changes=d.what_changed||[];$('changeCount').textContent=changes.length;
  $('changesList').innerHTML=changes.length?changes.slice(0,5).map(x=>`<div class="activity-row"><div><b>${esc(String(x.entity_type||'state').replaceAll('_',' '))} · ${esc(String(x.change_type||'changed').replaceAll('_',' '))}</b><small>${x.domain?esc(String(x.domain).replaceAll('_',' '))+' · ':''}${x.detected_at?esc(fmtDate(x.detected_at)):''}</small></div><span class="score">${Math.round(num(x.materiality))}</span></div>`).join(''):'<div class="empty-copy">No material Personal Graph changes in the latest comparison.</div>';

  const seq=strategy.sequence?.steps||[];
  $('sequence').innerHTML=seq.length?seq.slice(0,4).map((x,i)=>`<div class="seq-step"><div class="n">${i===0?'NOW':i===1?'NEXT':'LATER'}</div><b>${esc(humanText(x.title||x.label||'Step'))}</b><div class="muted">${esc(humanText(x.action||''))}</div></div>`).join(''):'<div class="empty-copy">No multi-step dependency chain is required for the current move.</div>';

  const alternatives=d.alternatives||[];$('altCount').textContent=alternatives.length;
  $('alternatives').innerHTML=alternatives.length?alternatives.slice(0,4).map(a=>`<div class="alt-row"><div><b>${esc(humanText(a.title))}</b><small>${esc(String(a.module_code||'').replaceAll('_',' '))}${a.why_lower?.length?' · '+esc(humanText(a.why_lower[0])):''}</small></div><div class="score">${Math.round(num(a.score))}</div></div>`).join(''):'<div class="empty-copy">No close alternatives surfaced.</div>';

  $('qualityGate').textContent=health.release_gate||'PENDING';$('qualityGate').className='chip '+(health.release_gate==='PASS'?'good':health.release_gate==='FAIL'?'bad':'warn');
  $('signalsSeen').textContent=num(d.activity?.since_previous?.signals_seen).toLocaleString();
  $('screenedOut').textContent=(num(d.screened_out?.rejected_or_nonmaterial)+num(d.screened_out?.watch_only)).toLocaleString();
  $('evidenceScore').textContent=d.evidence?.quality?.score==null?'—':d.evidence.quality.score;
  $('benchScore').textContent=health.active_cases?`${health.passed}/${health.active_cases}`:'—';
  $('healthNote').textContent=health.release_gate==='PASS'?`All ${health.active_cases} active benchmark cases currently pass.`:health.release_gate==='FAIL'?`${health.failed||0} benchmark regression detected; ${health.untested||0} case(s) remain untested. PIOS should not be treated as release-clean yet.`:`${health.passed||0} passed · ${health.failed||0} failed · ${health.untested||0} untested of ${health.active_cases||0}.`;

  const funnel=d.signal_funnel||{};
  $('funnelSignals').textContent=num(funnel.scanner_signals_since_previous).toLocaleString();
  $('funnelCandidates').textContent=num(funnel.candidates_considered).toLocaleString();
  $('funnelMaterial').textContent=num(funnel.material_candidates).toLocaleString();
  $('funnelScreened').textContent=num(funnel.screened_out).toLocaleString();
  $('funnelSurfaced').textContent=num(funnel.surfaced).toLocaleString();

  const worldSignals=d.world_signals||[];const mapped=worldSignals.filter(s=>s.lat!=null&&s.long!=null);const unresolved=worldSignals.length-mapped.length;
  $('mappedSignalBadge').textContent=mapped.length?`${mapped.length} PERSONALIZED MAP SIGNAL${mapped.length===1?'':'S'}`:'NO MAPPABLE PERSONAL SIGNALS';
  $('unmappedSignalBadge').textContent=`${unresolved} global / unresolved signal${unresolved===1?'':'s'}`;
  $('globeStatus').textContent=worldSignals.length?`${worldSignals.length} evidence-backed personalized world signals loaded`:'No personalized world signal currently clears the map feed.';
  if(globeController)globeController.setSignals(worldSignals);
  if(worldSignals.length)showSignal(mapped[0]||worldSignals[0]);

  if(typeof window.updatePiosStrategy==='function')window.updatePiosStrategy(move);
  const activity=d.activity?.runs||[];
  if(activity.length){const items=activity.slice(0,6).map(x=>`<span><b>${esc(humanText(x.engine||x.trigger||'Intelligence run'))}</b> · ${num(x.signals_seen).toLocaleString()} signals · ${num(x.candidates_created)} candidates · ${esc(x.status||'')}</span>`);$('tickerTrack').innerHTML=items.concat(items).join('')}
}

function showSignal(signal){
  if(!signal)return;
  $('signalTitle').textContent=humanText(signal.title)||'World signal';
  const loc=[signal.locality,signal.region].filter(Boolean).join(', ')||'Global / unresolved location';
  const bits=[String(signal.module_code||signal.signal_type||'signal').replaceAll('_',' '),loc,`relevance ${Math.round(num(signal.relevance_score))}`,`confidence ${Math.round(num(signal.confidence_score))}`];
  $('signalMeta').textContent=bits.join(' · ');
  $('signalSummary').textContent=humanText(signal.summary)||'No summary available. Open the source evidence for details.';
  const link=$('signalSource');if(validUrl(signal.source_url)){link.href=signal.source_url;link.classList.remove('hidden')}else link.classList.add('hidden');
}

async function loadExperience(){const d=await api('/functions/v1/intelligence-experience');renderExperience(d);return d}

function opStatusMeta(status){switch(status){case'pilot':return{label:'LIVE PILOT',cls:'live'};case'framework_ready':return{label:'FRAMEWORK',cls:'framework'};case'planned':return{label:'PLANNED',cls:'planned'};default:return{label:String(status||'UNKNOWN').replaceAll('_',' ').toUpperCase(),cls:'planned'}}}
async function loadModules(){
  try{const d=await api('/functions/v1/intelligence-router',{method:'POST',body:'{}'});const rows=[...(d.active||[]),...(d.watch||[])];$('moduleCount').textContent=rows.length;
    $('moduleList').innerHTML=rows.length?rows.slice(0,7).map(x=>{const op=opStatusMeta(x.operational_status);const relevance=x.status==='active'?'RELEVANT':'WATCH';return`<div class="module-row"><div><b>${esc(relevance)} · ${esc(x.name)}</b><small>${esc(humanText(x.reason))}</small></div><span class="op-status ${op.cls}">${op.label}</span></div>`}).join(''):'<div class="empty-copy">No intelligence domain is currently relevant enough to activate.</div>';
  }catch(e){$('moduleList').innerHTML=`<div class="empty-copy">${esc(e.message)}</div>`}
}

async function loadModel(){
  const d=await api('/functions/v1/personal-model');const m=d.model||{},p=m.profile||{},g=(m.goals||[])[0]||{},f=m.financial_snapshot||{};
  $('displayName').value=p.display_name||'';$('homeRegion').value=p.home_region||'';$('primaryGoal').value=g.title||'';$('riskSelect').value=p.risk_posture||'balanced';$('attentionInput').value=p.attention_budget_minutes||30;
  $('focusAreas').value=(m.focus_areas||[]).filter(x=>x.active!==false).map(x=>x.name).join('\n');$('capabilities').value=(m.capabilities||[]).filter(x=>x.active!==false).map(x=>x.name).join('\n');$('constraints').value=(m.constraints||[]).map(x=>x.description).join('\n');
  $('cash').value=f.cash??'';$('taxesReserved').value=f.taxes_reserved??'';$('payrollReserved').value=f.payroll_reserved??'';$('emergencyReserve').value=f.emergency_reserve??'';$('operatingReserve').value=f.operating_reserve??'';$('debt').value=f.debt??'';
  return m;
}

async function saveSettings(){
  $('settingsMessage').textContent='Saving and recalculating…';
  try{const hasFinance=['cash','taxesReserved','payrollReserved','emergencyReserve','operatingReserve','debt'].some(id=>$(id).value.trim()!=='');const payload={profile:{display_name:$('displayName').value.trim()||null,home_region:$('homeRegion').value.trim()||null,risk_posture:$('riskSelect').value,attention_budget_minutes:Number($('attentionInput').value||30),preferred_currency:'CAD',timezone:'America/Edmonton',onboarding_complete:true},primary_goal:{title:$('primaryGoal').value.trim()||'Improve my economic position',domain:'general',currency:'CAD'},focus_areas:splitFlexible($('focusAreas').value).map((name,i)=>({name,priority:Math.min(5,i+1),active:true})),replace_focus_areas:true,capabilities:splitFlexible($('capabilities').value).map(name=>({name,category:'general',proficiency:4})),replace_capabilities:true,constraints:splitLines($('constraints').value).map(description=>({category:/debt|reserve|capital/i.test(description)?'financial':'general',description,severity:5})),replace_constraints:true};if(hasFinance)payload.financial_snapshot={currency:'CAD',cash:valueOrNull('cash'),taxes_reserved:valueOrNull('taxesReserved'),payroll_reserved:valueOrNull('payrollReserved'),emergency_reserve:valueOrNull('emergencyReserve'),operating_reserve:valueOrNull('operatingReserve'),debt:valueOrNull('debt'),source:'manual'};await api('/functions/v1/personal-model',{method:'POST',body:JSON.stringify(payload)});await api('/functions/v1/goal-contract',{method:'POST',body:'{}'});await runIntelligence();$('settingsMessage').textContent='Saved. Strategy recalculated.';closeSettings();}
  catch(e){$('settingsMessage').textContent=e.message}
}

async function runIntelligence(){
  $('refreshBtn').textContent='Working…';$('refreshBtn').disabled=true;
  try{await api('/functions/v1/universal-orchestrate',{method:'POST',body:'{}'});await Promise.all([loadExperience(),loadModules(),loadModel()]);showToast('PIOS intelligence refreshed.');}
  catch(e){showToast(`Run failed: ${e.message}`)}finally{$('refreshBtn').textContent='Recheck now';$('refreshBtn').disabled=false}
}

async function recordDecision(action){
  if(!currentCandidateId)return;
  try{await api('/functions/v1/decision-memory',{method:'POST',body:JSON.stringify({candidate_id:currentCandidateId,action})});await api('/functions/v1/portfolio-synthesis',{method:'POST',body:'{}'});await api('/functions/v1/strategy-brief',{method:'POST',body:'{}'});await loadExperience();showToast(`Decision recorded: ${String(action).toUpperCase()}`)}catch(e){showToast(e.message)}
}

function evidenceList(title,items,kind='text'){
  const rows=(items||[]).filter(Boolean);if(!rows.length)return'';
  const html=rows.slice(0,12).map(item=>{if(typeof item==='string')return`<div class="evidence-item">${esc(item)}</div>`;const claim=humanText(item.claim||item.statement||item.description||item);const link=validUrl(item.source_url)?` <a href="${esc(item.source_url)}" target="_blank" rel="noopener noreferrer">source ↗</a>`:'';const confidence=item.confidence!=null?` · ${Math.round(num(item.confidence))}% confidence`:'';return`<div class="evidence-item">${esc(claim)}${esc(confidence)}${link}</div>`}).join('');return`<section class="evidence-block"><h3>${esc(title)}</h3>${html}</section>`;
}
async function explainDecision(){
  if(!currentCandidateId)return;openEvidence();$('evidenceContent').innerHTML='<div class="empty-copy">Tracing evidence…</div>';
  try{const d=await api('/functions/v1/explain-decision',{method:'POST',body:JSON.stringify({candidate_id:currentCandidateId})});const x=d.explanation||{};let html='';html+=evidenceList('Personal facts',x.personal_facts);html+=evidenceList('External facts',x.external_facts);html+=evidenceList('AI inference',x.inferences);html+=evidenceList('Assumptions',x.assumptions);html+=evidenceList('Unknowns',x.unknowns);html+=evidenceList('Goal guardrails',(x.guardrails||[]).map(humanText));if(x.capital_firewall){html+=`<section class="evidence-block"><h3>Capital firewall</h3><div class="evidence-item">Liquid ${esc(money(x.capital_firewall.liquid,x.capital_firewall.currency||'CAD'))} · protected ${esc(money(x.capital_firewall.protected,x.capital_firewall.currency||'CAD'))} · deployable ${esc(money(x.capital_firewall.deployable,x.capital_firewall.currency||'CAD'))}</div></section>`}html+=evidenceList('What would change this recommendation',x.what_would_change_the_recommendation);$('evidenceContent').innerHTML=html||'<div class="empty-copy">No evidence trace available.</div>';}
  catch(e){$('evidenceContent').innerHTML=`<div class="empty-copy">${esc(e.message)}</div>`}
}

const ONBOARDING=[
  {key:'goal',question:'What future are you trying to create?',hint:'Describe the outcome you actually care about. PIOS will use this as direction, not as permission to take reckless shortcuts.',placeholder:'Example: Increase my income, build a strong business and create long-term financial security.'},
  {key:'region',question:'Where should PIOS anchor your current situation?',hint:'A city, province/state and country is enough. Precise location is not required.',placeholder:'Example: Calgary, Alberta, Canada'},
  {key:'capabilities',question:'What can you already do or use?',hint:'List skills, experience, credentials, businesses, equipment or other capabilities. Separate them with commas or new lines.',placeholder:'Example: construction estimating, concrete cutting, sales, project coordination'},
  {key:'guardrails',question:'What must PIOS protect or avoid?',hint:'These are hard constraints: debt you do not want, reserves that must remain untouched, time limits, risk boundaries or unacceptable outcomes.',placeholder:'Example: do not risk emergency savings; avoid high-interest debt; keep at least 30 hours/week for current work'},
  {key:'attention',question:'How much attention can you realistically give PIOS each day?',hint:'This helps the Attention Shield avoid overwhelming you. Enter minutes per day.',placeholder:'30'}
];
function renderOnboarding(){
  const step=ONBOARDING[onboardingStep];$('onboardingQuestion').textContent=step.question;$('onboardingHint').textContent=step.hint;$('onboardingInput').placeholder=step.placeholder;$('onboardingInput').value=onboardingAnswers[step.key]||'';$('onboardingStepLabel').textContent=`${onboardingStep+1} / ${ONBOARDING.length}`;$('onboardingProgress').style.width=`${((onboardingStep+1)/ONBOARDING.length)*100}%`;$('onboardingBackBtn').disabled=onboardingStep===0;$('onboardingNextBtn').textContent=onboardingStep===ONBOARDING.length-1?'Build My Personal Model':'Continue';setTimeout(()=>$('onboardingInput').focus(),50)
}
async function onboardingNext(){
  const step=ONBOARDING[onboardingStep],value=$('onboardingInput').value.trim();if(!value&&step.key!=='guardrails'){showToast('Please give PIOS enough information to continue.');return}onboardingAnswers[step.key]=value;
  if(onboardingStep<ONBOARDING.length-1){onboardingStep++;renderOnboarding();return}
  $('onboardingNextBtn').disabled=true;$('onboardingNextBtn').textContent='Building…';
  try{const attention=Math.max(5,Math.min(240,Number(onboardingAnswers.attention||30)||30));const payload={profile:{display_name:null,home_region:onboardingAnswers.region||null,risk_posture:'balanced',attention_budget_minutes:attention,preferred_currency:'CAD',timezone:'America/Edmonton',onboarding_complete:true},primary_goal:{title:onboardingAnswers.goal||'Improve my future',domain:'general',currency:'CAD'},capabilities:splitFlexible(onboardingAnswers.capabilities).map(name=>({name,category:'general',proficiency:4})),replace_capabilities:true,constraints:splitLines(onboardingAnswers.guardrails).map(description=>({category:/debt|reserve|capital|cash|money/i.test(description)?'financial':'general',description,severity:5})),replace_constraints:true};await api('/functions/v1/personal-model',{method:'POST',body:JSON.stringify(payload)});await api('/functions/v1/goal-contract',{method:'POST',body:'{}'});closeOnboarding();await runIntelligence();showToast('Personal Model created. PIOS is now personalized.');}
  catch(e){showToast(`Setup failed: ${e.message}`)}finally{$('onboardingNextBtn').disabled=false;$('onboardingNextBtn').textContent='Build My Personal Model'}
}
function onboardingBack(){if(onboardingStep===0)return;onboardingAnswers[ONBOARDING[onboardingStep].key]=$('onboardingInput').value.trim();onboardingStep--;renderOnboarding()}

async function autoReviewConnected(){
  if(sessionStorage.getItem('pios_auto_review_done')==='1'||!localStorage.getItem('pios_token'))return;
  sessionStorage.setItem('pios_auto_review_done','1');
  const pill=$('connectionStatus'),previous=pill?.textContent||'PERSONAL MODEL CONNECTED';
  if(pill)pill.textContent='REVIEWING PERSONAL STATE';
  try{
    await api('/functions/v1/universal-orchestrate',{method:'POST',body:'{}'});
    await Promise.all([loadExperience(),loadModules(),loadModel()]);
    if(typeof window.loadLifeTwin==='function')setTimeout(()=>window.loadLifeTwin(),120);
  }catch(_){
    // Keep the last verified model visible. Failed refresh is not equivalent to no intelligence.
  }finally{if(pill&&localStorage.getItem('pios_token'))pill.textContent=previous}
}
async function bootConnected(){
  try{
    await api('/auth/v1/user');
    $('connectionStatus').textContent='PERSONAL MODEL CONNECTED';$('connectionStatus').classList.add('good');
    $('authBtn').textContent='Connected';$('authBtn').onclick=openSettings;
    $('refreshBtn').classList.remove('hidden');$('settingsBtn').classList.remove('hidden');
    const model=await loadModel();if(!model.profile){openOnboarding();return}
    await Promise.all([loadExperience(),loadModules()]);
    setTimeout(autoReviewConnected,500);
  }catch(e){localStorage.removeItem('pios_token');token='';setVisualMode()}
}
function setVisualMode(){$('connectionStatus').textContent='VISUAL MODE';$('connectionStatus').classList.remove('good');$('authBtn').textContent='Connect';$('authBtn').onclick=openAuth;$('refreshBtn').classList.add('hidden');$('settingsBtn').classList.add('hidden');$('globeStatus').textContent='Rotating Earth active · connect to load personalized signals';if(globeController)globeController.setSignals([]);if(typeof window.updatePiosPresence==='function')window.updatePiosPresence({council:null,personalValue:null,asOf:null})}

function initFallbackGlobe(){
  const svg=$('globe');if(!svg)return{setSignals(){}};
  svg.setAttribute('viewBox','0 0 700 700');
  svg.innerHTML=`<defs><radialGradient id="fallbackGlow"><stop offset="0%" stop-color="#0a4053"/><stop offset="72%" stop-color="#031726"/><stop offset="100%" stop-color="#020b13"/></radialGradient></defs>
    <circle cx="350" cy="350" r="287" fill="url(#fallbackGlow)" stroke="#36daf2" stroke-width="2"/>
    <g fill="none" stroke="#0f5368" stroke-width="1" opacity=".72">
      <ellipse cx="350" cy="350" rx="287" ry="92"/><ellipse cx="350" cy="350" rx="287" ry="178"/>
      <ellipse cx="350" cy="350" rx="92" ry="287"/><ellipse cx="350" cy="350" rx="178" ry="287"/>
      <path d="M64 350h572M350 63v574"/>
    </g>
    <g fill="#0a4053" stroke="#2ed5eb" stroke-width="2" opacity=".96">
      <path d="M170 210l48-38 71 8 39 34-22 28-41 7-26 37-51-11-35-32z"/>
      <path d="M280 315l37 10 22 40-18 64-30 58-26-21 8-61-24-49z"/>
      <path d="M366 193l59-24 86 17 48 41-19 34-67 8-37 34-53-15-24-46z"/>
      <path d="M410 303l54 5 50 44-12 74-45 64-32-21 8-54-28-53z"/>
      <path d="M525 438l45-7 35 25-9 32-47 11-27-27z"/>
    </g>
    <circle cx="350" cy="350" r="298" fill="none" stroke="#2fe7ff" stroke-width="1" opacity=".35"/>`;
  $('globeStatus').textContent='Digital Earth fallback active · intelligence remains available';
  return{setSignals(){}};
}

function initGlobe(){
  if(typeof d3==='undefined')return initFallbackGlobe();
  const svg=d3.select('#globe'),W=700,H=700;svg.attr('viewBox',`0 0 ${W} ${H}`);
  const projection=d3.geoOrthographic().translate([W/2,H/2]).scale(288).clipAngle(90).precision(.35);const path=d3.geoPath(projection);const root=svg.append('g');
  const sphere=root.append('path').datum({type:'Sphere'}).attr('class','sphere');const graticule=root.append('path').datum(d3.geoGraticule10()).attr('class','graticule');const landPath=root.append('path').attr('class','land');const signalLayer=root.append('g');let land=null,signals=[],angle=-35,tilt=-17,last=performance.now(),dragging=false;
  fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json').then(r=>r.json()).then(world=>{land=topojson.feature(world,world.objects.countries);landPath.datum(land)}).catch(()=>{$('globeStatus').textContent='Earth outline network layer unavailable; PIOS intelligence remains online'});
  function visible(d){try{const center=projection.invert([W/2,H/2]);return d3.geoDistance([Number(d.long),Number(d.lat)],center)<Math.PI/2}catch{return false}}
  function refreshSignals(){const points=signals.filter(s=>s.lat!=null&&s.long!=null);const dots=signalLayer.selectAll('circle.signal-dot').data(points,d=>d.id);dots.exit().remove();dots.enter().append('circle').attr('class','signal-dot').attr('r',3.6).on('click',(event,d)=>showSignal(d));const rings=signalLayer.selectAll('circle.signal-ring').data(points,d=>d.id);rings.exit().remove();rings.enter().append('circle').attr('class','signal-ring').attr('r',8).on('click',(event,d)=>showSignal(d));}
  function draw(now){const dt=Math.min(50,now-last);last=now;if(!dragging)angle+=dt*.0045;projection.rotate([angle,tilt,0]);sphere.attr('d',path);graticule.attr('d',path);if(land)landPath.attr('d',path);const phase=(now/900)%1;signalLayer.selectAll('circle.signal-dot').attr('cx',d=>projection([d.long,d.lat])?.[0]??-100).attr('cy',d=>projection([d.long,d.lat])?.[1]??-100).style('display',d=>visible(d)?null:'none');signalLayer.selectAll('circle.signal-ring').attr('cx',d=>projection([d.long,d.lat])?.[0]??-100).attr('cy',d=>projection([d.long,d.lat])?.[1]??-100).attr('r',8+phase*10).style('opacity',.65*(1-phase)).style('display',d=>visible(d)?null:'none');requestAnimationFrame(draw)}
  svg.call(d3.drag().on('start',()=>{dragging=true}).on('drag',event=>{angle+=event.dx*.25;tilt=Math.max(-55,Math.min(45,tilt-event.dy*.18))}).on('end',()=>{dragging=false}));
  requestAnimationFrame(draw);
  return{setSignals(rows){signals=Array.isArray(rows)?rows:[];refreshSignals()}};
}

function bindEvents(){
  $('signInBtn').onclick=signIn;$('signUpBtn').onclick=signUp;$('closeAuthBtn').onclick=closeAuth;$('settingsBtn').onclick=openSettings;$('closeSettingsBtn').onclick=closeSettings;$('saveSettingsBtn').onclick=saveSettings;$('signOutBtn').onclick=signOut;$('refreshBtn').onclick=runIntelligence;$('closeEvidenceBtn').onclick=closeEvidence;$('onboardingNextBtn').onclick=onboardingNext;$('onboardingBackBtn').onclick=onboardingBack;
  $('authOverlay').addEventListener('click',e=>{if(e.target===$('authOverlay'))closeAuth()});
  $('onboardingInput').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&onboardingStep===4){e.preventDefault();onboardingNext()}});
}

async function init(){globeController=initGlobe();bindEvents();if(token)await bootConnected();else setVisualMode()}
init();
