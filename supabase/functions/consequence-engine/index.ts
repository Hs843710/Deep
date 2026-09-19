
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const U=Deno.env.get("SUPABASE_URL")!, A=Deno.env.get("SUPABASE_ANON_KEY")!;
const C={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization,x-client-info,apikey,content-type",
  "Access-Control-Allow-Methods":"GET,POST,OPTIONS"
};
const J=(d:any,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{...C,"Content-Type":"application/json","Cache-Control":"no-store"}});
const num=(v:any)=>v==null?null:Number(v);
const clamp=(v:any)=>Math.max(0,Math.min(100,Number(v)||0));
const arr=(v:any)=>Array.isArray(v)?v:[];

async function F(url:string,init:RequestInit={}){
  const r=await fetch(url,init),t=await r.text();
  if(!r.ok)throw Error(String(r.status)+" "+t.slice(0,600));
  return t?JSON.parse(t):null;
}
async function auth(jwt:string){
  try{return await F(U+"/auth/v1/user",{headers:{apikey:A,Authorization:"Bearer "+jwt}})}catch{return null}
}
async function R(path:string,jwt:string){
  return F(U+"/rest/v1/"+path,{headers:{apikey:A,Authorization:"Bearer "+jwt}});
}
function pathway(rec:any,c:any){
  const p=String(rec?.strategy_path||"");
  if(["WORLD_TO_YOU","YOU_TO_WORLD","UNKNOWN_TO_LEARN"].includes(p))return p;
  const d=String(rec?.decision||"").toUpperCase();
  if(d.includes("LEARN")||d.includes("DIAGNOSE")||c?.category==="growth_diagnostic")return "UNKNOWN_TO_LEARN";
  if(c?.opportunity_type==="existing_pipeline"||c?.category==="existing_pipeline")return "YOU_TO_WORLD";
  return "WORLD_TO_YOU";
}
function node(id:string,label:string,weight:number,reason:string,state="affected"){
  return{id,label,weight:clamp(weight),reason,state};
}
function impactNodes(c:any,rec:any,goal:any,contract:any,operating:any,uncertainties:any[]){
  const module=String(c?.module_code||rec?.module_code||"general");
  const desired=contract?.desired_state||{};
  const quoted=num(c?.scope_match?.quoted_value??c?.scope_match?.contract_value);
  const target=num(desired?.combined_contract_value_target);
  const margin=num(c?.scope_match?.estimated_margin_pct);
  const minMargin=num(desired?.minimum_gross_margin_pct);
  const capitalBurden=num(c?.capital_burden_score);
  const timeHours=num(c?.time_required_hours);
  const nodes:any[]=[
    node("goal","Goal",92,
      quoted&&target?"Potential value contribution is about "+Math.round(quoted/target*100)+"% of the current contract-value target.":
      "This option is being evaluated against the active goal.")
  ];
  if(["business_growth","construction","procurement"].includes(module)){
    nodes.push(node("business","Business",86,c?.opportunity_type==="existing_pipeline"?
      "This is already inside the owned commercial pipeline.":
      "This may change the business opportunity set if qualification and economics hold."));
    nodes.push(node("projects","Projects",90,c?.opportunity_type==="existing_pipeline"?
      "The recommendation concerns an existing quote/project path.":
      "This could enter the project pipeline after qualification."));
    nodes.push(node("capabilities","Capabilities",72,
      arr(c?.scope_match?.matches).length?"Matched capabilities: "+arr(c.scope_match.matches).slice(0,3).join(", ")+".":"Capability and eligibility fit remain part of executability."));
  }
  if(["cost_savings","investing","real_estate","business_growth","construction","procurement"].includes(module)){
    nodes.push(node("finance","Finance",capitalBurden!=null?Math.max(45,85-capitalBurden):62,
      capitalBurden!=null?"Capital burden score is "+capitalBurden+"/100; protected capital still governs commitment.":"Working-capital impact is not yet fully quantified."));
  }
  nodes.push(node("time","Time",timeHours!=null?Math.max(45,90-Math.min(50,timeHours*4)):58,
    timeHours!=null?"Estimated execution/attention requirement: "+timeHours+" hours.":"Time requirement is not yet quantified, so PIOS should prefer a bounded next step."));
  if(uncertainties.some((x:any)=>x?.critical)||uncertainties.length){
    nodes.push(node("bottleneck","Uncertainty",82,
      String(uncertainties.filter((x:any)=>x?.critical).length||uncertainties.length)+" decision-sensitive unknown(s) can still change the choice.","uncertain"));
  } else if(operating?.bottleneck?.type&&operating.bottleneck.type!=="none"){
    nodes.push(node("bottleneck","Bottleneck",68,operating.bottleneck.title||operating.bottleneck.type,"constraint"));
  }
  if(margin!=null&&minMargin!=null){
    const finance=nodes.find((x:any)=>x.id==="finance");
    if(finance)finance.reason="Estimated margin "+margin+"% vs minimum "+minMargin+"% guardrail. "+(margin>=minMargin?"Margin clears the recorded floor.":"Margin does not clear the recorded floor.");
  }
  return nodes.sort((a:any,b:any)=>b.weight-a.weight);
}
function causalPath(p:string,c:any,rec:any,unknowns:any[]){
  const action=rec?.action||c?.next_action||"Take the smallest reversible next step.";
  if(p==="YOU_TO_WORLD")return[
    {step:1,kind:"state",label:"Owned state",text:c?.opportunity_type==="existing_pipeline"?"Existing quote / relationship":"Current capability or resource"},
    {step:2,kind:"action",label:"Intervention",text:action},
    {step:3,kind:"gate",label:"Decision gate",text:"Verify economics, capacity and guardrails before commitment."},
    {step:4,kind:"outcome",label:"World response",text:"Observe customer/market response and record the result."},
    {step:5,kind:"learning",label:"Twin update",text:"Update goal progress, operating state and prediction calibration."}
  ];
  if(p==="UNKNOWN_TO_LEARN")return[
    {step:1,kind:"unknown",label:"Critical uncertainty",text:unknowns?.[0]?.question||"A decision-sensitive unknown is preventing a robust commitment."},
    {step:2,kind:"action",label:"Information action",text:action},
    {step:3,kind:"model",label:"Model update",text:"Replace assumption with observed evidence."},
    {step:4,kind:"decision",label:"Re-decide",text:"Re-rank options after the uncertainty changes."}
  ];
  return[
    {step:1,kind:"signal",label:"World change",text:c?.title||rec?.title||"External opportunity or risk"},
    {step:2,kind:"consequence",label:"Personal consequence",text:"Map the change to goal, business, finance, capacity and time."},
    {step:3,kind:"gate",label:"Verification",text:action},
    {step:4,kind:"decision",label:"Decision",text:"Act only if the verified consequence remains superior to alternatives."},
    {step:5,kind:"learning",label:"Twin update",text:"Record the real outcome and recalibrate future reasoning."}
  ];
}
function directionCopy(p:string){
  if(p==="YOU_TO_WORLD")return{label:"YOU → WORLD",verb:"intervene",summary:"PIOS is prioritizing an action from your existing state into the outside world."};
  if(p==="UNKNOWN_TO_LEARN")return{label:"UNKNOWN → LEARN",verb:"learn",summary:"PIOS believes information is more valuable than immediate commitment."};
  return{label:"WORLD → YOU",verb:"respond",summary:"PIOS is translating an external change into personal consequences before action."};
}
Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:C});
  if(!["GET","POST"].includes(req.method))return J({error:"GET or POST required"},405);
  const jwt=(req.headers.get("Authorization")||"").replace(/^Bearer\\s+/i,"");
  const u=await auth(jwt); if(!u?.id)return J({error:"Invalid user"},401);
  try{
    const uid=u.id;
    const [snapRows,reasonRows,goals,contracts,operatingRows]=await Promise.all([
      R("strategy_snapshots?user_id=eq."+uid+"&select=*&order=generated_at.desc&limit=1",jwt),
      R("reasoning_runs?user_id=eq."+uid+"&select=*&order=generated_at.desc&limit=1",jwt),
      R("goals?user_id=eq."+uid+"&status=eq.active&select=*&order=priority.asc,created_at.asc&limit=1",jwt),
      R("goal_contracts?user_id=eq."+uid+"&select=*&order=updated_at.desc&limit=1",jwt),
      R("operating_opportunities?user_id=eq."+uid+"&select=id,stage,quoted_value,contract_value,estimated_margin_pct,updated_at&order=updated_at.desc&limit=100",jwt)
    ]);
    const snap=snapRows?.[0]||null, reason=reasonRows?.[0]||null, goal=goals?.[0]||null, contract=contracts?.[0]||null;
    const rec=(reason?.recommendation&&reason.recommendation.candidate_id)?reason.recommendation:(snap?.next_best_move||{});
    const cid=rec?.candidate_id||null;
    const candidate=cid?(await R("opportunity_candidates?user_id=eq."+uid+"&id=eq."+cid+"&select=*&limit=1",jwt))?.[0]||null:null;
    const unknowns=arr(reason?.uncertainties||rec?.reasoning?.uncertainties||rec?.cognition?.unknowns);
    const p=pathway(rec,candidate);
    const op={
      records:operatingRows?.length||0,
      quoted:(operatingRows||[]).filter((x:any)=>["quoted","submitted"].includes(String(x.stage))).length,
      won:(operatingRows||[]).filter((x:any)=>["won","active","completed"].includes(String(x.stage))).length,
      bottleneck:{type:(operatingRows?.length||0)<5?"insufficient_data":"unknown",title:(operatingRows?.length||0)<5?"Bottleneck not verified":"Operating constraint requires current evidence"}
    };
    const impacts=impactNodes(candidate,rec,goal,contract,op,unknowns);
    const dir=directionCopy(p);
    const robustness=reason?.metadata?.robustness||rec?.reasoning?.robustness||null;
    const thesis=reason?.thesis||rec?.reasoning?.thesis||null;
    const primary=impacts[0]||null;
    const intelligence={
      pathway:p,
      direction:dir,
      thesis,
      robustness,
      confidence:clamp(rec?.confidence??candidate?.confidence_score??0),
      primary_impact:primary,
      affected_nodes:impacts,
      causal_path:causalPath(p,candidate,rec,unknowns),
      critical_unknowns:unknowns.slice(0,5),
      what_would_change_mind:arr(reason?.metadata?.what_would_change_mind||rec?.reasoning?.what_would_change_mind).slice(0,5),
      next_action:rec?.action||candidate?.next_action||null,
      candidate_id:cid,
      title:rec?.title||candidate?.title||null,
      module_code:rec?.module_code||candidate?.module_code||null
    };
    return J({
      ok:true,
      generated_at:new Date().toISOString(),
      intelligence,
      visual_directive:{
        center:"earth",
        flow:p,
        active_nodes:impacts.filter((x:any)=>x.weight>=65).map((x:any)=>x.id),
        uncertain_nodes:impacts.filter((x:any)=>x.state==="uncertain").map((x:any)=>x.id),
        intensity:robustness?.score!=null?clamp(robustness.score):clamp(intelligence.confidence)
      },
      principle:"Earth is the outside world. The Digital Twin is the user's modeled state. PIOS intelligence is the causal bridge between them."
    });
  }catch(e){return J({error:String(e)},500)}
});
