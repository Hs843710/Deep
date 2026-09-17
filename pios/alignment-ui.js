(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  function relabel(){
    const name=$('displayName');
    const nameLabel=name?.closest('.field')?.querySelector('label');
    if(nameLabel) nameLabel.textContent='How should PIOS address you? (optional)';
    if(name) name.placeholder='Your name or preferred name';
    const constraints=$('constraints');
    const cLabel=constraints?.closest('.field')?.querySelector('label');
    if(cLabel) cLabel.textContent='Constraints / guardrails — one per line (or write none)';
  }
  function maskStaleStrategy(){
    if($('decisionLabel')) $('decisionLabel').textContent='REALIGNING TO CURRENT GOAL';
    if($('moveTitle')) $('moveTitle').textContent='Removing a stale recommendation…';
    if($('moveWhy')) $('moveWhy').textContent='The previous recommendation belongs to an intelligence domain that is no longer active for your current goal. PIOS will not treat it as valid while strategy is rebuilt.';
    if($('moveMetrics')) $('moveMetrics').innerHTML='';
    if($('moveActions')) $('moveActions').innerHTML='';
    if($('engineChip')) $('engineChip').textContent='ALIGNMENT GUARD';
  }
  async function selfHealStrategy(){
    if(!localStorage.getItem('pios_token')||typeof window.api!=='function')return;
    try{
      const router=await window.api('/functions/v1/intelligence-router',{method:'POST',body:'{}'});
      const active=new Set((router?.active||[]).map(x=>String(x.code)));
      const exp=await window.api('/functions/v1/intelligence-experience');
      const move=exp?.strategy?.next_best_move||{};
      if(move?.module_code && !active.has(String(move.module_code))){
        maskStaleStrategy();
        const status=$('connectionStatus');
        if(status)status.textContent='REALIGNING STRATEGY';
        await window.api('/functions/v1/universal-orchestrate',{method:'POST',body:'{}'});
        if(typeof window.loadExperience==='function')await window.loadExperience();
        if(typeof window.loadModules==='function')await window.loadModules();
        if(status)status.textContent='PERSONAL MODEL CONNECTED';
        if(typeof window.showToast==='function')window.showToast('PIOS removed a stale recommendation and realigned strategy to your current goal.');
      }
    }catch(_){ }
  }
  window.addEventListener('load',()=>{
    setTimeout(relabel,120);
    setTimeout(selfHealStrategy,900);
  });
})();
