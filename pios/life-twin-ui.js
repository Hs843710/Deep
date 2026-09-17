(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  let twinData=null,operatingData=null,worldCount=0;
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
    const tabs=document.createElement('div');tabs.className='twin-mode-tabs';tabs.innerHTML=`<button id="twinModeBtn" class="active">DIGITAL TWIN</button><button id="worldModeBtn">WORLD <span id="worldModeCount">0</span></button>`;
    stage.prepend(tabs);
    const twin=document.createElement('section');twin.id='lifeTwinStage';twin.className='life-twin-stage';twin.innerHTML=`
      <div class="life-twin-heading"><div><span>LIFE DIGITAL TWIN</span><b id="lifeTwinStatus">LIVE PERSONAL STATE</b></div><small id="lifeTwinUpdated">waiting for state</small></div>
      <div class="life-map">
        <div class="life-orbit orbit-one"></div><div class="life-orbit orbit-two"></div><div class="life-orbit orbit-three"></div>
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

  function render(){
    ensureShell();const t=twinData?.digital_twin||{},state=t.current_state||{},goal=t.primary_goal||{},p=goal.progress||{},op=operatingData||t.operating_memory||{},s=op.summary||{},gt=op.goal_tracking||{},capital=state.capital||{},counts=t.counts||{},profile=state.profile||{};
    const projectCurrent=gt.projects?.current??p.current??0,projectTarget=gt.projects?.target??p.target??'—',goalPct=p.progress_pct??gt.projects?.progress_pct??0;
    setNode('lifeGoal',`${projectCurrent}/${projectTarget}`,`${Number(goalPct||0).toFixed(0)}% complete`,Number(goalPct||0)>0?'good':'known');
    setNode('lifeBusiness',`${s.open||0} open`,`${s.quoted||0} quoted · ${s.won||0} won`,(operatingData?.records||[]).length?'known':'unknown');
    setNode('lifeProjects',`${s.won||0} won`,`${s.open||0} active pipeline`,s.won>0?'good':s.open>0?'known':'unknown');
    setNode('lifeFinance',money(capital.deployable,capital.currency||'CAD'),`${money(capital.protected_amount,capital.currency||'CAD')} protected`,capital.deployable!=null?'good':'unknown');
    setNode('lifeTime',profile.attention_budget_minutes!=null?`${profile.attention_budget_minutes}m/day`:'—','attention budget',profile.attention_budget_minutes!=null?'known':'unknown');
    setNode('lifeCapabilities',String(counts.capabilities??0),'recorded capabilities',(counts.capabilities||0)>0?'good':'unknown');
    setNode('lifeAssets',String(counts.resources??0),'recorded assets',(counts.resources||0)>0?'known':'unknown');
    const b=op.bottleneck||t.bottleneck||{};setNode('lifeBottleneck',b.type==='none'||!b.type?'UNKNOWN':String(b.title||b.type).replace(/Bottleneck not identified yet/i,'UNVERIFIED').slice(0,20),b.type==='none'?'needs operating evidence':String(b.type||'constraint').replaceAll('_',' '),b.type==='none'||!b.type?'unknown':'warn');
    $('lifeCoreAnchor').textContent=profile.home_region||'PERSONAL MODEL';$('lifeCoreState').textContent=`${Number(goalPct||0).toFixed(0)}% goal progress`;
    $('lifeTwinStatus').textContent=t.model_completeness_pct!=null?`CORE MODEL ${t.model_completeness_pct}%`:'LIVE PERSONAL STATE';$('lifeTwinUpdated').textContent=`updated ${new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}`;
    if($('worldModeCount'))$('worldModeCount').textContent=String(worldCount||0);
  }

  function detailRows(rows){return `<div class="life-detail-grid">${rows.filter(x=>x&&x[1]!=null).map(([k,v])=>`<div><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}</div>`}
  function showDetail(type){
    const t=twinData?.digital_twin||{},state=t.current_state||{},goal=t.primary_goal||{},p=goal.progress||{},op=operatingData||t.operating_memory||{},s=op.summary||{},gt=op.goal_tracking||{},capital=state.capital||{},counts=t.counts||{},b=op.bottleneck||t.bottleneck||{},box=$('lifeTwinDetail');if(!box)return;
    let title='',sub='',rows=[];
    if(type==='goal'){title=goal.title||'Primary goal';sub='GOAL CONTRACT';rows=[['Progress',p.available?`${p.current} / ${p.target} ${p.unit||''}`:'—'],['Contract value',gt.contract_value?.target!=null?`${money(gt.contract_value.current||0)} / ${money(gt.contract_value.target)}`:'—'],['Margin floor',gt.margin?.minimum!=null?`≥${gt.margin.minimum}%`:'—'],['Deadline',goal.target_date?fmtDate(goal.target_date):'—'],['Days left',goal.target_date?daysLeft(goal.target_date):'—']];}
    else if(type==='business'){title='Business operating state';sub='CURRENT STATE';rows=[['Open',s.open||0],['Qualified',s.qualified||0],['Quoted',s.quoted||0],['Won',s.won||0],['Win rate',s.win_rate==null?'—':`${Number(s.win_rate).toFixed(1)}%`]];}
    else if(type==='projects'){title='Project pipeline';sub='OPERATING MEMORY';rows=[['Leads',s.leads||0],['Estimating',s.estimating||0],['Submitted',s.submitted||0],['Won value',money(s.won_contract_value||0)],['Gross profit',money(s.gross_profit||0)]];}
    else if(type==='finance'){title='Capital state';sub='CAPITAL FIREWALL';rows=[['Liquid',money(capital.liquid,capital.currency||'CAD')],['Protected',money(capital.protected_amount,capital.currency||'CAD')],['Deployable',money(capital.deployable,capital.currency||'CAD')],['Debt',money(capital.debt,capital.currency||'CAD')]];}
    else if(type==='time'){title='Attention capacity';sub='TIME';rows=[['Daily budget',`${state.profile?.attention_budget_minutes??'—'} min`],['Estimator hours',`${Number(s.estimator_hours||0).toLocaleString()}h recorded`]];}
    else if(type==='capabilities'){title='Capabilities';sub='EXECUTION CAPACITY';rows=[['Recorded',counts.capabilities??0],['Model coverage',`${t.model_completeness_pct??0}%`]];}
    else if(type==='assets'){title='Assets & resources';sub='RESOURCE MODEL';rows=[['Recorded assets',counts.resources??0],['Status',(counts.resources||0)>0?'available to reasoning':'not yet modeled']];}
    else {title=b.title||'Bottleneck unverified';sub='BINDING CONSTRAINT';rows=[['Type',b.type||'unknown'],['Evidence',(operatingData?.records||[]).length?`${(operatingData.records||[]).length} operating records`:'insufficient operating data']];}
    box.innerHTML=`<span>${esc(sub)}</span><b>${esc(title)}</b>${detailRows(rows)}`;
    document.querySelectorAll('[data-life-node]').forEach(n=>n.classList.toggle('selected',n.dataset.lifeNode===type));
  }

  async function loadLifeTwin(){
    ensureShell();if(!localStorage.getItem('pios_token')||typeof window.api!=='function')return;
    try{const [t,o]=await Promise.all([window.api('/functions/v1/trajectory-context'),window.api('/functions/v1/operating-memory')]);twinData=t;operatingData=o;render();}
    catch(_){if($('lifeTwinStatus'))$('lifeTwinStatus').textContent='STATE TEMPORARILY UNAVAILABLE';}
  }

  function installHooks(){
    ensureShell();
    if(typeof window.renderExperience==='function'&&!window.renderExperience.__lifeTwinEnhanced){const original=window.renderExperience;const wrapped=function(d){worldCount=Array.isArray(d?.world_signals)?d.world_signals.length:worldCount;const r=original(d);setTimeout(loadLifeTwin,180);return r};wrapped.__lifeTwinEnhanced=true;window.renderExperience=wrapped;}
    if(typeof window.runIntelligence==='function'&&!window.runIntelligence.__lifeTwinEnhanced){const original=window.runIntelligence;const wrapped=async function(){const r=await original();setTimeout(loadLifeTwin,260);return r};wrapped.__lifeTwinEnhanced=true;window.runIntelligence=wrapped;}
    if(localStorage.getItem('pios_token'))setTimeout(loadLifeTwin,1150);
  }
  window.loadLifeTwin=loadLifeTwin;
  window.addEventListener('load',()=>setTimeout(installHooks,420));
})();
