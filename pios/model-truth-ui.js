(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  function score(t,o,sources){
    const d=t?.digital_twin||{}, state=d.current_state||{}, counts=d.counts||{}, records=Array.isArray(o?.records)?o.records:[], src=Array.isArray(sources)?sources.filter(x=>x.status==='connected'||x.status==='partial'):[];
    let pct=0; const missing=[];
    if(d.primary_goal) pct+=15; else missing.push('goal');
    if(state.capital?.deployable!=null) pct+=15; else missing.push('finance');
    if((counts.capabilities||0)>0) pct+=10; else missing.push('capabilities');
    const assets=counts.resources||0;
    if(assets>=3)pct+=10; else if(assets>0){pct+=5;missing.push('broader resource model')} else missing.push('assets/resources');
    const rc=records.length;
    if(rc>=10)pct+=20; else if(rc>=5){pct+=17;missing.push('deeper operating history')} else if(rc>=3){pct+=12;missing.push('deeper operating history')} else if(rc>0){pct+=6;missing.push('enough operating history for diagnosis')} else missing.push('operating pipeline');
    const outcomes=counts.outcomes||0;
    if(outcomes>=3)pct+=20; else if(outcomes>0){pct+=10;missing.push('more real outcomes')} else missing.push('real outcomes');
    if(src.length>=2)pct+=10; else if(src.length===1){pct+=5;missing.push('additional connected sources')} else missing.push('connected evidence sources');
    return {pct:Math.min(100,pct),missing,records:rc,outcomes,assets,sources:src.length,evidence:src.reduce((a,x)=>a+Number(x.evidence_count||0),0),sourceNames:src.map(x=>String(x.source_kind||'source').replaceAll('_',' '))};
  }
  async function refresh(){
    if(!localStorage.getItem('pios_token')||typeof window.api!=='function') return;
    try{
      const [t,o,sources]=await Promise.all([
        window.api('/functions/v1/trajectory-context'),
        window.api('/functions/v1/operating-memory'),
        window.api('/rest/v1/connected_source_sync_state?select=source_kind,status,last_observed_at,evidence_count&order=last_sync_at.desc')
      ]);
      const q=score(t,o,sources), status=$('lifeTwinStatus'), core=$('lifeCoreState'), detail=$('lifeTwinDetail');
      if(status){status.textContent=`LIVE EVIDENCE ${q.pct}%`;status.title='Coverage of the Digital Twin backed by current observed state. Setup fields alone do not make this 100%.';}
      const gp=t?.digital_twin?.primary_goal?.progress?.progress_pct;
      if(core) core.textContent=`${Number(gp||0).toFixed(0)}% goal · ${q.pct}% observed`;
      if($('lifeBusinessMeta')) $('lifeBusinessMeta').textContent=q.records?`${q.records} observed operating record${q.records===1?'':'s'}`:'NO LIVE PIPELINE DATA';
      if($('lifeAssetsMeta')) $('lifeAssetsMeta').textContent=q.assets?`${q.assets} modeled resources`:'NOT MODELED';
      if(detail&&!detail.querySelector('.life-detail-grid')){
        detail.innerHTML=`<span>MODEL TRUTH</span><b>The Twin separates configured profile data from observed life evidence.</b><div class="life-detail-grid"><div><span>Live evidence</span><b>${q.pct}%</b></div><div><span>Operating records</span><b>${q.records}</b></div><div><span>Connected sources</span><b>${q.sources}</b></div><div><span>Observed evidence</span><b>${q.evidence}</b></div><div><span>Real outcomes</span><b>${q.outcomes}</b></div><div><span>Resources modeled</span><b>${q.assets}</b></div></div><small style="display:block;margin-top:8px;color:#6f9db9">Sources: ${q.sourceNames.join(' · ')||'none'}<br>Still missing: ${q.missing.join(' · ')||'none in the current evidence model'}</small>`;
      }
    }catch(_){ }
  }
  function hook(){setTimeout(refresh,1500);const btn=$('refreshBtn');if(btn)btn.addEventListener('click',()=>setTimeout(refresh,1800));}
  window.addEventListener('load',hook);
})();