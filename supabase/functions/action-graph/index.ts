
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const U=Deno.env.get("SUPABASE_URL")!,A=Deno.env.get("SUPABASE_ANON_KEY")!;
const C={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,x-client-info,apikey,content-type","Access-Control-Allow-Methods":"GET,POST,OPTIONS"};
const J=(d:any,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{...C,"Content-Type":"application/json","Cache-Control":"no-store"}});
async function F(url:string,init:RequestInit={}){const r=await fetch(url,init),t=await r.text();if(!r.ok)throw Error(String(r.status)+" "+t.slice(0,700));return t?JSON.parse(t):null}
async function auth(jwt:string){try{return await F(U+"/auth/v1/user",{headers:{apikey:A,Authorization:"Bearer "+jwt}})}catch{return null}}
async function R(path:string,jwt:string,init:RequestInit={}){const h=new Headers(init.headers||{});h.set("apikey",A);h.set("Authorization","Bearer "+jwt);if(init.body)h.set("Content-Type","application/json");return F(U+"/rest/v1/"+path,{...init,headers:h})}
const step=(order:number,id:string,label:string,description:string,action_class:string,auto_allowed:boolean,approval_required:boolean,depends_on:string[]=[],
status="ready")=>({order,id,label,description,action_class,auto_allowed,approval_required,depends_on,status});
function planFor(c:any,rec:any,sim:any,reason:any){
  const module=String(c?.module_code||rec?.module_code||"general"),type=String(c?.opportunity_type||"");
  const preferred=sim?.preferred_scenario?.id||rec?.simulation?.preferred_scenario||null;
  let pathway=String(rec?.strategy_path||"");
  if(preferred==="LEARN_FIRST"||preferred==="HOLD")pathway="UNKNOWN_TO_LEARN";
  if(!pathway)pathway=type==="existing_pipeline"?"YOU_TO_WORLD":"WORLD_TO_YOU";
  const unknown=(reason?.uncertainties||[])[0]?.question||"Resolve the highest-value decision-sensitive unknown.";
  let steps:any[]=[];
  if(preferred==="HOLD"){
    steps=[
      step(1,"preserve","Preserve state","Do not commit capital, capacity or external promises while the current regret profile remains unfavorable.","internal_control",true,false),
      step(2,"watch","Watch trigger","Monitor the specific evidence, deadline or state change that would materially alter the decision.","observe",true,false,["preserve"]),
      step(3,"rethink","Re-run reasoning","When the trigger changes, update the Twin and re-run cognition, simulation and decision.","reason",true,false,["watch"])
    ];
    return{pathway,steps,objective:"Preserve optionality until evidence changes the decision.",approval_state:"not_required"};
  }
  if(pathway==="UNKNOWN_TO_LEARN"){
    steps=[
      step(1,"unknown","Isolate critical unknown",unknown,"reason",true,false),
      step(2,"evidence","Acquire minimum evidence","Retrieve or verify only the evidence capable of changing the decision.","read_analyze",true,false,["unknown"]),
      step(3,"twin_update","Update Digital Twin","Replace the assumption with observed evidence and provenance.","internal_update",true,false,["evidence"]),
      step(4,"rethink","Re-run cognition + simulation","Recompute hypotheses, counterfactuals, future states and robustness.","reason",true,false,["twin_update"]),
      step(5,"gate","Create consequential path only if justified","Do not send, submit, spend, contract or otherwise commit until the revised reasoning clears guardrails.","approval_gate",false,true,["rethink"],"blocked")
    ];
    return{pathway,steps,objective:"Reduce decision uncertainty before commitment.",approval_state:"not_requested"};
  }
  if(type==="existing_pipeline"){
    steps=[
      step(1,"refresh","Refresh owned opportunity","Check the latest customer/quote state and any connected evidence without assuming acceptance.","read_analyze",true,false),
      step(2,"economics","Verify economics + capacity","Verify margin, working-capital requirement, scope, schedule and delivery capacity against guardrails.","reason",true,false,["refresh"]),
      step(3,"prepare","Prepare follow-up","Draft the smallest useful customer follow-up or clarification and prepare supporting material internally.","internal_prepare",true,false,["economics"]),
      step(4,"approve","Human approval","Review the prepared external message/commitment before it leaves PIOS.","approval_gate",false,true,["prepare"],"blocked"),
      step(5,"external","External follow-up / commitment","Send the approved message or take the approved external action. No autonomous commitment.","external_action",false,true,["approve"],"blocked"),
      step(6,"measure","Measure response","Observe customer response, stage movement, monetary/time outcome and update calibration.","observe",true,false,["external"])
    ];
    return{pathway:"YOU_TO_WORLD",steps,objective:"Convert or disqualify an owned opportunity with minimum wasted attention.",approval_state:"not_requested"};
  }
  if(["construction","procurement"].includes(module)){
    steps=[
      step(1,"retrieve","Retrieve source package","Collect the authoritative solicitation, addenda, drawings and specifications.","read_analyze",true,false),
      step(2,"eligibility","Verify mandatory eligibility","Check bonding, insurance, licences, qualifications, location, deadlines and mandatory forms against the Twin.","reason",true,false,["retrieve"]),
      step(3,"scope","Extract scope + dependencies","Build a structured scope, exclusions, deadlines, dependencies and missing-information list.","read_analyze",true,false,["eligibility"]),
      step(4,"economics","Model economics + capacity","Estimate cost/margin, estimator time, working capital, capacity fit and opportunity cost before pricing effort escalates.","reason",true,false,["scope"]),
      step(5,"prepare","Prepare bid workspace","Prepare checklist, estimate workspace and bid package internally if the option still clears the decision threshold.","internal_prepare",true,false,["economics"]),
      step(6,"approve","Human approval","Explicitly approve external submission, pricing commitment and any material capital/capacity commitment.","approval_gate",false,true,["prepare"],"blocked"),
      step(7,"submit","Submit / commit externally","Perform only the specifically approved external action.","external_action",false,true,["approve"],"blocked"),
      step(8,"measure","Measure outcome","Record result, actual estimating time, win/loss reason, contract economics and update the Twin.","observe",true,false,["submit"])
    ];
    return{pathway:"WORLD_TO_YOU",steps,objective:"Qualify and prepare the opportunity without wasting estimator time or bypassing guardrails.",approval_state:"not_requested"};
  }
  steps=[
    step(1,"observe","Refresh evidence","Retrieve current evidence and verify that the modeled state is still valid.","read_analyze",true,false),
    step(2,"verify","Verify consequence","Test the causal mechanism, economics, capacity, constraints and important unknowns.","reason",true,false,["observe"]),
    step(3,"prepare","Prepare reversible action","Create the internal material needed for the smallest useful next move.","internal_prepare",true,false,["verify"]),
    step(4,"approve","Human approval","Require approval before any external, financial, legal or irreversible action.","approval_gate",false,true,["prepare"],"blocked"),
    step(5,"external","Execute approved action","Carry out only the approved consequential step.","external_action",false,true,["approve"],"blocked"),
    step(6,"measure","Measure + learn","Observe the result, compare predicted vs actual, and update the Twin.","observe",true,false,["external"])
  ];
  return{pathway,steps,objective:"Turn the decision into bounded action while preserving human control.",approval_state:"not_requested"};
}
Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:C});
  if(!["GET","POST"].includes(req.method))return J({error:"GET or POST required"},405);
  const jwt=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,""),u=await auth(jwt);if(!u?.id)return J({error:"Invalid user"},401);
  try{
    const body=req.method==="POST"?await req.json().catch(()=>({})):{},uid=u.id;
    const [reasonRows,snapRows,simRows]=await Promise.all([
      R("reasoning_runs?user_id=eq."+uid+"&select=*&order=generated_at.desc&limit=1",jwt),
      R("strategy_snapshots?user_id=eq."+uid+"&select=*&order=generated_at.desc&limit=1",jwt),
      R("future_simulation_runs?user_id=eq."+uid+"&select=*&order=generated_at.desc&limit=1",jwt)
    ]);
    const reason=reasonRows?.[0]||null,snap=snapRows?.[0]||null,sim=simRows?.[0]||null;
    const rec=(reason?.recommendation&&reason.recommendation.candidate_id)?reason.recommendation:(snap?.next_best_move||{});
    const cid=String(body?.candidate_id||rec?.candidate_id||"");
    if(!cid)return J({ok:true,plan:null,note:"No material decision currently needs an action graph."});
    const c=(await R("opportunity_candidates?user_id=eq."+uid+"&id=eq."+cid+"&select=*&limit=1",jwt))?.[0];
    if(!c)return J({error:"Candidate not found"},404);
    const p=planFor(c,rec,sim,reason);
    const row={user_id:uid,candidate_id:c.id,reasoning_run_id:reason?.id||null,simulation_run_id:sim?.id||null,plan_version:"action_graph_v1_guarded_autonomy",status:"ready",objective:p.objective,pathway:p.pathway,steps:p.steps,current_step:1,approval_state:p.approval_state,metadata:{candidate_title:c.title,module_code:c.module_code,opportunity_type:c.opportunity_type,guardrail:"Autonomous work is limited to observation, analysis, internal preparation and measurement. Consequential external action requires explicit approval."}};
    let planId=null;
    if(body?.persist===true){
      const saved=await R("action_plans",jwt,{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify([row])});
      planId=saved?.[0]?.id||null;
    }
    return J({ok:true,generated_at:new Date().toISOString(),plan:{...row,id:planId},principle:"PIOS may autonomously observe, reason and prepare. It does not autonomously send, submit, spend, contract or make consequential commitments."});
  }catch(e){return J({error:String(e)},500)}
});
