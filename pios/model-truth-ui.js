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
      const q=score(t,o,sources);
      // Coverage is diagnostic telemetry. It belongs in Evidence & System, not the person's live Twin header.
      const gp=t?.digital_twin?.primary_goal?.progress?.progress_pct;
      if($('lifeBusinessMeta')) $('lifeBusinessMeta').textContent=q.records?`${q.records} observed operating record${q.records===1?'':'s'}`:'NO LIVE PIPELINE DATA';
      if($('lifeAssetsMeta')) $('lifeAssetsMeta').textContent=q.assets?`${q.assets} modeled resources`:'NOT MODELED';
      // Model-coverage diagnostics belong to Evidence & System, never the live decision surface.
      // Do not overwrite a Chief of Staff brief or the person's selected Twin node.
      const host=document.querySelector('.right-rail');
      if(host&&!$('modelTruthDiagnostics')){
        const panel=document.createElement('article');panel.className='panel model-truth-panel';
        panel.id='modelTruthDiagnostics';
        panel.innerHTML='<div class="panel-title"><span>Observed model coverage</span></div><div id="modelTruthMetrics" class="empty-copy"></div>';
        host.appendChild(panel);
      }
      const metrics=$('modelTruthMetrics');
      if(metrics){
        metrics.replaceChildren();
        const lines=[
          'Observed evidence coverage: '+q.pct+'%',
          'Operating records: '+q.records+' · Real outcomes: '+q.outcomes,
          'Connected sources: '+q.sources+' · Evidence records: '+q.evidence,
          'Modeled resources: '+q.assets,
          'Sources: '+(q.sourceNames.join(' · ')||'none'),
          'Evidence still missing: '+(q.missing.join(' · ')||'none recorded')
        ];
        for(const line of lines){const el=document.createElement('p');el.textContent=line;metrics.appendChild(el);}
      }
    }catch(_){ }
  }
  function hook(){setTimeout(refresh,1500);const btn=$('refreshBtn');if(btn)btn.addEventListener('click',()=>setTimeout(refresh,1800));}
  window.addEventListener('load',hook);
})();