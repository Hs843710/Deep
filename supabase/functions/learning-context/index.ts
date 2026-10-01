
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const U=Deno.env.get("SUPABASE_URL")!,A=Deno.env.get("SUPABASE_ANON_KEY")!;
const C={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,x-client-info,apikey,content-type","Access-Control-Allow-Methods":"GET,POST,OPTIONS"};
const J=(d:any,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{...C,"Content-Type":"application/json","Cache-Control":"no-store"}});
async function F(url:string,init:RequestInit={}){const r=await fetch(url,init),t=await r.text();if(!r.ok)throw Error(String(r.status)+" "+t.slice(0,400));return t?JSON.parse(t):null}
async function auth(jwt:string){try{return await F(U+"/auth/v1/user",{headers:{apikey:A,Authorization:"Bearer "+jwt}})}catch{return null}}
async function R(path:string,jwt:string){return F(U+"/rest/v1/"+path,{headers:{apikey:A,Authorization:"Bearer "+jwt}})}
const n=(x:any)=>x===null||x===undefined||x===""||!Number.isFinite(Number(x))?null:Number(x);
function classify(obs:any,decision:any,reason:any,floor:number|null){
 const facts=obs?.facts||{},stage=String(facts.stage||""),margin=n(facts.actual_margin_pct),profit=n(facts.actual_gross_profit);
 const executed=["execute","completed"].includes(String(decision?.action||""))||String(decision?.action||"").startsWith("stage_");
 const reasoningLinked=!!reason&&String(reason.id)===String(decision?.reasoning_run_id||"");
 const actualFinancial=margin!==null||profit!==null;
 let goalQualification:null|boolean=null;
 if(margin!==null&&floor!==null)goalQualification=margin>=floor;
 const factualSummary={
   stage:stage||null,contract_value:n(facts.contract_value),actual_direct_cost:n(facts.actual_direct_cost),
   actual_gross_profit:profit,actual_margin_pct:margin,estimator_hours:n(facts.estimator_hours),
   loss_reason:facts.loss_reason||null
 };
 if(!decision)return{state:"observed_unlinked",calibration_ready:false,reason:"Observed operating state is not linked to a recorded decision.",goal_qualification:goalQualification,facts:factualSummary};
 if(!reasoningLinked)return{state:"decision_without_prediction_trace",calibration_ready:false,reason:"A decision exists, but its original reasoning trace is unavailable.",goal_qualification:goalQualification,facts:factualSummary};
 if(!executed)return{state:"pre_execution_observation",calibration_ready:false,reason:"The linked decision did not record execution; project state should not be used to score the recommendation.",goal_qualification:goalQualification,facts:factualSummary};
 if(stage==="won"&&!actualFinancial)return{state:"won_profit_unverified",calibration_ready:false,reason:"Win status is observed, but actual profitability is not yet known.",goal_qualification:null,facts:factualSummary};
 if(stage==="completed"&&actualFinancial)return{state:"calibration_ready",calibration_ready:true,reason:"Execution and actual financial evidence are recorded.",goal_qualification:goalQualification,facts:factualSummary};
 if(stage==="lost")return{state:"calibration_candidate",calibration_ready:true,reason:"Loss state is observed after a linked execution decision; interpretation should consider loss reason and avoided downside.",goal_qualification:false,facts:factualSummary};
 return{state:"outcome_incomplete",calibration_ready:false,reason:"More actual result evidence is required before changing model confidence.",goal_qualification:goalQualification,facts:factualSummary};
}
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:C});
 if(!["GET","POST"].includes(req.method))return J({error:"GET or POST required"},405);
 const jwt=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,""),u=await auth(jwt);if(!u?.id)return J({error:"Invalid user"},401);
 try{
  const uid=u.id;
  const [observations,decisions,reasons,reviews,goals]=await Promise.all([
    R("observed_outcome_events?user_id=eq."+uid+"&select=*&order=observed_at.desc&limit=50",jwt),
    R("decisions?user_id=eq."+uid+"&select=*&order=decided_at.desc&limit=80",jwt),
    R("reasoning_runs?user_id=eq."+uid+"&select=*&order=generated_at.desc&limit=80",jwt),
    R("reasoning_outcome_reviews?user_id=eq."+uid+"&select=*&order=created_at.desc&limit=30",jwt),
    R("goal_contracts?user_id=eq."+uid+"&select=desired_state&order=updated_at.desc&limit=1",jwt)
  ]);
  const dmap=new Map((decisions||[]).map((x:any)=>[x.id,x])),rmap=new Map((reasons||[]).map((x:any)=>[x.id,x]));
  const floor=n(goals?.[0]?.desired_state?.minimum_gross_margin_pct);
  const evaluated=(observations||[]).map((o:any)=>{
    const d=o.decision_id?dmap.get(o.decision_id)||null:null,r=d?.reasoning_run_id?rmap.get(d.reasoning_run_id)||null:null;
    return{observation_id:o.id,observed_at:o.observed_at,operating_id:o.operating_id,candidate_id:o.candidate_id,
      decision_id:o.decision_id||null,reasoning_run_id:r?.id||null,source_kind:o.source_kind||null,...classify(o,d,r,floor)};
  });
  const ready=evaluated.filter((x:any)=>x.calibration_ready);
  return J({ok:true,generated_at:new Date().toISOString(),
    summary:{reasoning_runs:(reasons||[]).length,observations:evaluated.length,linked_observations:evaluated.filter((x:any)=>x.decision_id).length,
      calibration_ready:ready.length,completed_reviews:(reviews||[]).length,minimum_margin_pct:floor},
    state:ready.length?"calibration_evidence_available":evaluated.length?"observations_waiting_for_outcome":"no_outcome_evidence",
    observations:evaluated.slice(0,20),recent_reviews:(reviews||[]).slice(0,8),
    principle:"PIOS changes confidence only when an observed result can be traced back to the decision and prediction that preceded it. Pipeline movement alone is not proof that the recommendation was correct or incorrect."});
 }catch(e){return J({error:String(e).slice(0,500)},500)}
});
