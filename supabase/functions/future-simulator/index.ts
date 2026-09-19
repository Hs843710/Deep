
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const U=Deno.env.get("SUPABASE_URL")!, A=Deno.env.get("SUPABASE_ANON_KEY")!;
const C={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,x-client-info,apikey,content-type","Access-Control-Allow-Methods":"GET,POST,OPTIONS"};
const J=(d:any,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{...C,"Content-Type":"application/json","Cache-Control":"no-store"}});
const clamp=(v:any,lo=-100,hi=100)=>Math.max(lo,Math.min(hi,Number(v)||0));
const n=(v:any)=>v==null?null:Number(v);
const arr=(v:any)=>Array.isArray(v)?v:[];
async function F(url:string,init:RequestInit={}){const r=await fetch(url,init),t=await r.text();if(!r.ok)throw Error(String(r.status)+" "+t.slice(0,700));return t?JSON.parse(t):null}
async function auth(jwt:string){try{return await F(U+"/auth/v1/user",{headers:{apikey:A,Authorization:"Bearer "+jwt}})}catch{return null}}
async function R(path:string,jwt:string,init:RequestInit={}){const h=new Headers(init.headers||{});h.set("apikey",A);h.set("Authorization","Bearer "+jwt);if(init.body)h.set("Content-Type","application/json");return F(U+"/rest/v1/"+path,{...init,headers:h})}
function normMoney(v:any){const x=Math.abs(Number(v)||0);if(!x)return 0;return clamp(Math.log10(x+1)*16,0,85)}
function deployable(f:any){if(!f)return null;const cash=n(f.cash);if(cash==null)return null;return Math.max(0,cash-(n(f.taxes_reserved)||0)-(n(f.payroll_reserved)||0)-(n(f.emergency_reserve)||0)-(n(f.operating_reserve)||0))}
function cognitionFor(rows:any[],cid:string|null){return cid?rows.find(x=>x.candidate_id===cid)||null:null}
function scenarioScore(x:any,pathway:string){
  const d=x.state_delta||{},weights=pathway==="UNKNOWN_TO_LEARN"?
    {goal:.22,finance:.10,time:.08,risk:.12,uncertainty:.25,optionality:.13,learning:.10}:
    {goal:.28,finance:.17,time:.10,risk:.14,uncertainty:.11,optionality:.10,learning:.10};
  const positive=(n(d.goal)||0)*weights.goal+(n(d.finance)||0)*weights.finance+(n(d.time)||0)*weights.time+(n(d.optionality)||0)*weights.optionality+(n(d.learning)||0)*weights.learning;
  const safety=(-(n(d.risk)||0))*weights.risk+(-(n(d.uncertainty)||0))*weights.uncertainty;
  const regretPenalty=(Number(x.regret_exposure||0)/100)*14;
  const score=50+(positive+safety)*.5-regretPenalty;
  return Number(clamp(score,0,100).toFixed(1));
}
function impactFromCandidate(c:any,cog:any){
  const confidence=Number(cog?.confidence??c?.confidence_score??60);
  const success=Number(cog?.rationale?.success_probability??cog?.success_probability??confidence);
  const ev=n(cog?.expected_value);
  const info=Number(cog?.information_value??25);
  const rev=Number(cog?.reversibility??55);
  const urgency=Number(cog?.urgency??40);
  const opp=Number(cog?.opportunity_cost??30);
  const risk=Number(c?.risk_score??35);
  const capital=Number(c?.capital_burden_score??25);
  const hours=n(c?.time_required_hours);
  const money=ev!=null?normMoney(ev):normMoney(c?.expected_upside_high??c?.expected_upside_low);
  return{confidence,success,ev,info,rev,urgency,opp,risk,capital,hours,money};
}
function actScenario(c:any,cog:any,unknowns:any[]){
  const m=impactFromCandidate(c,cog),critical=unknowns.filter(x=>x?.critical).length;
  return{
    id:"ACT_NOW",label:"Act now",mode:"commit_path",
    state_delta:{
      goal:clamp(18+m.success*.42,0,70),
      finance:clamp(m.money*.55-m.capital*.28,-55,55),
      time:clamp(-(m.hours!=null?Math.min(65,m.hours*5):24),-70,10),
      risk:clamp(12+m.risk*.42+critical*7,0,80),
      uncertainty:clamp(-(10+Math.min(30,m.success*.18)), -45,0),
      optionality:clamp(-(10+(100-m.rev)*.28),-45,5),
      learning:clamp(15+m.info*.18,5,40)
    },
    assumptions:["The current opportunity remains eligible and available.","Capacity and capital are sufficient for the next commitment.","Unresolved assumptions do not invalidate economics or scope."],
    failure_modes:critical?["A critical unknown invalidates eligibility, margin, timing or capacity."]:["Execution underperforms the modeled economics or timing."],
    regret_exposure:clamp((100-m.rev)*.55+m.risk*.35+critical*8,0,100),
    evidence_confidence:clamp(m.confidence,0,100),
    irreversible:false,
    note:"Simulation only. Consequential external action still requires the existing approval and guardrail path."
  };
}
function learnScenario(c:any,cog:any,unknowns:any[]){
  const m=impactFromCandidate(c,cog),critical=unknowns.filter(x=>x?.critical).length;
  return{
    id:"LEARN_FIRST",label:"Learn first",mode:"information_path",
    state_delta:{
      goal:clamp(5+m.urgency*.08,0,18),
      finance:clamp(-Math.max(0,m.capital*.04),-12,3),
      time:clamp(-(8+(m.hours!=null?Math.min(16,m.hours*1.2):8)),-28,-4),
      risk:clamp(-(15+m.risk*.20),-40,-8),
      uncertainty:clamp(-(35+m.info*.35+critical*6),-85,-25),
      optionality:clamp(18+m.rev*.18,12,45),
      learning:clamp(42+m.info*.40,35,85)
    },
    assumptions:["The key unknown can be reduced with a bounded information action.","The opportunity does not expire before the new evidence is obtained."],
    failure_modes:[m.urgency>=70?"Delay can destroy value if the window is genuinely urgent.":"The information action may not resolve the decision-sensitive unknown."],
    regret_exposure:clamp(18+m.urgency*.32-m.info*.15,5,55),
    evidence_confidence:clamp(m.confidence,0,100),
    irreversible:false
  };
}
function holdScenario(c:any,cog:any){
  const m=impactFromCandidate(c,cog);
  return{
    id:"HOLD",label:"Hold",mode:"preserve_state",
    state_delta:{
      goal:clamp(-(5+m.urgency*.28),-45,-3),
      finance:clamp(4+m.capital*.05,0,16),
      time:clamp(18+(m.hours!=null?Math.min(18,m.hours*1.5):8),10,40),
      risk:clamp(-(7+m.risk*.08),-22,-4),
      uncertainty:clamp(4+m.urgency*.08,2,18),
      optionality:clamp(m.urgency<55?14:-8,-15,22),
      learning:0
    },
    assumptions:["Preserving attention/capital has value greater than immediate progress.","The opportunity can be revisited or replaced later."],
    failure_modes:["The opportunity window closes or the goal falls further behind schedule."],
    regret_exposure:clamp(20+m.urgency*.48,10,70),
    evidence_confidence:clamp(m.confidence,0,100),
    irreversible:false
  };
}
function alternativeScenario(c:any,cog:any,alt:any,altCog:any){
  if(!alt)return null;
  const a=impactFromCandidate(alt,altCog),current=impactFromCandidate(c,cog);
  return{
    id:"ALTERNATIVE",label:"Alternative",mode:"switch_path",candidate_id:alt.id,title:alt.title,
    state_delta:{
      goal:clamp(12+a.success*.34,0,58),
      finance:clamp(a.money*.45-a.capital*.24,-50,50),
      time:clamp(-(a.hours!=null?Math.min(55,a.hours*4):20),-60,-5),
      risk:clamp(8+a.risk*.34,0,65),
      uncertainty:clamp(-(10+a.info*.18),-40,-5),
      optionality:clamp(8+a.rev*.12-current.urgency*.05,-10,30),
      learning:clamp(14+a.info*.20,8,45)
    },
    assumptions:["The runner-up opportunity remains available and independently viable.","Switching attention does not destroy more value in the current path than it creates."],
    failure_modes:["The apparent alternative is less mature than the current path or carries hidden qualification/capacity costs."],
    regret_exposure:clamp(25+a.risk*.28+(100-a.rev)*.20,10,75),
    evidence_confidence:clamp(a.confidence,0,100),
    irreversible:false
  };
}
function summaryFor(s:any){
  const d=s.state_delta||{};
  const strongest=Object.entries(d).sort((a:any,b:any)=>Math.abs(Number(b[1]))-Math.abs(Number(a[1]))).slice(0,3);
  return strongest.map(([k,v]:any)=>({dimension:k,direction:Number(v)>4?"up":Number(v)<-4?"down":"flat",magnitude:Math.abs(Math.round(Number(v)))}));
}
Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:C});
  if(!["GET","POST"].includes(req.method))return J({error:"GET or POST required"},405);
  const jwt=(req.headers.get("Authorization")||"").replace(/^Bearer\\s+/i,"");
  const u=await auth(jwt);if(!u?.id)return J({error:"Invalid user"},401);
  try{
    const body=req.method==="POST"?await req.json().catch(()=>({})):{};
    const uid=u.id;
    const [reasonRows,snaps,cogs,goals,contracts,fin,profile]=await Promise.all([
      R("reasoning_runs?user_id=eq."+uid+"&select=*&order=generated_at.desc&limit=1",jwt),
      R("strategy_snapshots?user_id=eq."+uid+"&select=*&order=generated_at.desc&limit=1",jwt),
      R("cognitive_assessments?user_id=eq."+uid+"&select=*&order=created_at.desc&limit=12",jwt),
      R("goals?user_id=eq."+uid+"&status=eq.active&select=*&order=priority.asc,created_at.asc&limit=1",jwt),
      R("goal_contracts?user_id=eq."+uid+"&select=*&order=updated_at.desc&limit=1",jwt),
      R("financial_snapshots?user_id=eq."+uid+"&select=*&order=captured_at.desc&limit=1",jwt),
      R("profiles?user_id=eq."+uid+"&select=home_region,risk_posture,attention_budget_minutes&limit=1",jwt)
    ]);
    const reason=reasonRows?.[0]||null,snap=snaps?.[0]||null,goal=goals?.[0]||null,contract=contracts?.[0]||null,f=fin?.[0]||null,p=profile?.[0]||{};
    const rec=(reason?.recommendation&&reason.recommendation.candidate_id)?reason.recommendation:(snap?.next_best_move||{});
    const cid=rec?.candidate_id||null;
    if(!cid)return J({ok:true,engine_version:"future_simulator_v1",scenarios:[],preferred_scenario:null,note:"No current candidate is strong enough to simulate."});
    const c=(await R("opportunity_candidates?user_id=eq."+uid+"&id=eq."+cid+"&select=*&limit=1",jwt))?.[0]||null;
    if(!c)return J({error:"Current candidate not found"},404);
    const cog=cognitionFor(cogs||[],cid);
    const cogTime=cog?.created_at?new Date(cog.created_at).getTime():null;
    const altCog=(cogs||[]).find((x:any)=>{
      if(!x?.candidate_id||x.candidate_id===cid)return false;
      if(cog?.strategy_snapshot_id&&x.strategy_snapshot_id===cog.strategy_snapshot_id)return true;
      if(cogTime&&x.created_at){const dt=Math.abs(new Date(x.created_at).getTime()-cogTime);return Number.isFinite(dt)&&dt<=10*60*1000}
      return false;
    })||null;
    const alt=altCog?(await R("opportunity_candidates?user_id=eq."+uid+"&id=eq."+altCog.candidate_id+"&select=*&limit=1",jwt))?.[0]||null:null;
    const unknowns=arr(reason?.uncertainties||cog?.unknowns||[]);
    const pathway=String(rec?.strategy_path||((unknowns.some((x:any)=>x?.critical))?"UNKNOWN_TO_LEARN":(c.opportunity_type==="existing_pipeline"?"YOU_TO_WORLD":"WORLD_TO_YOU")));
    const scenarios=[actScenario(c,cog,unknowns),learnScenario(c,cog,unknowns),alternativeScenario(c,cog,alt,altCog),holdScenario(c,cog)].filter(Boolean);
    scenarios.forEach((s:any)=>{s.robust_utility=scenarioScore(s,pathway);s.twin_projection=summaryFor(s)});
    scenarios.sort((a:any,b:any)=>b.robust_utility-a.robust_utility);
    const preferred=scenarios[0]||null;
    const baseline={
      goal:{id:goal?.id||null,title:goal?.title||null,current:n(goal?.current_value),target:n(goal?.target_value),unit:goal?.target_unit||null,target_date:goal?.target_date||null},
      finance:{cash:n(f?.cash),deployable:deployable(f),debt:n(f?.debt),currency:f?.currency||"CAD"},
      attention_minutes_per_day:n(p?.attention_budget_minutes),
      risk_posture:p?.risk_posture||null,
      candidate:{id:c.id,title:c.title,module_code:c.module_code,opportunity_type:c.opportunity_type,confidence:n(c.confidence_score),risk:n(c.risk_score),time_hours:n(c.time_required_hours),capital_burden:n(c.capital_burden_score)}
    };
    const uncertainty={
      critical_unknowns:unknowns.filter((x:any)=>x?.critical).length,
      total_unknowns:unknowns.length,
      exact_prediction_available:false,
      note:"Scenario deltas are bounded comparative projections, not precise forecasts. Exact financial/time effects are only used when observed evidence supports them."
    };
    const payload={user_id:uid,reasoning_run_id:reason?.id||null,candidate_id:c.id,engine_version:"future_simulator_v1_counterfactual_twin",baseline,scenarios,preferred_scenario:preferred||{},uncertainty,metadata:{pathway,alternative_candidate_id:alt?.id||null,principle:"Simulation informs the decision engine; it does not authorize action."}};
    let simulationRunId=null;
    if(body?.persist===true){
      const saved=await R("future_simulation_runs",jwt,{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify([payload])});
      simulationRunId=saved?.[0]?.id||null;
    }
    return J({ok:true,generated_at:new Date().toISOString(),engine_version:payload.engine_version,pathway,baseline,scenarios,preferred_scenario:preferred,uncertainty,simulation_run_id:simulationRunId,principle:"PIOS simulates alternative futures only to improve the next decision. The Digital Twin remains the canonical state; simulations are temporary possible states."});
  }catch(e){return J({error:String(e)},500)}
});
