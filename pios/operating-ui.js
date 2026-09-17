(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  let data=null,selectedId='';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=(v,c='CAD')=>v==null||v===''?'—':Number(v).toLocaleString('en-CA',{style:'currency',currency:c,maximumFractionDigits:0});
  const pct=v=>v==null?'—':`${Number(v).toFixed(1)}%`;
  const label=v=>String(v||'').replaceAll('_',' ').replace(/^\w/,c=>c.toUpperCase());
  const dateInput=v=>v?String(v).slice(0,10):'';
  const numVal=id=>{const v=$(id)?.value?.trim();return v===''||v==null?null:Number(v)};

  function ensureShell(){
    const left=document.querySelector('.left-rail');
    if(left&&!$('operatingState')){
      const panel=document.createElement('article');panel.id='operatingState';panel.className='panel operating-state';panel.innerHTML=`
        <div class="panel-title"><span>Business Operating State</span><span id="operatingChip" class="chip">NO DATA</span></div>
        <div id="operatingGoalGrid" class="operating-goal-grid"></div>
        <div id="operatingBottleneck" class="operating-bottleneck"><span>GROWTH SYSTEM</span><b>Waiting for operating memory…</b><small></small></div>
        <div class="operating-panel-actions"><button id="openOperatingBtn" class="btn" type="button">Operating Memory</button><small id="operatingPanelNote">Leads → quotes → wins → margin → learning</small></div>`;
      const twin=$('digitalTwinTrajectory')||document.querySelector('.trajectory-panel');
      if(twin)twin.insertAdjacentElement('afterend',panel); else left.prepend(panel);
      $('openOperatingBtn').onclick=openDrawer;
    }
    if(!$('operatingDrawer')){
      const drawer=document.createElement('aside');drawer.id='operatingDrawer';drawer.className='drawer operating-drawer hidden';drawer.innerHTML=`
        <div class="drawer-head"><div><div class="dialog-eyebrow">CURRENT STATE + OPERATING MEMORY</div><h2>Construction Growth Ledger</h2></div><button id="closeOperatingBtn" class="btn ghost">Close</button></div>
        <p class="muted">Track the factual pipeline PIOS uses to measure goal progress and learn where growth is constrained. Approved PIOS construction opportunities enter this ledger automatically.</p>
        <div id="operatingSummary" class="operating-summary"></div>
        <div class="operating-form">
          <div class="operating-form-head"><div><b id="operatingFormTitle">Add opportunity</b><span>Use actual values when known. PIOS computes gross profit and margin where possible.</span></div><button id="newOperatingBtn" class="btn ghost" type="button">New</button></div>
          <div class="operating-form-grid">
            <div class="field full"><label>Opportunity / project</label><input id="opTitle" placeholder="Project, tender or lead name" /></div>
            <div class="field"><label>Customer / organization</label><input id="opCustomer" /></div>
            <div class="field"><label>Service</label><input id="opService" placeholder="Roofing, concrete cutting, siding…" /></div>
            <div class="field"><label>Source</label><input id="opSource" placeholder="Referral, GC, tender, Google…" /></div>
            <div class="field"><label>Location</label><input id="opLocation" placeholder="Calgary, AB" /></div>
            <div class="field"><label>Stage</label><select id="opStage"><option value="lead">Lead</option><option value="qualified">Qualified</option><option value="estimating">Estimating</option><option value="quoted">Quoted</option><option value="submitted">Submitted</option><option value="won">Won</option><option value="lost">Lost</option><option value="active">Active project</option><option value="completed">Completed</option><option value="abandoned">Abandoned</option></select></div>
            <div class="field"><label>Lead date</label><input id="opLeadDate" type="date" /></div>
            <div class="field"><label>Quoted value</label><input id="opQuoted" type="number" min="0" step="0.01" /></div>
            <div class="field"><label>Contract value</label><input id="opContract" type="number" min="0" step="0.01" /></div>
            <div class="field"><label>Estimated direct cost</label><input id="opEstCost" type="number" min="0" step="0.01" /></div>
            <div class="field"><label>Actual direct cost</label><input id="opActualCost" type="number" min="0" step="0.01" /></div>
            <div class="field"><label>Estimator hours</label><input id="opHours" type="number" min="0" step="0.25" /></div>
            <div class="field"><label>Loss reason</label><input id="opLossReason" placeholder="Price, scope, capacity, no response…" /></div>
            <div class="field full"><label>Notes</label><textarea id="opNotes" rows="2"></textarea></div>
          </div>
          <div class="operating-form-actions"><button id="saveOperatingBtn" class="btn primary" type="button">Save record</button><button id="deleteOperatingBtn" class="btn danger hidden" type="button">Delete</button></div>
          <div id="operatingFormMessage" class="form-message"></div>
        </div>
        <div id="operatingRecords" class="operating-records"></div>`;
      document.body.appendChild(drawer);
      $('closeOperatingBtn').onclick=closeDrawer;$('newOperatingBtn').onclick=resetForm;$('saveOperatingBtn').onclick=saveRecord;$('deleteOperatingBtn').onclick=deleteRecord;
    }
  }

  function daysLeft(v){if(!v)return null;const d=Math.ceil((new Date(v+'T23:59:59').getTime()-Date.now())/86400000);return Number.isFinite(d)?Math.max(0,d):null}
  function renderHome(d){ensureShell();const g=d?.goal_tracking||{},s=d?.summary||{},projects=g.projects||{},value=g.contract_value||{},margin=g.margin||{};const chip=$('operatingChip');if(chip)chip.textContent=(d?.records||[]).length?`${(d.records||[]).length} RECORDS`:'NO OPERATING DATA';const left=daysLeft(g.target_date);$('operatingGoalGrid').innerHTML=`
    <div><span>Projects</span><b>${projects.current??0} / ${projects.target??'—'}</b><small>${projects.gap!=null?`${projects.gap} remaining`:''}</small></div>
    <div><span>Won contract value</span><b>${money(value.current||0)} / ${money(value.target)}</b><small>${value.progress_pct!=null?`${value.progress_pct}% of target`:''}</small></div>
    <div><span>Margin</span><b>${margin.average_estimated==null?'—':pct(margin.average_estimated)} / ≥${margin.minimum??'—'}%</b><small>${margin.unverified_wins?`${margin.unverified_wins} win(s) need margin evidence`:'qualifying wins only'}</small></div>
    <div><span>Deadline</span><b>${g.target_date||'—'}</b><small>${left==null?'':`${left} days remaining`}</small></div>`;
    const b=s.bottleneck||{};$('operatingBottleneck').innerHTML=`<span>GROWTH SYSTEM · LAST ${s.window_days||90} DAYS</span><b>${esc(b.title||'Bottleneck not identified yet')}</b><small>${esc(b.detail||'Enter operating evidence to diagnose the pipeline.')}</small>`;
    $('operatingPanelNote').textContent=`${s.open||0} open · ${s.quoted||0} quoted · ${s.won||0} won`;
  }

  function renderDrawer(d){ensureShell();const s=d?.summary||{};$('operatingSummary').innerHTML=`<div><span>Leads</span><b>${s.leads||0}</b></div><div><span>Qualified</span><b>${s.qualified||0}</b></div><div><span>Quoted</span><b>${s.quoted||0}</b></div><div><span>Won</span><b>${s.won||0}</b></div><div><span>Win rate</span><b>${pct(s.win_rate)}</b></div><div><span>Won value</span><b>${money(s.won_contract_value||0)}</b></div><div><span>Gross profit</span><b>${money(s.gross_profit||0)}</b></div><div><span>Estimator time</span><b>${Number(s.estimator_hours||0).toLocaleString()}h</b></div>`;
    const rows=d?.records||[];$('operatingRecords').innerHTML=rows.length?rows.map(r=>{const value=r.contract_value??r.quoted_value,margin=r.actual_margin_pct??r.estimated_margin_pct;return`<div class="operating-record ${r.id===selectedId?'selected':''}" data-op-id="${esc(r.id)}"><div class="operating-record-top"><div><b>${esc(r.title)}</b><small>${esc([r.customer,r.service_type,r.location].filter(Boolean).join(' · ')||'No customer/service details yet')}</small></div><span class="pipeline-stage ${esc(r.stage)}">${esc(label(r.stage))}</span></div><div class="operating-record-metrics">${value!=null?`<span>${esc(money(value))}</span>`:''}${margin!=null?`<span>${esc(pct(margin))} margin</span>`:''}${r.estimator_hours!=null?`<span>${Number(r.estimator_hours)}h estimating</span>`:''}${r.origin==='pios_candidate'?'<span>PIOS-linked</span>':''}</div></div>`}).join(''):'<div class="operating-empty">No operating records yet. Add recent leads and quotes, or approve a PIOS construction opportunity and it will enter this ledger automatically.</div>';
    document.querySelectorAll('[data-op-id]').forEach(el=>el.onclick=()=>selectRecord(el.dataset.opId));
  }

  function resetForm(){selectedId='';$('operatingFormTitle').textContent='Add opportunity';$('deleteOperatingBtn').classList.add('hidden');for(const id of ['opTitle','opCustomer','opService','opSource','opLocation','opQuoted','opContract','opEstCost','opActualCost','opHours','opLossReason','opNotes'])$(id).value='';$('opStage').value='lead';$('opLeadDate').value=new Date().toISOString().slice(0,10);$('operatingFormMessage').textContent='';renderDrawer(data)}
  function selectRecord(id){const r=(data?.records||[]).find(x=>x.id===id);if(!r)return;selectedId=id;$('operatingFormTitle').textContent='Edit operating record';$('deleteOperatingBtn').classList.remove('hidden');$('opTitle').value=r.title||'';$('opCustomer').value=r.customer||'';$('opService').value=r.service_type||'';$('opSource').value=r.source||'';$('opLocation').value=r.location||'';$('opStage').value=r.stage||'lead';$('opLeadDate').value=dateInput(r.lead_date);$('opQuoted').value=r.quoted_value??'';$('opContract').value=r.contract_value??'';$('opEstCost').value=r.estimated_direct_cost??'';$('opActualCost').value=r.actual_direct_cost??'';$('opHours').value=r.estimator_hours??'';$('opLossReason').value=r.loss_reason||'';$('opNotes').value=r.notes||'';renderDrawer(data)}
  function payload(){return{title:$('opTitle').value.trim(),customer:$('opCustomer').value.trim()||null,service_type:$('opService').value.trim()||null,source:$('opSource').value.trim()||null,location:$('opLocation').value.trim()||null,stage:$('opStage').value,lead_date:$('opLeadDate').value||null,quoted_value:numVal('opQuoted'),contract_value:numVal('opContract'),estimated_direct_cost:numVal('opEstCost'),actual_direct_cost:numVal('opActualCost'),estimator_hours:numVal('opHours'),loss_reason:$('opLossReason').value.trim()||null,notes:$('opNotes').value.trim()||null}}

  async function loadOperating(){ensureShell();if(!localStorage.getItem('pios_token')||typeof window.api!=='function')return;try{data=await window.api('/functions/v1/operating-memory');renderHome(data);renderDrawer(data)}catch(e){const chip=$('operatingChip');if(chip)chip.textContent='MEMORY OFFLINE';}}
  async function saveRecord(){const p=payload();if(!p.title){$('operatingFormMessage').textContent='Opportunity / project name is required.';return}const btn=$('saveOperatingBtn');btn.disabled=true;btn.textContent='Saving…';try{const body=selectedId?{id:selectedId,...p}:p;data=await window.api('/functions/v1/operating-memory',{method:selectedId?'PATCH':'POST',body:JSON.stringify(body)});selectedId=data?.saved?.id||selectedId;renderHome(data);renderDrawer(data);if(selectedId)selectRecord(selectedId);$('operatingFormMessage').textContent='Saved. Goal progress and operating diagnostics recalculated.';if(typeof window.showToast==='function')window.showToast('Operating memory updated.');setTimeout(()=>{if(typeof window.loadTwin==='function')window.loadTwin();},180)}catch(e){$('operatingFormMessage').textContent=e.message}finally{btn.disabled=false;btn.textContent='Save record'}}
  async function deleteRecord(){if(!selectedId)return;const btn=$('deleteOperatingBtn');btn.disabled=true;try{data=await window.api('/functions/v1/operating-memory',{method:'DELETE',body:JSON.stringify({id:selectedId})});resetForm();renderHome(data);renderDrawer(data);if(typeof window.showToast==='function')window.showToast('Operating record deleted.')}catch(e){$('operatingFormMessage').textContent=e.message}finally{btn.disabled=false}}
  function openDrawer(){ensureShell();$('operatingDrawer').classList.remove('hidden');if(!selectedId)resetForm();loadOperating()}
  function closeDrawer(){$('operatingDrawer')?.classList.add('hidden')}

  function installHooks(){ensureShell();if(typeof window.renderExperience==='function'&&!window.renderExperience.__piosOperatingEnhanced){const original=window.renderExperience;const wrapped=function(d){const r=original(d);setTimeout(loadOperating,180);return r};wrapped.__piosOperatingEnhanced=true;window.renderExperience=wrapped}if(typeof window.recordDecision==='function'&&!window.recordDecision.__piosOperatingEnhanced){const original=window.recordDecision;const wrapped=async function(action){const r=await original(action);if(action==='approve'||action==='execute')setTimeout(loadOperating,450);return r};wrapped.__piosOperatingEnhanced=true;window.recordDecision=wrapped}if(localStorage.getItem('pios_token'))setTimeout(loadOperating,1100)}
  window.loadOperatingMemory=loadOperating;
  window.addEventListener('load',()=>setTimeout(installHooks,340));
})();