import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const U=Deno.env.get('SUPABASE_URL')!,A=Deno.env.get('SUPABASE_ANON_KEY')!,K=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const C={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,x-client-info,apikey,content-type','Access-Control-Allow-Methods':'GET,POST,OPTIONS'};
const J=(d:any,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{...C,'Content-Type':'application/json','Cache-Control':'no-store'}});
const n=(x:any)=>x==null?null:Number(x);

async function F(url:string,init:RequestInit={}){let r=await fetch(url,init),t=await r.text();if(!r.ok&&r.status===401&&t.includes('JWT issued at future')){await new Promise(x=>setTimeout(x,700));r=await fetch(url,init);t=await r.text()}if(!r.ok)throw Error(`${r.status} ${t.slice(0,700)}`);return t?JSON.parse(t):null}
async function auth(jwt:string){try{return await F(`${U}/auth/v1/user`,{headers:{apikey:A,Authorization:`Bearer ${jwt}`}})}catch{return null}}
async function R(path:string,init:RequestInit={}){const h=new Headers(init.headers||{});h.set('apikey',K);h.set('Authorization',`Bearer ${K}`);if(init.body)h.set('Content-Type','application/json');return F(`${U}/rest/v1/${path}`,{...init,headers:h})}

async function learn(uid:string,dimension:string,key:string,delta:number){
  if(!key||!Number.isFinite(delta)||delta===0)return null;
  const cur=(await R(`learning_weights?user_id=eq.${uid}&dimension=eq.${encodeURIComponent(dimension)}&key=eq.${encodeURIComponent(key)}&select=*`))?.[0];
  const before=Number(cur?.weight||1),after=Math.max(.5,Math.min(1.5,before+delta)),row={user_id:uid,dimension,key,weight:Number(after.toFixed(3)),evidence_count:Number(cur?.evidence_count||0)+1,updated_at:new Date().toISOString()};
  const saved=(await R('learning_weights?on_conflict=user_id,dimension,key',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify([row])}))?.[0]||row;
  return{...saved,before_weight:Number(before.toFixed(3)),delta:Number(delta.toFixed(3))};
}

function scopeKeys(s:any){if(Array.isArray(s))return s.map(String);if(s&&typeof s==='object'){const a=s.matches||s.matched_terms||[];return Array.isArray(a)?a.map(String):[]}return[]}
function predictedVsActual(c:any,o:any){
  if(!c||!o)return null;
  const expectedTime=n(c.time_required_hours),actualTime=n(o.time_impact_hours),actualMoney=n(o.monetary_impact),upLo=n(c.expected_upside_low),upHi=n(c.expected_upside_high),downLo=n(c.expected_downside_low),downHi=n(c.expected_downside_high);
  let timeVariancePct=null;if(expectedTime!=null&&expectedTime>0&&actualTime!=null)timeVariancePct=Number((((actualTime-expectedTime)/expectedTime)*100).toFixed(1));
  let moneyAssessment='not_comparable';
  if(actualMoney!=null){
    if(actualMoney>=0&&(upLo!=null||upHi!=null)){const lo=upLo??upHi!,hi=upHi??upLo!;moneyAssessment=actualMoney<lo?'below_expected_upside':actualMoney>hi?'above_expected_upside':'within_expected_upside'}
    else if(actualMoney<0&&(downLo!=null||downHi!=null)){const lo=Math.min(downLo??downHi!,downHi??downLo!),hi=Math.max(downLo??downHi!,downHi??downLo!);const loss=Math.abs(actualMoney);moneyAssessment=loss<Math.abs(lo)?'better_than_expected_downside':loss>Math.abs(hi)?'worse_than_expected_downside':'within_expected_downside'}
  }
  return{expected_time_hours:expectedTime,actual_time_hours:actualTime,time_variance_pct:timeVariancePct,expected_upside_low:upLo,expected_upside_high:upHi,expected_downside_low:downLo,expected_downside_high:downHi,actual_monetary_impact:actualMoney,money_assessment:moneyAssessment};
}

