(() => {
  'use strict';
  const views = new Set(['command','twin','world','decide','act','system']);
  const labels = {
    command:'Command Center',twin:'Your Digital Twin',world:'World Intelligence',
    decide:'Decisions & Futures',act:'Actions & Outcomes',system:'Evidence & Diagnostics'
  };
  const $ = id => document.getElementById(id);

  function setWorldMode(view) {
    const stage=document.querySelector('.world-stage');
    if(!stage) return;
    const world=view==='world';
    stage.classList.toggle('world-mode',world);
    stage.classList.toggle('twin-mode',!world);
    $('worldModeBtn')?.classList.toggle('active',world);
    $('twinModeBtn')?.classList.toggle('active',!world);
  }

  function focusView(view,{scroll=true}={}) {
    const chosen=views.has(view)?view:'command';
    document.body.dataset.piosView=chosen;
    document.querySelectorAll('[data-pios-go]').forEach(button=>{
      const active=button.dataset.piosGo===chosen;
      button.classList.toggle('active',active);
      button.setAttribute('aria-current',active?'page':'false');
    });
    if($('workspaceTitle')) $('workspaceTitle').textContent=labels[chosen];
    if($('workspaceHint')) $('workspaceHint').textContent=({
      command:'One living model · one coordinated brief · one useful next move',
      twin:'Observed personal state, goals, resources and constraints',
      world:'External evidence only when it has a defensible personal connection',
      decide:'Alternatives, future states, guardrails and decision provenance',
      act:'Owned opportunities, approved steps, outcomes and learning',
      system:'Source coverage, data quality, model changes and benchmarks'
    })[chosen];
    if(chosen==='world'||chosen==='twin'||chosen==='command')setWorldMode(chosen);
    // Only reveal, never delete, state owned by other modules.
    if(scroll) document.querySelector('.workspace-header')?.scrollIntoView({behavior:'smooth',block:'start'});
  }

  function ensureNavigation(){
    const nav=$('piosNavigation');if(!nav)return;
    nav.querySelectorAll('[data-pios-go]').forEach(btn=>{
      btn.addEventListener('click',()=>focusView(btn.dataset.piosGo));
    });
    $('piosModelButton')?.addEventListener('click',()=>{
      focusView('twin');
      const settings=$('settingsBtn');
      if(settings&&!settings.classList.contains('hidden')) settings.click();
    });
    // A separate mode switch within the globe must keep the global navigation in sync.
    document.addEventListener('click',event=>{
      const btn=event.target?.closest?.('#worldModeBtn,#twinModeBtn');
      if(!btn)return;
      const view=btn.id==='worldModeBtn'?'world':'twin';
      focusView(view,{scroll:false});
    });
    focusView('command',{scroll:false});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensureNavigation,{once:true});
  else ensureNavigation();
  window.piosNavigate=focusView;
})();