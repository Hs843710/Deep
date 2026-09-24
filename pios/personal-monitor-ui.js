
(() => {
 'use strict';
 const $=id=>document.getElementById(id);
 const api=(path,options)=>window.api(path,options);
 let config=null,alerts=[],status='unavailable',ownerToken=null,request=0;
 const current=()=>localStorage.getItem('pios_token');
 const openAlerts=()=>config?.enabled?alerts.filter(x=>x.status==='open').sort((a,b)=>
   (a.severity==='important'?0:1)-(b.severity==='important'?0:1)||
   Date.parse(a.first_observed_at||a.last_observed_at)-Date.parse(b.first_observed_at||b.last_observed_at)):[];
 function shareState(){
   window.piosMonitorState={enabled:config?.enabled===true,status,last_checked_at:config?.last_checked_at||null,
     open_count:openAlerts().length};
   window.piosMonitorTopAlert=openAlerts()[0]||null;
   window.applyPiosMonitorState?.();
 }
 function mount(){
   const stage=document.querySelector('.world-stage');
   if(!stage||$('piosAttentionStrip'))return;
   const panel=document.createElement('section');panel.id='piosAttentionStrip';panel.className='pios-attention-strip';
   panel.innerHTML='<div><span id="piosAttentionLabel">PERSONAL MONITOR · STATUS UNAVAILABLE</span><b id="piosAttentionHeadline">Waiting for a verified recorded-state check.</b><small id="piosAttentionDetail">In-app only. No external message has been sent.</small></div><button type="button" id="piosAttentionReview">Monitoring details</button>';
   stage.insertBefore(panel,$('presenceDeck')||stage.firstChild);
   $('piosAttentionReview').onclick=openDrawer;
   const drawer=document.createElement('aside');drawer.id='piosAttentionDrawer';drawer.className='drawer hidden presence-drawer';
   drawer.innerHTML='<div class="drawer-head"><div><div class="dialog-eyebrow">PRIVATE · RECORDED-STATE MONITOR</div><h2>Personal attention</h2></div><button type="button" class="btn ghost" id="piosAttentionClose">Close</button></div><div class="prepared-drawer-content" id="piosAttentionBody"></div>';
   document.body.appendChild(drawer);$('piosAttentionClose').onclick=()=>drawer.classList.add('hidden');
   paint();
 }
 const add=(parent,tag,value,cls)=>{
   const e=document.createElement(tag);e.textContent=String(value??'');if(cls)e.className=cls;parent.appendChild(e);return e;
 };
 function paint(){
   if(!$('piosAttentionStrip'))return;
   const connected=!!current(),open=openAlerts(),latest=config?.last_checked_at;
   const mode=!connected?'CONNECT FIRST':status!=='ready'?'STATUS UNAVAILABLE':!config?.enabled?'PAUSED':'HOURLY · IN-APP ONLY';
   $('piosAttentionLabel').textContent='PERSONAL MONITOR · '+mode;
   $('piosAttentionHeadline').textContent=!connected?'Your private attention record is not connected.':
     status!=='ready'?'The monitor state could not be verified.':
     !config?.enabled?'Monitoring is paused by you.':
     open.length?open.length+' recorded issue'+(open.length===1?'':'s')+' may need a status check.':
     'No outstanding issue found in the stored records checked.';
   $('piosAttentionDetail').textContent=latest&&config?.enabled?
     'Last database check: '+new Date(latest).toLocaleString()+' · commitments and issued quotes only':
     config?.enabled===false?'Historical alerts remain accessible. No checks are run for your account.':
     'Hourly internal checks; not a live watch of email, banking or all world events.';
   $('piosAttentionReview').hidden=!connected;
   $('piosAttentionReview').textContent=open.length?'Review '+open.length+' item'+(open.length===1?'':'s'):'Manage monitoring';
   $('piosAttentionStrip').classList.toggle('pios-attention-active',open.length>0);
 }
 function renderDrawer(){
   const box=$('piosAttentionBody');if(!box)return;box.replaceChildren();
   if(!current()){add(box,'p','Connect your personal model to access your own monitoring history.');return}
   add(box,'p','PIOS checks only recorded commitments and issued quotations each hour. An alert indicates a status check may be useful; it does not prove that a deadline was missed or a customer has not replied.','muted');
   if(config){
     const button=add(box,'button',config.enabled?'Pause hourly personal checks':'Resume hourly personal checks','btn');
     button.type='button';button.onclick=async()=>{
       button.disabled=true;
       try{
         await api('/rest/v1/personal_monitor_config?user_id=eq.'+encodeURIComponent(config.user_id),
           {method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({enabled:!config.enabled})});
         await load();
       }catch(_){add(box,'p','Unable to change monitoring status. No settings were confirmed.','presence-warning');button.disabled=false}
     };
   }
   const currentOpen=openAlerts();
   add(box,'h4',config?.enabled?currentOpen.length+' issue(s) awaiting review':'Monitoring paused');
   if(status!=='ready')add(box,'p','Unable to verify monitoring records. Please reconnect or retry.','presence-warning');
   else if(!currentOpen.length)add(box,'p','No unacknowledged issues in the stored records currently checked. Other sources may be incomplete or outdated.','muted');
   for(const alert of currentOpen.slice(0,20)){
     const item=document.createElement('div');item.className='pios-attention-item';box.appendChild(item);
     add(item,'b',alert.headline);
     add(item,'p',alert.detail);
     add(item,'small','Recorded '+new Date(alert.last_observed_at).toLocaleString()+' · '+alert.source_kind,'presence-source');
     const acknowledge=add(item,'button','Acknowledge · hide this alert','btn ghost');
     acknowledge.type='button';acknowledge.onclick=async()=>{
       acknowledge.disabled=true;
       try{
         await api('/rest/v1/personal_attention_events?id=eq.'+encodeURIComponent(alert.id),
           {method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({status:'acknowledged'})});
         await load();
       }catch(_){acknowledge.disabled=false;acknowledge.textContent='Could not save · retry'}
     };
   }
   add(box,'p','Acknowledge only hides an alert. It does not change the quotation, mark a commitment completed, contact a customer or prove the issue is resolved.','presence-warning');
 }
 function openDrawer(){mount();renderDrawer();$('piosAttentionDrawer')?.classList.remove('hidden')}
 function clear(){
   request++;config=null;alerts=[];status='unavailable';ownerToken=null;
   $('piosAttentionDrawer')?.classList.add('hidden');shareState();paint();
 }
 async function load(){
   const token=current(),seq=++request;
   if(!token||typeof window.api!=='function'){clear();return}
   if(ownerToken!==token){config=null;alerts=[];status='unavailable';ownerToken=token;shareState()}
   try{
     let [settings,events]=await Promise.all([
       api('/rest/v1/personal_monitor_config?select=user_id,enabled,last_checked_at,last_error&limit=1'),
       api('/rest/v1/personal_attention_events?select=id,kind,headline,detail,status,severity,source_kind,source_id,first_observed_at,last_observed_at&status=in.(open,acknowledged)&order=first_observed_at.asc&limit=40')
     ]);
     if(seq!==request||current()!==token)return;
     if(!Array.isArray(settings)||!settings.length){
       // Newly onboarded accounts receive their own default configuration; existing pause settings are never overwritten.
       const user=await api('/auth/v1/user');
       if(!user?.id||current()!==token)return;
       await api('/rest/v1/personal_monitor_config?on_conflict=user_id',
         {method:'POST',headers:{Prefer:'resolution=ignore-duplicates,return=minimal'},body:JSON.stringify([{user_id:user.id,enabled:true}])});
       settings=await api('/rest/v1/personal_monitor_config?select=user_id,enabled,last_checked_at,last_error&limit=1');
     }
     if(seq!==request||current()!==token)return;
     config=settings?.[0]||null;alerts=Array.isArray(events)?events:[];
     status=config?'ready':'unavailable';
   }catch(_){if(seq!==request||current()!==token)return;status='unavailable';alerts=[];config=null}
   shareState();paint();renderDrawer();
 }
 window.refreshPiosAttention=load;
 window.clearPiosAttention=clear;
 window.openPiosMonitor=openDrawer;
 function install(){
   mount();if(current())load();
   document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&current())load()});
   // This light client refresh only reads already-generated in-app records; scheduling runs on the server.
   setInterval(()=>{if(current()&&document.visibilityState!=='hidden')load()},10*60*1000);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
 else install();
})();
