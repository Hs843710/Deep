(() => {
  'use strict';

  const $=id=>document.getElementById(id);
  let activeCandidateId='';
  let activeLifecycle=null;
  let recentLearning=null;

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=(v,c='CAD')=>v==null||v===''?null:Number(v).toLocaleString('en-CA',{style:'currency',currency:c,maximumFractionDigits:0});
  const label=v=>String(v||'').replaceAll('_',' ').replace(/^\w/,c=>c.toUpperCase());

  function ensureShell(){
    const move=document.querySelector('.next-move');
    if(!move||$('actionLearning'))return;
    const box=document.createElement('section');
    box.id='actionLearning';
    box.className='action-learning';
    box.innerHTML=`
      <div class="learning-head"><span>ACTION & LEARNING</span><span id="lifecycleChip" class="lifecycle-chip">WAITING</span></div>
      <div id="lifecycleTitle" class="lifecycle-title">PIOS is waiting for a decision.</div>
      <div id="lifecycleProgress" class="lifecycle-progress"></div>
      <div id="lifecycleControls" class="lifecycle-controls"></div>
      <div id="outcomeForm" class="outcome-form hidden">
        <div class="outcome-form-head"><b>Record actual outcome</b><span>Real outcomes teach PIOS more than clicks.</span></div>
        <div class="outcome-grid">
          <label>Result<select id="outcomeStatus"><option value="positive">Positive</option><option value="neutral">Neutral</option><option value="negative">Negative</option><option value="unknown">Too early / unknown</option></select></label>
          <label>Money gained / lost<input id="outcomeMoney" type="number" step="0.01" placeholder="0" /></label>
          <label>Hours actually spent<input id="outcomeHours" type="number" step="0.25" min="0" placeholder="0" /></label>
        </div>
        <label class="outcome-notes">What actually happened?<textarea id="outcomeNotes" rows="3" placeholder="Short factual result, unexpected downside, blocker, or lesson."></textarea></label>
        <div class="outcome-actions"><button id="saveOutcomeBtn" class="btn primary" type="button">Complete & Learn</button><button id="cancelOutcomeBtn" class="btn ghost" type="button">Cancel</button></div>
      </div>
      <div id="learningResult" class="learning-result hidden"></div>
      <div id="recentLearning" class="recent-learning"></div>`;
    move.appendChild(box);
    $('cancelOutcomeBtn').onclick=()=>$('outcomeForm').classList.add('hidden');
    $('saveOutcomeBtn').onclick=saveOutcome;
  }

  function progress(stage){
    const steps=['approved','preparing','in_progress','waiting','completed'];
    const normalized=stage==='executing'?'in_progress':stage;
    const idx=steps.indexOf(normalized);
    return steps.map((s,i)=>`<div class="life-step ${idx>=0&&i<idx?'done':''} ${i===idx?'current':''}"><i></i><span>${s==='in_progress'?'IN PROGRESS':s.toUpperCase()}</span></div>`).join('');
  }

  function setBusy(text){const c=$('lifecycleControls');if(c)c.innerHTML=`<span class="life-busy">${esc(text)}</span>`}

  function renderLifecycle(data){
    ensureShell();
    activeLifecycle=data;
    const c=data?.candidate,stage=data?.lifecycle?.stage||c?.status||'new';
    const chip=$('lifecycleChip');if(chip){chip.textContent=label(stage).toUpperCase();chip.className=`lifecycle-chip stage-${String(stage).replaceAll('_','-')}`;}
    if($('lifecycleProgress'))$('lifecycleProgress').innerHTML=progress(stage);
    const title=$('lifecycleTitle');if(title)title.textContent=c?`${c.title} · ${stage==='approved'?'approved for the next step':stage==='executing'?'execution tracking active':label(stage)}`:'No active recommendation selected.';
    const controls=$('lifecycleControls');if(!controls)return;

    if(!c){controls.innerHTML='<span class="life-note">PIOS has no candidate to track right now.</span>';return;}
    if(['new','investigate','watch'].includes(stage)){
      controls.innerHTML='<span class="life-note">Choose <b>Approve next step</b> above when you want PIOS to track execution and outcomes. Approval does not authorize external spending or irreversible action.</span>';
    }else if(stage==='approved'){
      controls.innerHTML='<button class="mini-action" data-life="start">Start execution tracking</button><button class="mini-action secondary" data-life="defer">Defer</button>';
    }else if(['executing','preparing','in_progress','waiting'].includes(stage)){
      controls.innerHTML='<button class="mini-action" data-stage="preparing">Preparing</button><button class="mini-action" data-stage="in_progress">In progress</button><button class="mini-action" data-stage="waiting">Waiting</button><button class="mini-action complete" data-life="complete">Complete</button><button class="mini-action secondary" data-life="abandon">Abandon</button>';
    }else if(stage==='completed'){
      controls.innerHTML='<span class="life-note">Completed. The recorded outcome is now part of PIOS learning memory.</span>';
    }else if(stage==='abandoned'){
      controls.innerHTML='<span class="life-note">Abandoned. No positive/negative learning is inferred unless an actual outcome is recorded.</span>';
    }else{
      controls.innerHTML='<span class="life-note">Decision state recorded. PIOS will keep monitoring this item.</span>';
    }
    controls.querySelectorAll('[data-life]').forEach(b=>b.onclick=()=>handleLife(b.dataset.life));
    controls.querySelectorAll('[data-stage]').forEach(b=>b.onclick=()=>setStage(b.dataset.stage));

    const last=data?.outcomes?.[0];
    if(last&&$('learningResult')){
      const comp=data.latest_comparison;
      $('learningResult').classList.remove('hidden');
      $('learningResult').innerHTML=outcomeSummary(last,comp,c.currency||'CAD');
    }
  }

  function outcomeSummary(outcome,comp,currency='CAD'){
    const pieces=[];
    if(outcome?.status)pieces.push(`<b>${esc(label(outcome.status))} outcome</b>`);
    if(outcome?.monetary_impact!=null)pieces.push(`actual money ${esc(money(outcome.monetary_impact,currency))}`);
    if(outcome?.time_impact_hours!=null)pieces.push(`actual time ${Number(outcome.time_impact_hours).toLocaleString()}h`);
    if(comp?.time_variance_pct!=null)pieces.push(`time ${comp.time_variance_pct>0?'+':''}${comp.time_variance_pct}% vs estimate`);
    if(comp?.money_assessment&&comp.money_assessment!=='not_comparable')pieces.push(esc(label(comp.money_assessment)));
    return `<span>ACTUAL VS PREDICTED</span><div>${pieces.join(' · ')||'Outcome recorded.'}</div>`;
  }

  async function call(body){
    return window.api('/functions/v1/action-outcome',{method:'POST',body:JSON.stringify(body)});
  }

  async function handleLife(op){
    if(!activeCandidateId)return;
    if(op==='complete'){$('outcomeForm').classList.remove('hidden');$('outcomeStatus').focus();return;}
    setBusy(op==='start'?'Starting tracking…':op==='defer'?'Deferring…':'Recording abandonment…');
    try{
      const d=await call({candidate_id:activeCandidateId,operation:op});
      renderLifecycle({candidate:activeLifecycle?.candidate,lifecycle:d.lifecycle,outcomes:activeLifecycle?.outcomes||[]});
      if(typeof window.showToast==='function')window.showToast(op==='start'?'Execution tracking started.':op==='defer'?'Deferred.':'Abandoned.');
      if(op==='defer'||op==='abandon')setTimeout(recalculate,350);
    }catch(e){if(typeof window.showToast==='function')window.showToast(e.message);loadActionState();}
  }

  async function setStage(stage){
    if(!activeCandidateId)return;setBusy(`Setting ${label(stage)}…`);
    try{const d=await call({candidate_id:activeCandidateId,operation:'stage',stage});renderLifecycle({candidate:activeLifecycle?.candidate,lifecycle:d.lifecycle,outcomes:activeLifecycle?.outcomes||[]});}
    catch(e){if(typeof window.showToast==='function')window.showToast(e.message);loadActionState();}
  }

  async function saveOutcome(){
    if(!activeCandidateId)return;
    const btn=$('saveOutcomeBtn');btn.disabled=true;btn.textContent='Learning…';
    try{
      const status=$('outcomeStatus').value,m=$('outcomeMoney').value.trim(),h=$('outcomeHours').value.trim(),notes=$('outcomeNotes').value.trim();
      const d=await call({candidate_id:activeCandidateId,operation:'complete',notes,outcome:{status,monetary_impact:m===''?null:Number(m),time_impact_hours:h===''?null:Number(h),notes}});
      $('outcomeForm').classList.add('hidden');
      const result=$('learningResult');if(result){result.classList.remove('hidden');const learned=(d.learning_updates||[]).filter(x=>x.dimension==='opportunity_type'||x.dimension==='module').map(x=>`${label(x.dimension)} ${label(x.key)} ${Number(x.before_weight).toFixed(2)}→${Number(x.weight).toFixed(2)}`);result.innerHTML=outcomeSummary(d.outcome,d.comparison,activeLifecycle?.candidate?.currency||'CAD')+(learned.length?`<small>PIOS learned: ${esc(learned.join(' · '))}</small>`:'<small>Outcome stored. No directional weight was applied for a neutral/unknown result.</small>');}
      if(typeof window.showToast==='function')window.showToast('Outcome recorded. PIOS is recalculating strategy from what actually happened.');
      await loadRecentLearning();
      setTimeout(recalculate,900);
    }catch(e){if(typeof window.showToast==='function')window.showToast(e.message);}
    finally{btn.disabled=false;btn.textContent='Complete & Learn';}
  }

  async function recalculate(){
    try{
      if(typeof window.runIntelligence==='function'){await window.runIntelligence();return;}
      await window.api('/functions/v1/universal-orchestrate',{method:'POST',body:'{}'});
      if(typeof window.loadExperience==='function')await window.loadExperience();
    }catch(_){ }
  }

  async function loadRecentLearning(){
    if(!localStorage.getItem('pios_token')||typeof window.api!=='function')return;
    try{
      const d=await window.api('/functions/v1/action-outcome');recentLearning=d?.recent_learning?.[0]||null;
      const box=$('recentLearning');if(!box)return;
      if(!recentLearning){box.innerHTML='<span>LEARNING MEMORY</span><div>No completed real-world outcome yet. PIOS currently learns mostly from decisions; real outcomes will carry more weight.</div>';return;}
      const r=recentLearning,o=r.outcome,c=r.candidate,comp=r.comparison;
      box.innerHTML=`<span>RECENT LEARNING</span><div><b>${esc(c?.title||'Completed action')}</b> · ${esc(label(o?.status||'unknown'))}${o?.monetary_impact!=null?` · ${esc(money(o.monetary_impact,c?.currency||'CAD'))}`:''}${o?.time_impact_hours!=null?` · ${Number(o.time_impact_hours)}h`:''}${comp?.time_variance_pct!=null?` · ${comp.time_variance_pct>0?'+':''}${comp.time_variance_pct}% time vs estimate`:''}</div>`;
    }catch(_){ }
  }

  async function loadActionState(){
    ensureShell();
    if(!localStorage.getItem('pios_token')||typeof window.api!=='function')return;
    try{
      const ctx=await window.api('/functions/v1/recommendation-context');
      activeCandidateId=ctx?.move?.candidate_id||'';
      if(!activeCandidateId){renderLifecycle({candidate:null,lifecycle:{stage:'none'},outcomes:[]});await loadRecentLearning();return;}
      const d=await window.api(`/functions/v1/action-outcome?candidate_id=${encodeURIComponent(activeCandidateId)}`);renderLifecycle(d);await loadRecentLearning();
    }catch(_){const chip=$('lifecycleChip');if(chip)chip.textContent='TEMPORARILY UNAVAILABLE';}
  }

  function installHooks(){
    ensureShell();
    if(typeof window.renderExperience==='function'&&!window.renderExperience.__piosOutcomeEnhanced){
      const original=window.renderExperience;const wrapped=function(data){const r=original(data);setTimeout(loadActionState,120);return r;};wrapped.__piosOutcomeEnhanced=true;window.renderExperience=wrapped;
    }
    if(typeof window.recordDecision==='function'&&!window.recordDecision.__piosOutcomeEnhanced){
      const original=window.recordDecision;const wrapped=async function(action){const r=await original(action);setTimeout(loadActionState,450);return r;};wrapped.__piosOutcomeEnhanced=true;window.recordDecision=wrapped;
    }
    if(localStorage.getItem('pios_token'))setTimeout(loadActionState,900);
  }

  window.addEventListener('load',()=>setTimeout(installHooks,180));
})();