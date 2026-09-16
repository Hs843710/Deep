const SUPABASE_URL = 'https://filwikflcfkytajancpj.supabase.co';
const SUPABASE_KEY = 'sb_publishable_bqkvtp7tlMykMbYgBWNSoA_Uz4vlI9z';
let token = localStorage.getItem('pios_token') || '';
let currentCandidateId = '';

const $ = (id) => document.getElementById(id);
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num = (value) => Number(value || 0);
const money = (value, currency='CAD') => value == null ? '—' : Number(value).toLocaleString('en-CA',{style:'currency',currency,maximumFractionDigits:0});
const lines = (id) => $(id).value.split(/\n+/).map(x=>x.trim()).filter(Boolean);

async function api(path, options={}) {
  const headers = { apikey: SUPABASE_KEY, ...(options.headers || {}) };
  if (options.body) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${SUPABASE_URL}${path}`, {...options, headers});
  const text = await response.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = {raw:text}; }
  if (!response.ok) throw new Error(data.error_description || data.message || data.error || `HTTP ${response.status}`);
  return data;
}

function showToast(message) {
  const t = $('toast'); t.textContent = message; t.classList.remove('hidden');
  clearTimeout(showToast.timer); showToast.timer = setTimeout(()=>t.classList.add('hidden'), 3200);
}

function openAuth(){ $('authOverlay').classList.remove('hidden'); }
function closeAuth(){ $('authOverlay').classList.add('hidden'); }
function openSettings(){ $('settingsDrawer').classList.remove('hidden'); }
function closeSettings(){ $('settingsDrawer').classList.add('hidden'); }

async function signIn(){
  $('authMessage').textContent = 'Connecting…';
  try {
    const d = await api('/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify({email:$('email').value.trim(),password:$('password').value})});
    token = d.access_token; localStorage.setItem('pios_token',token); closeAuth(); await bootConnected(); showToast('PIOS connected.');
  } catch(e){ $('authMessage').textContent = e.message; }
}
async function signUp(){
  $('authMessage').textContent = 'Creating account…';
  try {
    const d = await api('/auth/v1/signup',{method:'POST',body:JSON.stringify({email:$('email').value.trim(),password:$('password').value})});
    if(d.access_token){token=d.access_token;localStorage.setItem('pios_token',token);closeAuth();await bootConnected();}
    else $('authMessage').textContent='Account created. Confirm your email if required, then sign in.';
  } catch(e){ $('authMessage').textContent=e.message; }
}
function signOut(){ localStorage.removeItem('pios_token'); token=''; location.reload(); }

function metricRow(label,value,invert=false){
  let v=Math.max(0,Math.min(100,num(value))); if(invert) v=100-v;
  return `<div class="barrow"><label>${esc(label)}</label><div class="bar"><i style="width:${v}%"></i></div><b>${Math.round(v)}</b></div>`;
}

function humanGoal(goal){
  if(!goal) return 'Build a stronger future with better decisions.';
  if(typeof goal==='string') return goal;
  return goal.title || goal.description || 'Improve my economic position';
}

function renderExperience(d){
  const strategy=d.strategy||{}, move=strategy.next_best_move||{}, why=d.why_number_one||{}, metrics=why.metrics||{}, impact=d.personal_model_impact||{}, health=d.quality_health||{};
  currentCandidateId=move.candidate_id||'';
  $('engineChip').textContent=(health.strategy_core||strategy.engine||'STRATEGY CORE').replaceAll('_',' ').toUpperCase();
  $('decisionLabel').textContent=move.decision||'DO NOTHING';
  $('moveTitle').textContent=move.title||'No move currently clears the strategy threshold.';
  $('moveWhy').textContent=move.why||move.action||'PIOS is preserving your capital, time and attention until a stronger option appears.';
  $('moveMetrics').innerHTML = metricRow('Relevance',metrics.relevance)+metricRow('Confidence',metrics.confidence)+metricRow('Executability',metrics.executability)+metricRow('Strategic fit',metrics.strategic_fit)+metricRow('Risk safety',metrics.risk,true)+metricRow('Capital efficiency',metrics.capital_burden,true);
  $('moveActions').innerHTML=currentCandidateId?`<button class="btn" data-decision="investigate">Investigate</button><button class="btn" data-decision="watch">Watch</button><button class="btn primary" data-decision="approve">Do This</button><button class="btn" data-decision="reject">Reject</button>`:'';
  document.querySelectorAll('[data-decision]').forEach(btn=>btn.onclick=()=>recordDecision(btn.dataset.decision));

  const goal=impact.goal||{};
  $('goalTitle').textContent=humanGoal(goal);
  const guardrails=[...(impact.guardrails||[]),...(impact.unacceptable_outcomes||[])];
  $('goalSummary').textContent=guardrails.length?`Guardrails: ${guardrails.slice(0,3).join(' · ')}`:'PIOS is comparing world changes against this desired future.';
  $('goalChip').textContent=goal.domain?String(goal.domain).replaceAll('_',' ').toUpperCase():'GOAL';
  $('deployableCapital').textContent=money(impact.deployable_capital,impact.currency||'CAD');
  $('protectedCapital').textContent=money(impact.protected_amount,impact.currency||'CAD');
  $('riskPosture').textContent=(impact.risk_posture||'—').toUpperCase();
  $('attentionBudget').textContent=impact.attention_budget_minutes?`${impact.attention_budget_minutes}m`:'—';

  const changes=d.what_changed||[]; $('changeCount').textContent=changes.length;
  $('changesList').innerHTML=changes.length?changes.slice(0,5).map(x=>`<div class="activity-row"><div><b>${esc(x.entity_type)} · ${esc(x.change_type)}</b><small>Materiality ${esc(x.materiality)}</small></div><span class="score">${esc(x.materiality)}</span></div>`).join(''):'No material Personal Graph changes in the latest comparison.';

  const seq=strategy.sequence?.steps||[];
  $('sequence').innerHTML=seq.length?seq.map((x,i)=>`<div class="seq-step"><div class="n">${i===0?'NOW':i===1?'NEXT':'LATER'}</div><b>${esc(x.title||x.label||'Step')}</b><div class="subtle">${esc(x.action||'')}</div></div>`).join(''):'<div class="subtle">No multi-step dependency chain is required for the current move.</div>';

  const alternatives=d.alternatives||[]; $('altCount').textContent=alternatives.length;
  $('alternatives').innerHTML=alternatives.length?alternatives.slice(0,4).map(a=>`<div class="alt"><div><b>${esc(a.title)}</b><small>${esc(a.module_code||'')} ${a.why_lower?.length?'· '+esc(a.why_lower[0]):''}</small></div><div class="score">${esc(a.score)}</div></div>`).join(''):'No close alternatives surfaced.';

  $('qualityGate').textContent=health.release_gate||'PENDING'; $('qualityGate').className='chip '+(health.release_gate==='PASS'?'good':health.release_gate==='FAIL'?'bad':'warn');
  $('signalsSeen').textContent=(d.activity?.since_previous?.signals_seen||0).toLocaleString();
  $('screenedOut').textContent=((d.screened_out?.rejected_or_nonmaterial||0)+(d.screened_out?.watch_only||0)).toLocaleString();
  $('evidenceScore').textContent=d.evidence?.quality?.score==null?'—':d.evidence.quality.score;
  $('benchScore').textContent=health.active_cases?`${health.passed}/${health.active_cases}`:'—';

  const activity=d.activity?.runs||[];
  if(activity.length){
    $('tickerTrack').innerHTML=activity.slice(0,6).map(x=>`<span><b>${esc(x.engine||x.trigger||'Intelligence run')}</b> · ${num(x.signals_seen).toLocaleString()} signals · ${num(x.candidates_created)} candidates</span>`).join('') + activity.slice(0,6).map(x=>`<span><b>${esc(x.engine||x.trigger||'Intelligence run')}</b> · ${num(x.signals_seen).toLocaleString()} signals · ${num(x.candidates_created)} candidates</span>`).join('');
  }
  $('globeStatus').textContent=move.title?`Tracking world changes for: ${move.title}`:'Scanning public world signals';
}

async function loadExperience(){
  const d=await api('/functions/v1/intelligence-experience'); renderExperience(d);
}

async function loadModules(){
  try{
    const d=await api('/functions/v1/intelligence-router',{method:'POST',body:'{}'});
    const active=d.active||[], watch=d.watch||[]; $('moduleCount').textContent=active.length;
    $('moduleList').innerHTML=[...active.slice(0,5).map(x=>`<div class="activity-row"><div><b class="good">ACTIVE · ${esc(x.name)}</b><small>${esc(x.reason||'')}</small></div><span class="score">${esc(x.relevance_score)}</span></div>`),...watch.slice(0,2).map(x=>`<div class="activity-row"><div><b class="warn">WATCH · ${esc(x.name)}</b><small>${esc(x.reason||'')}</small></div><span class="score">${esc(x.relevance_score)}</span></div>`)].join('') || 'No modules active yet.';
  }catch(e){$('moduleList').textContent=e.message;}
}

async function loadModel(){
  const d=await api('/functions/v1/personal-model'); const m=d.model||{}, p=m.profile||{}, g=(m.goals||[])[0]||{}, f=m.financial_snapshot||{};
  $('displayName').value=p.display_name||''; $('homeRegion').value=p.home_region||''; $('primaryGoal').value=g.title||'Improve my economic position'; $('riskSelect').value=p.risk_posture||'balanced'; $('attentionInput').value=p.attention_budget_minutes||30;
  $('focusAreas').value=(m.focus_areas||[]).filter(x=>x.active!==false).map(x=>x.name).join('\n'); $('capabilities').value=(m.capabilities||[]).filter(x=>x.active!==false).map(x=>x.name).join('\n'); $('constraints').value=(m.constraints||[]).map(x=>x.description).join('\n');
  $('cash').value=f.cash??''; $('taxesReserved').value=f.taxes_reserved??''; $('payrollReserved').value=f.payroll_reserved??''; $('emergencyReserve').value=f.emergency_reserve??''; $('operatingReserve').value=f.operating_reserve??''; $('debt').value=f.debt??'';
}

async function saveSettings(){
  $('settingsMessage').textContent='Saving and recalculating…';
  try{
    const hasFinance=['cash','taxesReserved','payrollReserved','emergencyReserve','operatingReserve','debt'].some(id=>$(id).value.trim()!=='');
    const payload={profile:{display_name:$('displayName').value.trim()||null,home_region:$('homeRegion').value.trim()||null,risk_posture:$('riskSelect').value,attention_budget_minutes:Number($('attentionInput').value||30),preferred_currency:'CAD',timezone:'America/Edmonton',onboarding_complete:true},primary_goal:{title:$('primaryGoal').value.trim()||'Improve my economic position',domain:'general',currency:'CAD'},focus_areas:lines('focusAreas').map((name,i)=>({name,priority:Math.min(5,i+1),active:true})),replace_focus_areas:true,capabilities:lines('capabilities').map(name=>({name,category:'general',proficiency:4})),replace_capabilities:true,constraints:lines('constraints').map(description=>({category:/debt|reserve|capital/i.test(description)?'financial':'general',description,severity:5})),replace_constraints:true};
    if(hasFinance) payload.financial_snapshot={currency:'CAD',cash:valueOrNull('cash'),taxes_reserved:valueOrNull('taxesReserved'),payroll_reserved:valueOrNull('payrollReserved'),emergency_reserve:valueOrNull('emergencyReserve'),operating_reserve:valueOrNull('operatingReserve'),debt:valueOrNull('debt'),source:'manual'};
    await api('/functions/v1/personal-model',{method:'POST',body:JSON.stringify(payload)}); await api('/functions/v1/goal-contract',{method:'POST',body:'{}'}); await runIntelligence(); $('settingsMessage').textContent='Saved. Strategy recalculated.'; closeSettings();
  }catch(e){$('settingsMessage').textContent=e.message;}
}
function valueOrNull(id){return $(id).value.trim()===''?null:Number($(id).value);}

async function runIntelligence(){
  $('refreshBtn').textContent='Working…'; $('refreshBtn').disabled=true;
  try{await api('/functions/v1/universal-orchestrate',{method:'POST',body:'{}'}); await Promise.all([loadExperience(),loadModules(),loadModel()]); showToast('Intelligence refreshed.');}
  catch(e){showToast(`Run failed: ${e.message}`);} finally{$('refreshBtn').textContent='Run Intelligence';$('refreshBtn').disabled=false;}
}

async function recordDecision(action){
  if(!currentCandidateId)return;
  try{await api('/functions/v1/decision-memory',{method:'POST',body:JSON.stringify({candidate_id:currentCandidateId,action})}); await api('/functions/v1/portfolio-synthesis',{method:'POST',body:'{}'}); await api('/functions/v1/strategy-brief',{method:'POST',body:'{}'}); await loadExperience(); showToast(`Decision recorded: ${action.toUpperCase()}`);}catch(e){showToast(e.message);}
}

async function bootConnected(){
  try{
    await api('/auth/v1/user'); $('connectionStatus').textContent='PERSONAL MODEL CONNECTED'; $('connectionStatus').classList.add('good'); $('authBtn').textContent='Connected'; $('authBtn').onclick=openSettings; $('refreshBtn').classList.remove('hidden'); $('settingsBtn').classList.remove('hidden'); await Promise.all([loadExperience(),loadModules(),loadModel()]);
  }catch(e){localStorage.removeItem('pios_token');token='';$('connectionStatus').textContent='VISUAL MODE';$('authBtn').textContent='Connect';$('authBtn').onclick=openAuth;}
}

function initGlobe(){
  const svg=d3.select('#globe'), W=700,H=700; svg.attr('viewBox',`0 0 ${W} ${H}`);
  const projection=d3.geoOrthographic().translate([W/2,H/2]).scale(285).clipAngle(90).precision(.35);
  const path=d3.geoPath(projection); const root=svg.append('g');
  root.append('path').datum({type:'Sphere'}).attr('class','sphere');
  root.append('path').datum(d3.geoGraticule10()).attr('class','graticule');
  const landPath=root.append('path').attr('class','land');
  const signals=[[-114.07,51.05],[-79.38,43.65],[-0.12,51.5],[77.2,28.61],[103.82,1.35],[151.2,-33.87],[139.69,35.68],[-74.0,40.71]];
  const signalLayer=root.append('g'); const sig=signalLayer.selectAll('circle.signal').data(signals).join('circle').attr('class','signal').attr('r',3.2); const rings=signalLayer.selectAll('circle.signal-ring').data(signals).join('circle').attr('class','signal-ring');
  let land=null, angle=-35, last=performance.now();
  fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json').then(r=>r.json()).then(world=>{land=topojson.feature(world,world.objects.countries);landPath.datum(land);}).catch(()=>{$('globeStatus').textContent='Globe network layer unavailable — intelligence backend remains online';});
  function draw(now){
    const dt=Math.min(40,now-last);last=now;angle+=dt*.0048;projection.rotate([angle,-17,0]);
    root.select('.sphere').attr('d',path);root.select('.graticule').attr('d',path);if(land)landPath.attr('d',path);
    sig.attr('cx',d=>{const p=projection(d);return p?p[0]:-100}).attr('cy',d=>{const p=projection(d);return p?p[1]:-100}).attr('opacity',d=>{const r=projection.rotate(),c=d3.geoDistance(d,[-r[0],-r[1]]);return c<Math.PI/2?1:0});
    const pulse=7+3*Math.sin(now/520);rings.attr('cx',d=>{const p=projection(d);return p?p[0]:-100}).attr('cy',d=>{const p=projection(d);return p?p[1]:-100}).attr('r',pulse).attr('opacity',d=>{const r=projection.rotate(),c=d3.geoDistance(d,[-r[0],-r[1]]);return c<Math.PI/2?.34:0});
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
}

$('authBtn').onclick=openAuth; $('closeAuthBtn').onclick=closeAuth; $('signInBtn').onclick=signIn; $('signUpBtn').onclick=signUp; $('settingsBtn').onclick=openSettings; $('closeSettingsBtn').onclick=closeSettings; $('saveSettingsBtn').onclick=saveSettings; $('signOutBtn').onclick=signOut; $('refreshBtn').onclick=runIntelligence;
$('authOverlay').addEventListener('click',e=>{if(e.target===$('authOverlay'))closeAuth();});

initGlobe(); if(token)bootConnected();
