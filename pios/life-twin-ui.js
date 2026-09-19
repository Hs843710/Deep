(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  let twinData=null,operatingData=null,reasoningData=null,consequenceData=null,simulationData=null,actionGraphData=null,personalValueData=null,executiveCouncilData=null,activeScenarioId=null,activeSessionToken=null,worldCount=0;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=(v,c='CAD')=>v==null?'—':Number(v).toLocaleString('en-CA',{style:'currency',currency:c,maximumFractionDigits:0});
  const fmtDate=v=>{if(!v)return'—';const d=new Date(v);return Number.isNaN(d.getTime())?'—':d.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})};
  const daysLeft=v=>{if(!v)return null;const n=Math.ceil((new Date(v+'T23:59:59').getTime()-Date.now())/86400000);return Number.isFinite(n)?Math.max(0,n):null};

  function compactPanels(){
    ['changesList','moduleList','alternatives','healthNote'].forEach(id=>{
      const el=$(id),panel=el?.closest('.panel');if(!panel||panel.classList.contains('compact-detail'))return;
      panel.classList.add('compact-detail','compact-collapsed');
      const head=panel.querySelector('.panel-title');if(head){head.style.cursor='pointer';head.title='Click to expand details';head.onclick=()=>panel.classList.toggle('compact-collapsed');}
    });
  }

  function ensureShell(){
    const stage=document.querySelector('.world-stage');if(!stage||$('lifeTwinStage'))return;
    if(!stage.classList.contains('world-mode'))stage.classList.add('twin-mode');
    const tabs=document.createElement('div');tabs.className='twin-mode-tabs';tabs.innerHTML=`<button id="twinModeBtn" class="active">TWIN + EARTH</button><button id="worldModeBtn">WORLD <span id="worldModeCount">0</span></button>`;
    stage.prepend(tabs);
    const twin=document.createElement('section');twin.id='lifeTwinStage';twin.className='life-twin-stage';twin.innerHTML=`
      <div class="life-twin-heading"><div><span>LIFE DIGITAL TWIN</span><b id="lifeTwinStatus">LIVE PERSONAL STATE</b></div><small id="lifeTwinUpdated">waiting for state</small></div>
      <div class="life-map">
        <div class="life-orbit orbit-one"></div><div class="life-orbit orbit-two"></div><div class="life-orbit orbit-three"></div>
        <svg id="twinIntelligenceLayer" class="twin-intelligence-layer" aria-hidden="true">
          <defs><marker id="intelArrow" markerWidth="8" markerHeight="8" refX="7" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 z"></path></marker></defs>
          <g id="twinIntelligenceLinks"></g>
        </svg>
        <button class="life-node pos-goal" data-life-node="goal"><span>GOAL</span><b id="lifeGoalValue">—</b><small id="lifeGoalMeta">target</small></button>
        <button class="life-node pos-business" data-life-node="business"><span>BUSINESS</span><b id="lifeBusinessValue">—</b><small id="lifeBusinessMeta">operating state</small></button>
        <button class="life-node pos-projects" data-life-node="projects"><span>PROJECTS</span><b id="lifeProjectsValue">—</b><small id="lifeProjectsMeta">pipeline</small></button>
        <button class="life-node pos-finance" data-life-node="finance"><span>FINANCE</span><b id="lifeFinanceValue">—</b><small id="lifeFinanceMeta">deployable</small></button>
        <button class="life-node pos-time" data-life-node="time"><span>TIME</span><b id="lifeTimeValue">—</b><small id="lifeTimeMeta">attention</small></button>
        <button class="life-node pos-capabilities" data-life-node="capabilities"><span>CAPABILITIES</span><b id="lifeCapabilitiesValue">—</b><small id="lifeCapabilitiesMeta">recorded</small></button>
        <button class="life-node pos-assets" data-life-node="assets"><span>ASSETS</span><b id="lifeAssetsValue">—</b><small id="lifeAssetsMeta">recorded</small></button>
        <button class="life-node pos-bottleneck" data-life-node="bottleneck"><span>BOTTLENECK</span><b id="lifeBottleneckValue">—</b><small id="lifeBottleneckMeta">constraint</small></button>
        <div class="life-core"><div class="life-core-ring a"></div><div class="life-core-ring b"></div><div class="life-core-ring c"></div><div class="life-core-inner"><span>YOU</span><b id="lifeCoreAnchor">PERSONAL MODEL</b><small id="lifeCoreState">0% goal progress</small></div></div>
      </div>
      <div id="twinIntelligenceSummary" class="twin-intelligence-summary">
        <span id="twinFlowChip">STATE → DECISION</span>
        <b id="twinIntelligenceTitle">PIOS is mapping your state.</b>
        <small id="twinIntelligenceAction">The Earth is the outside world; the Twin shows what it changes for you.</small>
      </div>
      <button id="executiveCouncilStrip" type="button" class="executive-council-strip" aria-label="Open Executive Intelligence Council briefing">
        <span><i class="executive-council-dot"></i> CHIEF OF STAFF</span>
        <b id="executiveCouncilHeadline">Checking your priorities...</b>
        <small id="executiveCouncilMeta">Coordinated specialist assessment · details on demand</small>
      </button>
      <div id="futureSwitcher" class="future-switcher">
        <div class="future-switcher-head"><span>NOW → POSSIBLE FUTURES</span><small id="futureNote">comparative simulation · current state remains canonical</small></div>
        <div id="futureOptions" class="future-options"></div>
      </div>
      <div id="lifeTwinDetail" class="life-twin-detail"><span>SELECT A NODE</span><b>Your current state is shown as a living model, not a news feed.</b><div></div></div>`;
    tabs.insertAdjacentElement('afterend',twin);
    $('twinModeBtn').onclick=()=>setMode('twin');$('worldModeBtn').onclick=()=>setMode('world');
    twin.querySelectorAll('[data-life-node]').forEach(n=>n.onclick=()=>showDetail(n.dataset.lifeNode));
    if($('twinIntelligenceSummary'))$('twinIntelligenceSummary').onclick=showCausalPath;
    if($('executiveCouncilStrip'))$('executiveCouncilStrip').onclick=showCouncilBrief;
    compactPanels();
  }

  function setMode(mode){
    const stage=document.querySelector('.world-stage');if(!stage)return;
    const twin=mode!=='world';stage.classList.toggle('twin-mode',twin);stage.classList.toggle('world-mode',!twin);
    $('twinModeBtn')?.classList.toggle('active',twin);$('worldModeBtn')?.classList.toggle('active',!twin);
  }

  function setNode(id,value,meta,state='known'){
    const v=$(id+'Value'),m=$(id+'Meta'),node=v?.closest('.life-node');if(v)v.textContent=value;if(m)m.textContent=meta;if(node){node.classList.remove('node-good','node-warn','node-unknown');node.classList.add(state==='good'?'node-good':state==='warn'?'node-warn':state==='unknown'?'node-unknown':'');}
  }

  function currentPersonalValue(){
    const intel=consequenceData?.intelligence||{},data=personalValueData||{};
    if(!data?.personal_value)return null;
    if(data.candidate_id&&intel.candidate_id&&data.candidate_id!==intel.candidate_id)return null;
    return data.personal_value;
  }
  function personalAffected(affected){
    const pv=currentPersonalValue();if(!pv)return [];
    if(!pv.surface)return [];
    const ids=new Set((pv.why_you||[]).map(x=>x.node));
    if((pv.not_known||[]).length)ids.add('bottleneck');
    if(pv.possible_effect?.capital_required!=null&&pv.possible_effect?.recorded_deployable!=null)ids.add('finance');
    return affected.filter(x=>ids.has(x.id));
  }

  function currentCouncil(){
    const c=executiveCouncilData?.council||null;
    if(!c)return null;
    const candidate=c.candidate_id||null,personal=personalValueData?.candidate_id||null;
    if(candidate&&personal&&candidate!==personal)return null;
    return c;
  }
  function renderCouncilStrip(){
    const c=currentCouncil(),chief=c?.chief_of_staff||{};
    const strip=$('executiveCouncilStrip');if(!strip)return;
    strip.classList.remove('council-quiet','council-gated','council-active','council-unavailable');
    strip.classList.add(!c?'council-unavailable':c.mode==='blocked'?'council-gated':c.mode==='quiet'?'council-quiet':'council-active');
    if($('executiveCouncilHeadline'))$('executiveCouncilHeadline').textContent=
      !c?'Executive brief unavailable':c.mode==='quiet'?'Nothing requires your attention from the current evidence':chief.headline||'Your personal briefing';
    const states=c?.adviser_states||[],active=states.filter(x=>x.status==='active').length,verify=states.filter(x=>x.status==='verify'||x.status==='blocked').length;
    if($('executiveCouncilMeta'))$('executiveCouncilMeta').textContent=!c?'Other Digital Twin features remain available':
      c.mode==='quiet'?'Monitoring your recorded goals and commitments':
      `${active} specialist views active · ${verify} verification gates · tap for reasoning`;
  }
  function showCouncilBrief(){
    const box=$('lifeTwinDetail'),c=currentCouncil(),chief=c?.chief_of_staff||{};if(!box)return;
    if(!c){box.innerHTML='<span>EXECUTIVE OFFICE</span><b>Briefing unavailable</b><p class="life-intel-reason">The specialist assessment could not be loaded. Your Digital Twin remains available; no new action is implied.</p>';return}
    const move=chief.next_move?'<p class="life-intel-reason"><strong>Next move:</strong> '+esc(chief.next_move.detail||chief.next_move.title||'')+(chief.next_move.approval_required?' · Approval required before external contact.':'')+'</p>':'';
    const conflicts=(chief.conflicts||[]).slice(0,2).map(x=>'<p class="life-intel-reason council-conflict"><strong>Specialist disagreement:</strong> '+esc(x.issue||'')+' <strong>Resolution:</strong> '+esc(x.resolution||'')+'</p>').join('');
    const advisers=(c.specialists||[]).slice(0,7).map(a=>`<div class="council-adviser"><div><b>${esc(a.name||a.id)}</b><span class="council-adviser-status ${esc(a.status)}">${esc(a.status)}</span></div><p>${esc(a.headline||'')}</p>${a.challenge?`<small><strong>Unknown or constraint:</strong> ${esc(a.challenge)}</small>`:''}${(a.facts||[]).slice(0,2).map(x=>`<small class="council-fact">${esc(x.text||'')}</small>`).join('')}${a.next_check&&a.status!=='watch'?`<small class="council-next">${esc(a.next_check)}</small>`:''}</div>`).join('');
    box.innerHTML=`<span>EXECUTIVE OFFICE · ${esc(String(c.mode||'').toUpperCase())}</span><b>${esc(chief.headline||'Personal briefing')}</b><p class="life-intel-reason">${esc(chief.reason||'')}</p>${move}${conflicts}<div class="council-advisers">${advisers}</div><p class="council-footnote">Specialist findings are evidence-based analyses, not separate licensed advisers. No external action is performed here.</p>`;
    document.querySelectorAll('[data-life-node]').forEach(n=>n.classList.remove('selected'));
  }

  function drawIntelligenceLinks(){
    const map=document.querySelector('.life-map'),svg=$('twinIntelligenceLayer'),group=$('twinIntelligenceLinks');if(!map||!svg||!group)return;
    const intel=consequenceData?.intelligence||{},visual=consequenceData?.visual_directive||{},affected=personalAffected(intel.affected_nodes||[]);
    const box=map.getBoundingClientRect(),w=Math.max(1,box.width),h=Math.max(1,box.height),cx=w/2,cy=h/2;
    svg.setAttribute('viewBox',`0 0 ${w} ${h}`);
    group.innerHTML='';
    affected.filter(x=>visual.active_nodes?.includes(x.id)||Number(x.weight||0)>=65).slice(0,7).forEach((x,i)=>{
      const node=document.querySelector(`[data-life-node="${x.id}"]`);if(!node)return;
      const r=node.getBoundingClientRect(),nx=r.left-box.left+r.width/2,ny=r.top-box.top+r.height/2;
      const outward=intel.pathway==='WORLD_TO_YOU'||intel.pathway==='UNKNOWN_TO_LEARN';
      const x1=outward?cx:nx,y1=outward?cy:ny,x2=outward?nx:cx,y2=outward?ny:cy;
      const line=document.createElementNS('http://www.w3.org/2000/svg','line');
      line.setAttribute('x1',String(x1));line.setAttribute('y1',String(y1));line.setAttribute('x2',String(x2));line.setAttribute('y2',String(y2));
      line.setAttribute('marker-end','url(#intelArrow)');line.setAttribute('class','intel-link'+(i===0?' primary':'')+(x.state==='uncertain'?' uncertain':''));
      line.style.opacity=String(Math.max(.28,Math.min(.9,Number(x.weight||50)/100)));
      group.appendChild(line);
    });
  }

  function renderIntelligence(){
    const intel=consequenceData?.intelligence||{},visual=consequenceData?.visual_directive||{},affected=personalAffected(intel.affected_nodes||[]),pv=currentPersonalValue();
    document.querySelectorAll('[data-life-node]').forEach(n=>n.classList.remove('node-intel','node-primary','node-uncertain'));
    affected.forEach((x,i)=>{
      const n=document.querySelector(`[data-life-node="${x.id}"]`);if(!n)return;
      n.classList.add('node-intel');if(i===0)n.classList.add('node-primary');if(x.state==='uncertain')n.classList.add('node-uncertain');
      n.style.setProperty('--intel-strength',String(Math.max(.35,Math.min(1,Number(x.weight||50)/100))));
    });
    const flow=pv?.pathway?pv.pathway.replaceAll('_',' → '):(intel.direction?.label||'STATE → DECISION');
    if($('twinFlowChip'))$('twinFlowChip').textContent=flow;
    const isPersonal=!!pv?.surface,hasPerson=!!pv;
    if($('twinIntelligenceTitle'))$('twinIntelligenceTitle').textContent=
      isPersonal?(intel.title||'A change affects your current goal.'):
      hasPerson?(pv.status==='not_personal'?'No personal consequence from this signal':pv.status==='expired'?'Opportunity window has passed':'Personal consequence not established'):
      'Checking which changes actually matter to you';
    if($('twinIntelligenceAction')){
      const plan=actionGraphData?.plan||{},matched=plan.candidate_id&&plan.candidate_id===personalValueData?.candidate_id;
      const steps=matched?plan.steps||[]:[],auto=steps.filter(x=>x.auto_allowed).length,approval=steps.filter(x=>x.approval_required).length;
      const base=isPersonal?(pv.next_move?.detail||'Verify the next personal decision gate.'):
        (pv?.missing_single_question||pv?.next_move?.detail||'No action is justified by the available personal evidence.');
      $('twinIntelligenceAction').textContent=steps.length?`${base} · ${auto} auto-eligible steps planned · ${approval} approval gates`:base;
    }
    if($('lifeTwinStatus'))$('lifeTwinStatus').textContent=isPersonal?
      'PERSONAL IMPACT · '+String(pv.status).replaceAll('_',' ').toUpperCase():
      hasPerson?'PERSONAL FIT · '+String(pv.status).replaceAll('_',' ').toUpperCase():'PERSONAL FIT · UNVERIFIED';
    requestAnimationFrame(drawIntelligenceLinks);
  }

  function scenarioMagnitude(v){
    const a=Math.abs(Number(v||0));return a>=45?'strong':a>=22?'moderate':a>=8?'light':'minimal';
  }
  function scenarioBeneficial(dim,v){
    const x=Number(v||0);return ['risk','uncertainty'].includes(dim)?x<0:x>0;
  }
  function clearScenarioProjection(){
    document.querySelectorAll('[data-life-node]').forEach(n=>{n.classList.remove('scenario-benefit','scenario-cost','scenario-active');n.querySelectorAll('.scenario-badge').forEach(x=>x.remove())});
    activeScenarioId=null;renderIntelligence();
    if($('lifeTwinDetail'))$('lifeTwinDetail').innerHTML='<span>SELECT A NODE</span><b>Your current state is shown as a living model, not a news feed.</b><div></div>';
    renderFutureSimulations();
  }
  function applyScenarioProjection(id){
    const scenario=(simulationData?.scenarios||[]).find(x=>x.id===id);if(!scenario){clearScenarioProjection();return}
    activeScenarioId=id;
    document.querySelectorAll('[data-life-node]').forEach(n=>{n.classList.remove('scenario-benefit','scenario-cost','scenario-active');n.querySelectorAll('.scenario-badge').forEach(x=>x.remove())});
    const map={goal:'goal',finance:'finance',time:'time',risk:'bottleneck',uncertainty:'bottleneck',optionality:'business',learning:'capabilities'};
    Object.entries(scenario.state_delta||{}).forEach(([dim,val])=>{
      const v=Number(val||0);if(Math.abs(v)<8)return;const node=document.querySelector(`[data-life-node="${map[dim]}"]`);if(!node)return;
      const good=scenarioBeneficial(dim,v);node.classList.add('scenario-active',good?'scenario-benefit':'scenario-cost');
      const badge=document.createElement('em');badge.className='scenario-badge '+(good?'good':'bad');badge.textContent=`${String(dim).toUpperCase()} ${v>0?'↑':'↓'} ${scenarioMagnitude(v)}`;node.appendChild(badge);
    });
    const preferred=simulationData?.preferred_scenario?.id===id;
    if($('lifeTwinStatus'))$('lifeTwinStatus').textContent=`SIMULATING · ${scenario.label.toUpperCase()} · ROBUST ${Math.round(Number(scenario.robust_utility||0))}`;
    const assumptions=(scenario.assumptions||[]).slice(0,2),fail=(scenario.failure_modes||[]).slice(0,2);
    if($('lifeTwinDetail'))$('lifeTwinDetail').innerHTML=`<span>POSSIBLE FUTURE · ${preferred?'PIOS PREFERENCE':'COUNTERFACTUAL'}</span><b>${esc(scenario.label)} · comparative Twin projection</b>${detailRows([['Robust utility',Math.round(Number(scenario.robust_utility||0))],['Regret exposure',Math.round(Number(scenario.regret_exposure||0))],['Evidence confidence',Math.round(Number(scenario.evidence_confidence||0))]])}<p class="life-intel-reason"><strong>Assumes:</strong> ${esc(assumptions.join(' · ')||'No explicit assumptions recorded.')}</p><p class="life-intel-reason"><strong>Can fail if:</strong> ${esc(fail.join(' · ')||'No failure mode recorded.')}</p>`;
    renderFutureSimulations();
  }
  function renderFutureSimulations(){
    const box=$('futureOptions');if(!box)return;const scenarios=simulationData?.scenarios||[],preferred=simulationData?.preferred_scenario?.id;
    const current=`<button class="future-option current ${activeScenarioId?'':'active'}" data-scenario="">NOW<small>actual state</small></button>`;
    const options=scenarios.slice(0,4).map(s=>`<button class="future-option ${s.id===preferred?'preferred':''} ${s.id===activeScenarioId?'active':''}" data-scenario="${esc(s.id)}"><span>${esc(s.label)}</span><b>R${Math.round(Number(s.robust_utility||0))}</b><small>${s.id===preferred?'preferred':'counterfactual'}</small></button>`).join('');
    box.innerHTML=current+options;
    box.querySelectorAll('[data-scenario]').forEach(b=>b.onclick=e=>{e.stopPropagation();const id=b.dataset.scenario;if(id)applyScenarioProjection(id);else clearScenarioProjection()});
    if($('futureNote'))$('futureNote').textContent=scenarios.length?'comparative simulation · not a forecast or commitment':'run intelligence to generate future states';
  }

  function render(){
    ensureShell();const t=twinData?.digital_twin||{},state=t.current_state||{},goal=t.primary_goal||{},p=goal.progress||{},op=operatingData||t.operating_memory||{},s=op.summary||{},gt=op.goal_tracking||{},capital=state.capital||{},counts=t.counts||{},profile=state.profile||{},commitments=state.commitments||{},sources=state.sources||[];
    const projectCurrent=gt.projects?.current??p.current??0,projectTarget=gt.projects?.target??p.target??'—',goalPct=p.progress_pct??gt.projects?.progress_pct??0,rr=reasoningData||{},robust=rr.metadata?.robustness?.score,criticalUnknowns=(rr.uncertainties||[]).filter(x=>x?.critical).length;
    setNode('lifeGoal',`${projectCurrent}/${projectTarget}`,`${Number(goalPct||0).toFixed(0)}% complete`,Number(goalPct||0)>0?'good':'known');
    setNode('lifeBusiness',`${s.open||0} open`,`${s.quoted||0} quoted · ${s.won||0} won`,(operatingData?.records||[]).length?'known':'unknown');
    setNode('lifeProjects',`${s.won||0} won`,`${s.open||0} active pipeline`,s.won>0?'good':s.open>0?'known':'unknown');
    setNode('lifeFinance',money(capital.deployable,capital.currency||'CAD'),`${money(capital.protected_amount,capital.currency||'CAD')} protected`,capital.deployable!=null?'good':'unknown');
    setNode('lifeTime',profile.attention_budget_minutes!=null?`${profile.attention_budget_minutes}m/day`:'—',commitments.next_7_days? `${commitments.next_7_days} commitment${commitments.next_7_days===1?'':'s'} next 7d` : 'no connected-calendar commitments next 7d',profile.attention_budget_minutes!=null?'known':'unknown');
    setNode('lifeCapabilities',String(counts.capabilities??0),'recorded capabilities',(counts.capabilities||0)>0?'good':'unknown');
    setNode('lifeAssets',String(counts.resources??0),`${counts.connected_sources??sources.length} connected source${(counts.connected_sources??sources.length)===1?'':'s'}`,(counts.resources||0)>0?'known':'unknown');
    const b=op.bottleneck||t.bottleneck||{};setNode('lifeBottleneck',b.type==='none'||!b.type?'UNKNOWN':String(b.title||b.type).replace(/Bottleneck not identified yet/i,'UNVERIFIED').slice(0,20),b.type==='none'?'needs operating evidence':String(b.type||'constraint').replaceAll('_',' '),b.type==='none'||!b.type?'unknown':'warn');
    $('lifeCoreAnchor').textContent=profile.home_region||'PERSONAL MODEL';$('lifeCoreState').textContent=robust!=null?`ROBUST ${Number(robust).toFixed(0)} · ${criticalUnknowns} critical unknown${criticalUnknowns===1?'':'s'}`:`${Number(goalPct||0).toFixed(0)}% goal progress`;
    $('lifeTwinStatus').textContent=t.model_completeness_pct!=null?`CORE MODEL ${t.model_completeness_pct}%`:'LIVE PERSONAL STATE';$('lifeTwinUpdated').textContent=`updated ${new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}`;
    if($('worldModeCount'))$('worldModeCount').textContent=String(worldCount||0);
    renderIntelligence();renderCouncilStrip();renderFutureSimulations();if(activeScenarioId)applyScenarioProjection(activeScenarioId);
  }

  function detailRows(rows){return `<div class="life-detail-grid">${rows.filter(x=>x&&x[1]!=null).map(([k,v])=>`<div><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}</div>`}
  function showCausalPath(){
    const box=$('lifeTwinDetail'),intel=consequenceData?.intelligence||{},steps=intel.causal_path||[];if(!box)return;
    const pv=currentPersonalValue(),flow=pv?.pathway?pv.pathway.replaceAll('_',' → '):(intel.direction?.label||'STATE → DECISION');
    const personalSteps=pv?.surface?steps:[];
    const path=personalSteps.length?`<div class="causal-path">${personalSteps.map((x,i)=>`<div class="causal-step"><span>${i+1}</span><b>${esc(x.label||x.kind||'Step')}</b><small>${esc(x.text||'')}</small></div>${i<personalSteps.length-1?'<i>→</i>':''}`).join('')}</div>`:'<div class="empty-copy">No causal path has been generated yet.</div>';
    const mind=(intel.what_would_change_mind||[])[0],plan=actionGraphData?.plan||{},planSteps=pv?.surface&&plan.candidate_id===personalValueData?.candidate_id?plan.steps||[]:[];
    const links=pv?.surface?(pv.why_you||[]).slice(0,3).map(x=>x.fact):[];
    const why=links.length?`<p class="life-intel-reason"><strong>Why this is personal:</strong> ${esc(links.join(' · '))}</p>`:'';
    const unknown=pv?.surface&&pv.not_known?.length?`<p class="life-intel-reason"><strong>What remains unverified:</strong> ${esc(pv.not_known[0])}</p>`:'';
    const actionPath=planSteps.length?`<div class="action-graph-head"><span>ACTION GRAPH</span><small>${esc(plan.objective||'Guarded execution path')}</small></div><div class="action-graph-path">${planSteps.map((x,i)=>`<div class="action-step ${x.approval_required?'approval':'auto'} ${x.status==='blocked'?'blocked':''}"><span>${i+1}</span><b>${esc(x.label||x.id)}</b><small>${x.approval_required?'APPROVAL':'AUTO-ELIGIBLE'}</small></div>${i<planSteps.length-1?'<i>→</i>':''}`).join('')}</div>`:''; 
    box.innerHTML=`<span>${esc(flow)} · PERSONAL CONSEQUENCE</span><b>${esc(pv?.surface?intel.title:(pv?.status==='not_personal'?'No personal consequence established':'Awaiting personal evidence'))}</b>${path}${why}${unknown}${mind&&pv?.surface?`<p class="life-intel-reason"><strong>What could change this:</strong> ${esc(mind.condition||mind.question||mind)}</p>`:''}${actionPath}`;
    document.querySelectorAll('[data-life-node]').forEach(n=>n.classList.remove('selected'));
  }
  function showDetail(type){
    const t=twinData?.digital_twin||{},state=t.current_state||{},goal=t.primary_goal||{},p=goal.progress||{},op=operatingData||t.operating_memory||{},s=op.summary||{},gt=op.goal_tracking||{},capital=state.capital||{},counts=t.counts||{},commitments=state.commitments||{},sources=state.sources||[],b=op.bottleneck||t.bottleneck||{},box=$('lifeTwinDetail');if(!box)return;
    let title='',sub='',rows=[];
    if(type==='goal'){title=goal.title||'Primary goal';sub='GOAL CONTRACT';rows=[['Progress',p.available?`${p.current} / ${p.target} ${p.unit||''}`:'—'],['Contract value',gt.contract_value?.target!=null?`${money(gt.contract_value.current||0)} / ${money(gt.contract_value.target)}`:'—'],['Margin floor',gt.margin?.minimum!=null?`≥${gt.margin.minimum}%`:'—'],['Deadline',goal.target_date?fmtDate(goal.target_date):'—'],['Days left',goal.target_date?daysLeft(goal.target_date):'—']];}
    else if(type==='business'){title='Business operating state';sub='CURRENT STATE';rows=[['Open',s.open||0],['Qualified',s.qualified||0],['Quoted',s.quoted||0],['Won',s.won||0],['Win rate',s.win_rate==null?'—':`${Number(s.win_rate).toFixed(1)}%`]];}
    else if(type==='projects'){title='Project pipeline';sub='OPERATING MEMORY';rows=[['Leads',s.leads||0],['Estimating',s.estimating||0],['Submitted',s.submitted||0],['Won value',money(s.won_contract_value||0)],['Gross profit',money(s.gross_profit||0)]];}
    else if(type==='finance'){title='Capital state';sub='CAPITAL FIREWALL';rows=[['Liquid',money(capital.liquid,capital.currency||'CAD')],['Protected',money(capital.protected_amount,capital.currency||'CAD')],['Deployable',money(capital.deployable,capital.currency||'CAD')],['Debt',money(capital.debt,capital.currency||'CAD')]];}
    else if(type==='time'){title='Attention & commitments';sub='TIME';rows=[['Daily budget',`${state.profile?.attention_budget_minutes??'—'} min`],['Next 7 days',commitments.next_7_days??0],['Upcoming modeled',commitments.active_count??0],['Estimator hours',`${Number(s.estimator_hours||0).toLocaleString()}h recorded`]];}
    else if(type==='capabilities'){title='Capabilities';sub='EXECUTION CAPACITY';rows=[['Recorded',counts.capabilities??0],['Model coverage',`${t.model_completeness_pct??0}%`]];}
    else if(type==='assets'){title='Assets, resources & sources';sub='RESOURCE MODEL';rows=[['Recorded resources',counts.resources??0],['Connected sources',counts.connected_sources??sources.length],['Source evidence',sources.reduce((a,x)=>a+Number(x.evidence_count||0),0)],['Status',(counts.resources||0)>0?'available to reasoning':'not yet modeled']];}
    else {title=b.title||'Bottleneck unverified';sub='BINDING CONSTRAINT';rows=[['Type',b.type||'unknown'],['Evidence',(operatingData?.records||[]).length?`${(operatingData.records||[]).length} operating records`:'insufficient operating data']];}
    const pv=currentPersonalValue(),personalLink=pv?.surface?(pv.why_you||[]).find(x=>x.node===type):null;
    box.innerHTML=`<span>${esc(sub)}</span><b>${esc(title)}</b>${detailRows(rows)}${personalLink?`<p class="life-intel-reason"><strong>Why this affects you:</strong> ${esc(personalLink.fact)}</p>`:''}`;
    document.querySelectorAll('[data-life-node]').forEach(n=>n.classList.toggle('selected',n.dataset.lifeNode===type));
  }

  async function loadLifeTwin(){
    ensureShell();
    const token=localStorage.getItem('pios_token');
    if(!token){
      activeSessionToken=null;twinData=null;operatingData=null;reasoningData=null;consequenceData=null;simulationData=null;actionGraphData=null;personalValueData=null;executiveCouncilData=null;activeScenarioId=null;
      if($('lifeTwinStatus'))$('lifeTwinStatus').textContent='CONNECT TO LOAD PERSONAL STATE';
      if($('twinIntelligenceTitle'))$('twinIntelligenceTitle').textContent='Your Digital Twin is not connected.';
      if($('twinIntelligenceAction'))$('twinIntelligenceAction').textContent='Sign in to load your own model.';
      if(typeof window.updatePiosPresence==='function')window.updatePiosPresence({council:null,personalValue:null,asOf:null});
      return;
    }
    if(token!==activeSessionToken){
      activeSessionToken=token;twinData=null;operatingData=null;reasoningData=null;consequenceData=null;simulationData=null;actionGraphData=null;personalValueData=null;executiveCouncilData=null;activeScenarioId=null;
      document.querySelectorAll('[data-life-node] .scenario-badge').forEach(x=>x.remove());
      document.querySelectorAll('[data-life-node] b[id$="Value"]').forEach(x=>x.textContent='—');
      if($('lifeTwinStatus'))$('lifeTwinStatus').textContent='LOADING YOUR PERSONAL MODEL';
      if($('twinIntelligenceTitle'))$('twinIntelligenceTitle').textContent='Mapping your personal state...';
      if($('twinIntelligenceAction'))$('twinIntelligenceAction').textContent='Waiting for your account-specific evidence.';
    }
    if(typeof window.api!=='function')return;
    const endpoints=['/functions/v1/trajectory-context','/functions/v1/operating-memory','/rest/v1/reasoning_runs?select=reasoning_version,thesis,uncertainties,recommendation,metadata,generated_at&order=generated_at.desc&limit=1','/functions/v1/consequence-engine','/functions/v1/future-simulator','/functions/v1/action-graph','/functions/v1/personal-consequence','/functions/v1/executive-council'];
    const results=await Promise.allSettled(endpoints.map(path=>window.api(path)));
    if(localStorage.getItem('pios_token')!==token||activeSessionToken!==token)return;
    const value=i=>results[i].status==='fulfilled'?results[i].value:null;
    twinData=value(0)||twinData;operatingData=value(1)||operatingData;
    reasoningData=Array.isArray(value(2))?value(2)[0]||null:reasoningData;
    consequenceData=value(3)||consequenceData;simulationData=value(4)||simulationData;
    actionGraphData=value(5)||actionGraphData;personalValueData=value(6)||personalValueData;executiveCouncilData=value(7)||executiveCouncilData;
    if(twinData||operatingData)render();
    else if($('lifeTwinStatus'))$('lifeTwinStatus').textContent='PERSONAL STATE CURRENTLY UNAVAILABLE';
    if(typeof window.updatePiosPresence==='function')window.updatePiosPresence({council:executiveCouncilData?.council||null,personalValue:personalValueData?.personal_value||null,asOf:executiveCouncilData?.generated_at||null});
  }

  function installHooks(){
    ensureShell();
    if(typeof window.renderExperience==='function'&&!window.renderExperience.__lifeTwinEnhanced){const original=window.renderExperience;const wrapped=function(d){worldCount=Array.isArray(d?.world_signals)?d.world_signals.length:worldCount;const r=original(d);setTimeout(loadLifeTwin,180);return r};wrapped.__lifeTwinEnhanced=true;window.renderExperience=wrapped;}
    if(typeof window.runIntelligence==='function'&&!window.runIntelligence.__lifeTwinEnhanced){const original=window.runIntelligence;const wrapped=async function(){const r=await original();setTimeout(loadLifeTwin,260);return r};wrapped.__lifeTwinEnhanced=true;window.runIntelligence=wrapped;}
    if(!window.__piosTwinResizeBound){window.addEventListener('resize',()=>requestAnimationFrame(drawIntelligenceLinks));window.__piosTwinResizeBound=true;}
    if(localStorage.getItem('pios_token'))setTimeout(loadLifeTwin,1150);
  }
  window.loadLifeTwin=loadLifeTwin;
  window.addEventListener('load',()=>setTimeout(installHooks,420));
})();