async function candidate(uid:string,id:string){return(await R(`opportunity_candidates?id=eq.${id}&user_id=eq.${uid}&select=*`))?.[0]||null}
async function decisionRows(uid:string,id:string){return(await R(`decisions?user_id=eq.${uid}&candidate_id=eq.${id}&select=*&order=decided_at.desc&limit=40`))||[]}
async function outcomeRows(uid:string,decisions:any[]){const ids=decisions.map(x=>x.id).filter(Boolean);if(!ids.length)return[];return(await R(`outcomes?user_id=eq.${uid}&decision_id=in.(${ids.join(',')})&select=*&order=observed_at.desc&limit=40`))||[]}
function stageFrom(c:any,decisions:any[],outcomes:any[]){const a=String(decisions?.[0]?.action||'');if(outcomes.length&&['completed','abandoned'].includes(String(c?.status)))return String(c.status);if(a.startsWith('stage_'))return a.replace('stage_','');if(a==='execute')return'in_progress';if(a==='completed')return'completed';if(a==='abandoned')return'abandoned';if(a==='defer')return'deferred';return String(c?.status||'new')}

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:C});
  const jwt=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');const u=await auth(jwt);if(!u?.id)return J({error:'Invalid user'},401);const uid=u.id;
  try{
    if(req.method==='GET'){
      const url=new URL(req.url),cid=String(url.searchParams.get('candidate_id')||'');
      if(cid){const c=await candidate(uid,cid);if(!c)return J({error:'Candidate not found or not owned by user'},404);const ds=await decisionRows(uid,cid),os=await outcomeRows(uid,ds);return J({ok:true,candidate:{id:c.id,title:c.title,module_code:c.module_code,status:c.status,next_action:c.next_action,currency:c.currency||'CAD',expected_upside_low:c.expected_upside_low,expected_upside_high:c.expected_upside_high,expected_downside_low:c.expected_downside_low,expected_downside_high:c.expected_downside_high,time_required_hours:c.time_required_hours},lifecycle:{stage:stageFrom(c,ds,os),latest_event:ds[0]||null,events:ds.slice(0,12)},outcomes:os.slice(0,8),latest_comparison:os[0]?predictedVsActual(c,os[0]):null});}
      const active=(await R(`opportunity_candidates?user_id=eq.${uid}&status=in.(approved,executing)&select=id,title,module_code,status,next_action,updated_at&order=updated_at.desc&limit=12`))||[];
      const recentOutcomes=(await R(`outcomes?user_id=eq.${uid}&select=*&order=observed_at.desc&limit=8`))||[];
      const recentDecisions=(await R(`decisions?user_id=eq.${uid}&select=*&order=decided_at.desc&limit=80`))||[];const dmap=new Map(recentDecisions.map((d:any)=>[d.id,d]));const cids=[...new Set(recentOutcomes.map((o:any)=>dmap.get(o.decision_id)?.candidate_id).filter(Boolean))];const cs=cids.length?(await R(`opportunity_candidates?user_id=eq.${uid}&id=in.(${cids.join(',')})&select=id,title,module_code,opportunity_type,time_required_hours,expected_upside_low,expected_upside_high,expected_downside_low,expected_downside_high,currency`))||[]:[];const cmap=new Map(cs.map((c:any)=>[c.id,c]));
      return J({ok:true,active,recent_learning:recentOutcomes.map((o:any)=>{const d:any=dmap.get(o.decision_id),c:any=cmap.get(d?.candidate_id);return{outcome:o,decision:d||null,candidate:c?{id:c.id,title:c.title,module_code:c.module_code}:null,comparison:c?predictedVsActual(c,o):null}}).slice(0,5)});
    }
    if(req.method!=='POST')return J({error:'GET or POST required'},405);
    const b=await req.json(),cid=String(b.candidate_id||''),op=String(b.operation||'');if(!cid||!op)return J({error:'candidate_id and operation required'},400);const c=await candidate(uid,cid);if(!c)return J({error:'Candidate not found or not owned by user'},404);const recentReasoning=await R(`reasoning_runs?user_id=eq.${uid}&select=*&order=generated_at.desc&limit=20`);const latestReasoning=(recentReasoning||[]).find((x:any)=>String(x?.recommendation?.candidate_id||'')===cid)||null;
    const now=new Date().toISOString();let event:any=null,outcome:any=null,learning:any[]=[];
    async function eventInsert(action:string,rationale:string|null,status:string|null){event=(await R('decisions',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify([{user_id:uid,candidate_id:cid,recommendation_id:null,reasoning_run_id:latestReasoning?.id||null,action,rationale}])}))?.[0];if(status)await R(`opportunity_candidates?id=eq.${cid}&user_id=eq.${uid}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({status,updated_at:now})});return event}
    if(op==='start')await eventInsert('execute',b.notes||'Execution tracking started.','executing');
    else if(op==='stage'){
      const stage=String(b.stage||''),allowed=['preparing','in_progress','waiting'];if(!allowed.includes(stage))return J({error:'stage must be preparing, in_progress or waiting'},400);await eventInsert(`stage_${stage}`,b.notes||null,'executing');
    }
    else if(op==='defer')await eventInsert('defer',b.notes||null,'watch');
    else if(op==='abandon')await eventInsert('abandoned',b.notes||null,'abandoned');
    else if(op==='complete')await eventInsert('completed',b.notes||null,'completed');
    else if(op!=='outcome')return J({error:'operation must be start, stage, defer, complete, abandon or outcome'},400);

    if(op==='outcome'||b.outcome){
      const o=b.outcome||b;const status=String(o.status||'unknown'),allowed=['positive','neutral','negative','unknown','pending'];if(!allowed.includes(status))return J({error:'invalid outcome status'},400);let decisionId=String(o.decision_id||event?.id||'');if(!decisionId){const ds=await decisionRows(uid,cid);decisionId=String(ds[0]?.id||'')}if(!decisionId)return J({error:'No decision exists for this candidate yet'},400);const owned=(await R(`decisions?id=eq.${decisionId}&user_id=eq.${uid}&candidate_id=eq.${cid}&select=id,reasoning_run_id`))?.[0];if(!owned)return J({error:'Decision not found or not owned by user'},404);
      outcome=(await R('outcomes',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify([{user_id:uid,decision_id:decisionId,status,observed_at:o.observed_at||now,monetary_impact:o.monetary_impact==null?null:Number(o.monetary_impact),time_impact_hours:o.time_impact_hours==null?null:Number(o.time_impact_hours),metric_delta:o.metric_delta||{},notes:o.notes||b.notes||null}])}))?.[0];
      const rrid=owned.reasoning_run_id||latestReasoning?.id||null;
      if(rrid&&outcome){const rr=(recentReasoning||[]).find((x:any)=>x.id===rrid)||(await R(`reasoning_runs?id=eq.${rrid}&user_id=eq.${uid}&select=*&limit=1`))?.[0]||null;if(rr){const pred=rr.recommendation||{},sp=pred.success_probability==null?null:Number(pred.success_probability),actual=status==='positive'?1:status==='negative'?0:null,brier=sp!=null&&actual!=null?Math.pow(sp/100-actual,2):null;let cls='calibration_observation';const lessons:any[]=[];if(actual===0&&sp!=null&&sp>=60){cls='prediction_miss';lessons.push('A materially positive success estimate was contradicted by the observed outcome.')}else if(actual===1&&sp!=null&&sp<=40){cls='positive_surprise';lessons.push('The outcome materially outperformed the prior success estimate.')}if(status==='negative'&&(rr.metadata?.what_would_change_mind||[]).length)lessons.push('Inspect which prior mind-change condition or hidden assumption was triggered.');await R('reasoning_outcome_reviews',{method:'POST',headers:{Prefer:'resolution=ignore-duplicates,return=minimal'},body:JSON.stringify([{user_id:uid,reasoning_run_id:rrid,decision_id:decisionId,outcome_id:outcome.id,predicted_decision:pred.decision||null,predicted_confidence:pred.confidence??null,predicted_success_probability:sp,predicted_expected_value:pred.expected_value??null,predicted_currency:pred.expected_value_currency||null,actual_status:status,actual_monetary_impact:o.monetary_impact==null?null:Number(o.monetary_impact),brier_error:brier,error_class:cls,lessons}])});}}
      if(status!=='pending'&&status!=='unknown'){
        let delta=status==='positive'?.12:status==='negative'?-.15:0;const money=Number(o.monetary_impact||0),actualTime=Number(o.time_impact_hours||0),expectedTime=Number(c.time_required_hours||0);if(status==='positive'&&money>0)delta+=Math.min(.08,Math.log10(money+1)/100);if(status==='negative'&&money<0)delta-=Math.min(.08,Math.log10(Math.abs(money)+1)/100);if(expectedTime>0&&actualTime>expectedTime*1.5)delta-=.025;if(status==='positive'&&expectedTime>0&&actualTime>0&&actualTime<=expectedTime)delta+=.015;
        const typeKey=String(c.opportunity_type||c.category||'unknown'),moduleKey=String(c.module_code||'unclassified');for(const [dim,key,d] of [['opportunity_type',typeKey,delta],['module',moduleKey,delta*.65]] as any[]){const x=await learn(uid,dim,key,d);if(x)learning.push(x)}for(const k of scopeKeys(c.scope_match).slice(0,4)){const x=await learn(uid,'scope_preference',String(k),Math.sign(delta)*Math.min(.04,Math.abs(delta)*.25));if(x)learning.push(x)}
      }
    }
    const ds=await decisionRows(uid,cid),os=await outcomeRows(uid,ds);return J({ok:true,event,outcome,lifecycle:{stage:stageFrom({...c,status:op==='complete'?'completed':op==='abandon'?'abandoned':op==='defer'?'watch':(op==='start'||op==='stage')?'executing':c.status},ds,os),events:ds.slice(0,12)},comparison:outcome?predictedVsActual(c,outcome):null,learning_updates:learning,note:'Observed outcomes update bounded personal learning weights and, when linked to a reasoning run, create a calibration review of the original prediction. Outcome learning affects future strategy but never authorizes consequential actions.'});
  }catch(e){return J({error:String(e)},500)}
});