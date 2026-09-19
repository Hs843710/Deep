(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  let twinData=null,operatingData=null,reasoningData=null,consequenceData=null,worldCount=0;
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
    stage.classList.add('twin-mode');
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
      <div id="lifeTwinDetail" class="life-twin-detail"><span>SELECT A NODE</span><b>Your current state is shown as a living model, not a news feed.</b><div></div></div>`;
    tabs.insertAdjacentElement('afterend',twin);
    $('twinModeBtn').onclick=()=>setMode('twin');$('worldModeBtn').onclick=()=>setMode('world');
    twin.querySelectorAll('[data-life-node]').forEach(n=>n.onclick=()=>showDetail(n.dataset.lifeNode));
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

  function drawIntelligenceLinks(){
    const map=document.querySelector('.life-map'),svg=$('twinIntelligenceLayer'),group=$('twinIntelligenceLinks');if(!map||!svg||!group)return;
    const intel=consequenceData?.intelligence||{},visual=consequenceData?.visual_directive||{},affected=intel.affected_nodes||[];
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
    const intel=consequenceData?.intelligence||{},visual=consequenceData?.visual_directive||{},affected=intel.affected_nodes||[];
    document.querySelectorAll('[data-life-node]').forEach(n=>n.classList.remove('node-intel','node-primary','node-uncertain'));
    affected.forEach((x,i)=>{
      const n=document.querySelector(`[data-life-node="${x.id}"]`);if(!n)return;
      n.classList.add('node-intel');if(i===0)n.classList.add('node-primary');if(x.state==='uncertain')n.classList.add('node-uncertain');
      n.style.setProperty('--intel-strength',String(Math.max(.35,Math.min(1,Number(x.weight||50)/100))));
    });
    const flow=intel.direction?.label||String(intel.pathway||'STATE_TO_DECISION').replaceAll('_',' → ');
    if($('twinFlowChip'))$('twinFlowChip').textContent=flow;
    if($('twinIntelligenceTitle'))$('twinIntelligenceTitle').textContent=intel.title||'PIOS is mapping the current decision.';
    if($('twinIntelligenceAction'))$('twinIntelligenceAction').textContent=intel.next_action||intel.direction?.summary||'No action currently clears the reasoning threshold.';
    const robust=intel.robustness?.score;
    if(intel.pathway&&$('lifeTwinStatus'))$('lifeTwinStatus').textContent=`REASONING · ${flow}${robust!=null?' · ROBUST '+Math.round(Number(robust)):''}`;
    requestAnimationFrame(drawIntelligenceLinks);
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
    renderIntelligence();
  }

  function detailRows(rows){return `<div class="life-detail-grid">${rows.filter(x=>x&&x[1]!=null).map(([k,v])=>`<div><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}</div>`}
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
    const impact=(consequenceData?.intelligence?.affected_nodes||[]).find(x=>x.id===type);
    box.innerHTML=`<span>${esc(sub)}</span><b>${esc(title)}</b>${detailRows(rows)}${impact?`<p class="life-intel-reason"><strong>PIOS consequence:</strong> ${esc(impact.reason)}</p>`:''}`;
    document.querySelectorAll('[data-life-node]').forEach(n=>n.classList.toggle('selected',n.dataset.lifeNode===type));
  }

  async function loadLifeTwin(){
    ensureShell();if(!localStorage.getItem('pios_token')||typeof window.api!=='function')return;
    try{const [t,o,r,c]=await Promise.all([window.api('/functions/v1/trajectory-context'),window.api('/functions/v1/operating-memory'),window.api('/rest/v1/reasoning_runs?select=reasoning_version,thesis,uncertainties,recommendation,metadata,generated_at&order=generated_at.desc&limit=1'),window.api('/functions/v1/consequence-engine')]);twinData=t;operatingData=o;reasoningData=Array.isArray(r)?r[0]||null:null;consequenceData=c;render();}
    catch(_){if($('lifeTwinStatus'))$('lifeTwinStatus').textContent='STATE TEMPORARILY UNAVAILABLE';}
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
