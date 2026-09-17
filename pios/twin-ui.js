(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=(v,c='CAD')=>v==null?'—':Number(v).toLocaleString('en-CA',{style:'currency',currency:c,maximumFractionDigits:0});
  const signedMoney=(v,c='CAD')=>v==null?'—':`${Number(v)>0?'+':''}${money(v,c)}`;
  const label=v=>String(v||'').replaceAll('_',' ').replace(/^\w/,c=>c.toUpperCase());
  const fmtDate=v=>{if(!v)return'';const d=new Date(v);return Number.isNaN(d.getTime())?'':d.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})};

  function ensureShell(){
    const left=document.querySelector('.left-rail');
    const anchor=document.querySelector('.trajectory-panel');
    if(!left||!anchor||$('digitalTwinTrajectory'))return;
    const panel=document.createElement('article');
    panel.id='digitalTwinTrajectory';
    panel.className='panel twin-trajectory';
    panel.innerHTML=`
      <div class="panel-title"><span>Personal Trajectory</span><span id="twinCompletenessChip" class="chip">—</span></div>
      <div id="twinGoalProgress" class="twin-progress-block"></div>
      <div id="twinBottleneck" class="twin-bottleneck"><span>PRIMARY BOTTLENECK</span><b>Waiting for Personal Model…</b><p></p></div>
      <div id="twinFinanceDelta" class="twin-finance"></div>
      <div id="twinEvolution" class="twin-evolution"><span>WHY STRATEGY CHANGED</span><b>No trajectory history loaded yet.</b></div>
      <div id="twinFacts" class="twin-facts"></div>
      <div id="twinUnknowns" class="twin-unknowns"></div>`;
    anchor.insertAdjacentElement('afterend',panel);
  }

  function renderProgress(goal){
    const box=$('twinGoalProgress');if(!box)return;
    if(!goal){box.innerHTML='<div class="twin-empty">Define a primary goal to create a measurable trajectory.</div>';return;}
    const p=goal.progress||{};
    if(!p.available){box.innerHTML=`<div class="twin-goal-line"><span>CURRENT DIRECTION</span><b>${esc(goal.title||'Primary goal')}</b></div><div class="twin-empty">Goal is directional but not quantified. PIOS can still recommend actions, but numeric progress is not yet measurable.</div>`;return;}
    const pct=Math.max(0,Math.min(100,Number(p.progress_pct||0)));
    const unit=p.currency||p.unit||'';
    const current=p.currency?money(p.current,p.currency):`${Number(p.current).toLocaleString()}${unit?` ${unit}`:''}`;
    const target=p.currency?money(p.target,p.currency):`${Number(p.target).toLocaleString()}${unit?` ${unit}`:''}`;
    box.innerHTML=`<div class="twin-goal-line"><span>GOAL PROGRESS</span><b>${esc(goal.title||'Primary goal')}</b></div><div class="twin-progress-track"><i style="width:${pct}%"></i></div><div class="twin-progress-meta"><span>${esc(current)} current</span><b>${pct.toFixed(1)}%</b><span>${esc(target)} target</span></div>${goal.target_date?`<div class="twin-target-date">Target date · ${esc(fmtDate(goal.target_date))}</div>`:''}`;
  }

  function renderFinance(state){
    const box=$('twinFinanceDelta');if(!box)return;
    const c=state?.capital,d=state?.finance_delta;
    if(!c){box.innerHTML='<div class="twin-empty">Financial trajectory unavailable until a Capital Firewall snapshot exists.</div>';return;}
    const parts=[`<div><span>Deployable now</span><b>${esc(money(c.deployable,c.currency))}</b></div>`,`<div><span>Protected</span><b>${esc(money(c.protected_amount,c.currency))}</b></div>`];
    if(d){parts.push(`<div><span>Deployable Δ</span><b class="${Number(d.deployable_change)>=0?'positive':'negative'}">${esc(signedMoney(d.deployable_change,d.currency))}</b></div>`);if(d.debt_change!=null)parts.push(`<div><span>Debt Δ</span><b class="${Number(d.debt_change)<=0?'positive':'negative'}">${esc(signedMoney(d.debt_change,d.currency))}</b></div>`)}
    box.innerHTML=parts.join('');
  }

  function renderChanges(rows){
    const box=$('changesList'),count=$('changeCount');if(!box)return;
    const list=Array.isArray(rows)?rows:[];if(count)count.textContent=String(list.length);
    box.innerHTML=list.length?list.map(x=>`<div class="activity-row twin-change"><div><b>${esc(x.title||'Personal state changed')}</b><small>${esc(x.summary||'State updated')}${x.detected_at?` · ${esc(fmtDate(x.detected_at))}`:''}</small></div><span class="score">${Math.round(Number(x.materiality||0))}</span></div>`).join(''):'<div class="empty-copy">No material Personal Model changes are currently recorded.</div>';
  }

  function renderTwin(data){
    ensureShell();
    const t=data?.digital_twin||{};
    const chip=$('twinCompletenessChip');if(chip){chip.textContent=`${Number(t.model_completeness_pct||0)}% MODEL`;chip.title='Coverage of core Personal Model components, not a judgment about you.';}
    renderProgress(t.primary_goal);
    const b=t.bottleneck||{};if($('twinBottleneck'))$('twinBottleneck').innerHTML=`<span>PRIMARY BOTTLENECK</span><b>${esc(b.title||'No dominant bottleneck detected')}</b><p>${esc(b.detail||'PIOS does not currently have enough evidence to identify one dominant constraint.')}</p>`;
    renderFinance(t.current_state||{});
    const evo=t.strategy_evolution||{};if($('twinEvolution'))$('twinEvolution').innerHTML=`<span>${evo.changed?'WHY STRATEGY CHANGED':'STRATEGY TRAJECTORY'}</span><b>${esc(evo.why_changed||'No prior strategy snapshot exists yet.')}</b>${evo.previous&&evo.current?`<small>${esc(evo.previous.title||evo.previous.decision||'Previous')} → ${esc(evo.current.title||evo.current.decision||'Current')}</small>`:''}`;
    if($('strategyDelta')&&evo.why_changed)$('strategyDelta').textContent=evo.why_changed;
    const facts=t.current_state?.facts||[];if($('twinFacts'))$('twinFacts').innerHTML=facts.slice(0,6).map(f=>`<div><span>${esc(f.label)}</span><b>${f.currency?esc(money(f.value,f.currency)):esc(f.value)}</b></div>`).join('');
    const unknowns=t.unknowns||[];if($('twinUnknowns'))$('twinUnknowns').innerHTML=unknowns.length?`<div class="twin-unknown-head">WHAT PIOS STILL DOESN'T KNOW</div>${unknowns.slice(0,3).map(x=>`<div class="twin-unknown">${esc(x)}</div>`).join('')}`:'<div class="twin-known">Core Personal Model coverage is currently complete.</div>';
    renderChanges(t.recent_changes||[]);
  }

  async function loadTwin(){
    ensureShell();
    if(!localStorage.getItem('pios_token')||typeof window.api!=='function')return;
    try{const data=await window.api('/functions/v1/trajectory-context');renderTwin(data);}
    catch(_){const chip=$('twinCompletenessChip');if(chip)chip.textContent='MODEL OFFLINE';}
  }

  function installHooks(){
    ensureShell();
    if(typeof window.renderExperience==='function'&&!window.renderExperience.__piosTwinEnhanced){
      const original=window.renderExperience;
      const wrapped=function(data){const r=original(data);setTimeout(loadTwin,220);return r;};
      wrapped.__piosTwinEnhanced=true;window.renderExperience=wrapped;
    }
    if(typeof window.runIntelligence==='function'&&!window.runIntelligence.__piosTwinEnhanced){
      const original=window.runIntelligence;
      const wrapped=async function(){const r=await original();setTimeout(loadTwin,300);return r;};
      wrapped.__piosTwinEnhanced=true;window.runIntelligence=wrapped;
    }
    if(localStorage.getItem('pios_token'))setTimeout(loadTwin,1050);
  }
  window.addEventListener('load',()=>setTimeout(installHooks,280));
})();
