
(() => {
 'use strict';
 const $=id=>document.getElementById(id);
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let council=null,personal=null,strategyMove=null,works=[],workError=null,loadingSeq=0,loadedToken=null,autoPreparedForToken=null;
 const label=(x)=>x?'REVIEWED '+new Intl.DateTimeFormat('en-CA',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(x)):'NO VERIFIED REVIEW';
 const currentWork=()=>works.find(w=>w?.status==='prepared'&&w?.is_current&&
  (!strategyMove?.candidate_id||w.candidate_id===strategyMove.candidate_id)&&
  w?.content?.action_status?.preparation==='completed'&&
  w?.content?.action_status?.external_contact==='not_performed'&&
  w?.content?.draft?.external_message_sent===false)||null;
 function mount(){
  const stage=document.querySelector('.world-stage');
  if(!stage||$('presenceDeck'))return;
  const deck=document.createElement('section');deck.id='presenceDeck';deck.className='presence-deck';
  deck.innerHTML='<div class="presence-header"><div><span class="presence-eyebrow"><i class="presence-indicator"></i> PERSONAL INTELLIGENCE · <span id="presenceChecked">NOT CONNECTED</span></span><h2 id="presenceStatement">Your life, not another feed.</h2><p id="presenceContext">Connect your Digital Twin to let PIOS work from your actual goals, resources and responsibilities.</p></div><button id="presenceDetails" type="button" class="presence-details">Inspect reasoning ↗</button></div>'
   +'<div class="presence-grid"><article class="presence-tile needs"><span>01 / NEEDS YOU</span><b id="presenceNeed">Nothing assessed yet.</b><small id="presenceNeedMeta">Personal judgment is required only when the evidence warrants it.</small><button type="button" id="presenceNeedAction">Review decision</button></article>'
   +'<article class="presence-tile prepared"><span>02 / PREPARED FOR YOU</span><b id="presencePrepared">No completed preparation loaded.</b><small id="presencePreparedMeta">A plan is not completed work. Only source-linked preparation appears here.</small><button type="button" id="presencePreparedAction">Inspect prepared work</button></article>'
   +'<article class="presence-tile watch"><span>03 / REST OF THE WORLD</span><b id="presenceQuiet">Only changes affecting your life reach the home screen.</b><small id="presenceQuietMeta">Outside data remains accessible in World Intelligence.</small></article></div>'
   +'<div class="presence-foot"><span id="presenceWorkState">ACTUAL STATE · NO OUTCOME ASSUMED</span><span id="presenceCadence">Checks run when you connect or refresh. Continuous monitoring is not enabled here.</span></div>';
  stage.appendChild(deck);
  const drawer=document.createElement('aside');drawer.className='drawer hidden presence-drawer';drawer.id='preparedDrawer';
  drawer.innerHTML='<div class="drawer-head"><div><div class="dialog-eyebrow">INTERNAL WORK · SOURCE LINKED</div><h2>Prepared for you</h2></div><button type="button" class="btn ghost" id="closePreparedDrawer">Close</button></div><div id="preparedDrawerContent" class="prepared-drawer-content"></div>';
  document.body.appendChild(drawer);
  $('closePreparedDrawer').onclick=()=>drawer.classList.add('hidden');
  $('presenceDetails').onclick=()=>{
    if(typeof window.piosNavigate==='function')window.piosNavigate('twin');
    const btn=$('executiveCouncilStrip');
    if(btn){btn.click();$('lifeTwinDetail')?.scrollIntoView({behavior:'smooth',block:'center'});}
    else if(typeof window.piosNavigate==='function')window.piosNavigate('decide');
  };
  $('presenceNeedAction').onclick=()=>{
    if(typeof window.piosNavigate==='function')window.piosNavigate('decide');
    document.querySelector('.next-move')?.scrollIntoView({behavior:'smooth',block:'start'});
  };
  $('presencePreparedAction').onclick=async()=>{
    if(currentWork()){openPrepared();return}
    const btn=$('presencePreparedAction');btn.disabled=true;btn.textContent='Preparing internally…';
    try{
      const result=await prepareQuote();
      if(result?.prepared&&currentWork())openPrepared();
      else if($('presencePreparedMeta'))$('presencePreparedMeta').textContent=
        result?.reason||'No owned quotation is currently available for safe preparation.';
    }catch(e){
      if($('presencePreparedMeta'))$('presencePreparedMeta').textContent=
        'Internal preparation could not be confirmed. Nothing was sent.';
    }finally{btn.disabled=false;render()}
  };
  render();
 }
 function render(){
  mountIfMissing();
  const connected=!!localStorage.getItem('pios_token');
  const chief=connected?(council?.chief_of_staff||{}):{},work=connected?currentWork():null;
  const reviewedAt=window.__piosPresenceAsOf||null;
  if($('presenceChecked'))$('presenceChecked').textContent=connected?(label(reviewedAt)):'NOT CONNECTED';
  const strategyActive=connected&&strategyMove?.candidate_id&&
    !['DO_NOTHING','DO NOTHING','NONE'].includes(String(strategyMove.decision||'').toUpperCase());
  const councilNeed=chief.next_move||null;
  const need=councilNeed||(strategyActive?{title:strategyMove.title||'A recorded decision needs review',
    detail:strategyMove.action||strategyMove.why||'Review the recorded next step.'}:null);
  const priority=!connected?'Connect to load your personal model':need?.title||
    (council?.mode==='quiet'?'No material issue identified in the latest reviewed evidence.':
    council?'No decision warrants attention in the reviewed evidence.':
    strategyMove?'Specialist review unavailable; inspect the latest recorded strategy.':
    'Personal briefing unavailable. Refresh intelligence to retry.');
  if($('presenceStatement'))$('presenceStatement').textContent=connected?
    (council?.mode==='blocked'?'A recorded constraint needs your attention.':
    need?'I have identified the next decision to review.':
    council?.mode==='quiet'?'No material action identified in this review.':
    'Personal intelligence is not fully available.'):
    'Your life, not another feed.';
  if($('presenceContext'))$('presenceContext').textContent=connected?
    (chief.reason||(strategyActive?'A recorded strategy exists. Specialist verification may still be pending.':
    'The personal briefing has not been fully verified; no external action is assumed.')):
    'Connect your Digital Twin to let PIOS work from your actual goals, resources and responsibilities.';
  if($('presenceNeed'))$('presenceNeed').textContent=priority;
  if($('presenceNeedMeta'))$('presenceNeedMeta').textContent=need?.detail||(!connected?'Your private state stays account-specific.':
    'No extra decision has been justified by the information checked so far.');
  if($('presenceNeedAction'))$('presenceNeedAction').hidden=!connected||!need;
  if($('presencePrepared'))$('presencePrepared').textContent=work?
    (work.content?.headline||'An internal package is ready to review.'):
    workError?'Prepared work is temporarily unavailable.':
    'No completed internal work recorded for the current state.';
  if($('presencePreparedMeta'))$('presencePreparedMeta').textContent=work?
    'Source-linked internal draft and checks created. Nothing was sent; outcome remains unverified.':
    workError?'The preparation service could not be verified; nothing has been marked completed.':'Planned or AUTO-eligible steps are not treated as completed work.';
  if($('presencePreparedAction')){
    const relevantBusiness=Array.isArray(council?.specialists)&&council.specialists.some(x=>x.id==='business'&&x.status!=='watch');
    const selectedQuote=!!strategyMove?.candidate_id&&/follow.up|quotation|quote|estimate/i.test(String(strategyMove.title||'')+' '+String(strategyMove.action||''));
    $('presencePreparedAction').hidden=!connected||(!work&&!relevantBusiness&&!selectedQuote);
    $('presencePreparedAction').textContent=work?'Inspect prepared work':'Prepare quotation follow-up';
  }
  if($('presenceQuiet'))$('presenceQuiet').textContent=!connected?'Connect to personalize the attention filter.':
    council?.mode==='quiet'?'No additional personal intervention identified in this review.':
    'Lower-priority signals remain outside your command view.';
  if($('presenceQuietMeta'))$('presenceQuietMeta').textContent='Recheck on your next intelligence run; this screen does not establish a continuous watch.';
  if($('presenceWorkState'))$('presenceWorkState').textContent=work?'1 VERIFIED INTERNAL PREPARATION · NO CUSTOMER CONTACT':'NO COMPLETED PREPARATION CLAIMED';
 }
 function mountIfMissing(){
  if(!$('presenceDeck')&&document.querySelector('.world-stage'))mount();
 }
 function openPrepared(){
  const w=currentWork(),drawer=$('preparedDrawer'),box=$('preparedDrawerContent');if(!w||!drawer||!box)return;
  const content=w.content||{},draft=content.draft||{};
  box.replaceChildren();
  const line=(tag,text,cls)=>{const el=document.createElement(tag);el.textContent=text||'';if(cls)el.className=cls;box.appendChild(el);return el};
  line('h3',content.headline||'Prepared internal work');
  line('p',content.summary||'This package was prepared from a recorded operating opportunity.','muted');
  line('p','Source checked: '+new Date(w.source_updated_at).toLocaleString()+' · Draft created: '+new Date(w.created_at).toLocaleString(),'presence-source');
  line('h4','Customer follow-up draft');
  const subject=document.createElement('input');subject.readOnly=true;subject.value=draft.subject||'';subject.setAttribute('aria-label','Draft subject');box.appendChild(subject);
  const body=document.createElement('textarea');body.readOnly=true;body.rows=7;body.value=draft.body||'';body.setAttribute('aria-label','Draft body');box.appendChild(body);
  const copy=document.createElement('button');copy.type='button';copy.className='btn';copy.textContent='Copy draft for your review';copy.onclick=async()=>{
    try{await navigator.clipboard.writeText((draft.subject||'')+'\n\n'+(draft.body||''));copy.textContent='Copied · no message sent';}
    catch(_){body.focus();body.select();copy.textContent='Select and copy the draft manually';}
  };box.appendChild(copy);
  line('h4','Internal decision checks');
  for(const check of content.internal_checks||[])line('p',(check.label||'Check')+': '+(check.detail||''),'presence-check');
  line('h4','Still unknown');
  for(const unknown of content.unknowns||[])line('p','• '+unknown,'presence-unknown');
  line('p','Approval required before any external communication, bid, purchase, contract or commitment. This internal draft is not a completed customer follow-up.','presence-warning');
  drawer.classList.remove('hidden');
 }
 async function loadWork(){
  const token=localStorage.getItem('pios_token'),seq=++loadingSeq;
  if(!token||typeof window.api!=='function'){works=[];loadedToken=null;render();return}
  try{
    const result=await window.api('/functions/v1/executive-workbench');
    if(seq!==loadingSeq||localStorage.getItem('pios_token')!==token)return;
    loadedToken=token;workError=null;works=Array.isArray(result?.works)?result.works:[];
  }catch(_){if(seq!==loadingSeq)return;workError='read_unavailable';works=[];}
  render();
  const relevant=Array.isArray(council?.specialists)&&council.specialists.some(x=>x.id==='business'&&x.status!=='watch');
  const selectedQuote=!!strategyMove?.candidate_id&&/follow.up|quotation|quote|estimate/i.test(String(strategyMove.title||'')+' '+String(strategyMove.action||''));
  // An owned quote may be prepared internally once per connected session.
  // The operation is idempotent for an unchanged source and never sends anything.
  if((relevant||selectedQuote)&&strategyMove?.candidate_id&&!currentWork()&&autoPreparedForToken!==token){
    autoPreparedForToken=token;
    try{
      const prep=await window.api('/functions/v1/executive-workbench',{method:'POST',
        body:JSON.stringify({operation:'prepare_quote',candidate_id:strategyMove.candidate_id})});
      if(prep?.prepared&&localStorage.getItem('pios_token')===token)await loadWork();
    }catch(_){ /* An actual preparation failure must remain visible as not prepared. */ }
  }
 }
 async function prepareQuote(){
  if(typeof window.api!=='function'||!localStorage.getItem('pios_token'))return null;
  const result=await window.api('/functions/v1/executive-workbench',{method:'POST',body:JSON.stringify({operation:'prepare_quote',candidate_id:strategyMove?.candidate_id||null})});
  await loadWork();return result;
 }
 function update({council:nextCouncil,personalValue,asOf}={}){
  const token=localStorage.getItem('pios_token');
  if(!token){council=null;personal=null;strategyMove=null;works=[];workError=null;loadedToken=null;autoPreparedForToken=null;window.__piosPresenceAsOf=null;if($('preparedDrawer'))$('preparedDrawer').classList.add('hidden');render();return}
  if(loadedToken&&loadedToken!==token){works=[];workError=null;loadedToken=null;autoPreparedForToken=null}
  council=nextCouncil||null;personal=personalValue||null;
  window.__piosPresenceAsOf=asOf||new Date().toISOString();
  render();loadWork();
 }
 function install(){
  mount();
  if(localStorage.getItem('pios_token'))loadWork();
 }
 window.updatePiosStrategy=(move)=>{
   strategyMove=move&&typeof move==='object'?move:null;
   render();
   if(localStorage.getItem('pios_token')&&strategyMove?.candidate_id)loadWork();
 };
 window.updatePiosPresence=update;
 window.refreshPiosPresence=loadWork;
 window.preparePiosQuoteInternally=prepareQuote;
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
 else install();
})();
