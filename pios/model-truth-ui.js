(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  function score(t,o){
    const d=t?.digital_twin||{}, state=d.current_state||{}, counts=d.counts||{}, records=Array.isArray(o?.records)?o.records:[];
    let pct=0; const missing=[];
    if(d.primary_goal) pct+=15; else missing.push('goal');
    if(state.capital?.deployable!=null) pct+=15; else missing.push('finance');
    if((counts.capabilities||0)>0) pct+=10; else missing.push('capabilities');
    if((counts.resources||0)>0) pct+=15; else missing.push('assets/resources');
    if(records.length>0) pct+=25; else missing.push('operating pipeline');
    if((counts.outcomes||0)>0) pct+=20; else missing.push('real outcomes');
    return {pct,missing,records:records.length,outcomes:counts.outcomes||0,assets:counts.resources||0};
  }
  async function refresh(){
    if(!localStorage.getItem('pios_token')||typeof window.api!=='function') return;
    try{
      const [t,o]=await Promise.all([window.api('/functions/v1/trajectory-context'),window.api('/functions/v1/operating-memory')]);
      const q=score(t,o), status=$('lifeTwinStatus'), core=$('lifeCoreState'), detail=$('lifeTwinDetail');
      if(status){status.textContent=`LIVE EVIDENCE ${q.pct}%`;status.title='How much of the Digital Twin is backed by current operating evidence, not just setup fields.';}
      const gp=t?.digital_twin?.primary_goal?.progress?.progress_pct;
      if(core) core.textContent=`${Number(gp||0).toFixed(0)}% goal · ${q.pct}% live evidence`;
      if($('lifeBusinessMeta')&&q.records===0) $('lifeBusinessMeta').textContent='NO LIVE PIPELINE DATA';
      if($('lifeAssetsMeta')&&q.assets===0) $('lifeAssetsMeta').textContent='NOT MODELED';
      if(detail&&!detail.querySelector('.life-detail-grid')){
        detail.innerHTML=`<span>MODEL TRUTH</span><b>Profile setup is not the same as a complete Digital Twin.</b><div class="life-detail-grid"><div><span>Live evidence</span><b>${q.pct}%</b></div><div><span>Operating records</span><b>${q.records}</b></div><div><span>Real outcomes</span><b>${q.outcomes}</b></div><div><span>Assets modeled</span><b>${q.assets}</b></div></div><small style="display:block;margin-top:8px;color:#6f9db9">Missing: ${q.missing.join(' · ')||'none in the current evidence model'}</small>`;
      }
    }catch(_){ }
  }
  function hook(){setTimeout(refresh,1500);const btn=$('refreshBtn');if(btn)btn.addEventListener('click',()=>setTimeout(refresh,1800));}
  window.addEventListener('load',hook);
})();
