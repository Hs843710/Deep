
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const U=Deno.env.get("SUPABASE_URL"), A=Deno.env.get("SUPABASE_ANON_KEY");
const C={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,x-client-info,apikey,content-type","Access-Control-Allow-Methods":"GET,POST,OPTIONS"};
const J=(d,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{...C,"Content-Type":"application/json","Cache-Control":"no-store"}});
async function F(url,init={}){const r=await fetch(url,init),t=await r.text();if(!r.ok)throw Error(String(r.status)+" "+t.slice(0,700));return t?JSON.parse(t):null}
async function auth(jwt){try{return await F(U+"/auth/v1/user",{headers:{apikey:A,Authorization:"Bearer "+jwt}})}catch{return null}}
async function call(slug,jwt){return F(U+"/functions/v1/"+slug,{method:"POST",headers:{apikey:A,Authorization:"Bearer "+jwt,"Content-Type":"application/json"},body:"{}",signal:AbortSignal.timeout(90000)})}
async function rest(path,jwt,init={}){const h=new Headers(init.headers||{});h.set("apikey",A);h.set("Authorization","Bearer "+jwt);if(init.body)h.set("Content-Type","application/json");return F(U+"/rest/v1/"+path,{...init,headers:h})}
const n=v=>v==null?0:Number(v), arr=v=>Array.isArray(v)?v:[], clamp=v=>Math.max(0,Math.min(100,n(v)));
function hypothesis(id,statement,support,against,test,implication,confidence){return{id,statement,support:arr(support),against:arr(against),disconfirming_test:test,implication,confidence:clamp(confidence)}}
function robustness(sel,runner){
  if(!sel)return{score:0,label:"none",drivers:["No viable cognitive selection."]};
  const gap=runner?Math.max(0,n(sel.intellectual_priority)-n(runner.intellectual_priority)):20;
  const critical=arr(sel.unknowns).filter(x=>x&&x.critical).length;
  const contradictions=arr(sel.contradictions).filter(x=>x&&x.severity==="high").length;
  const raw=.35*n(sel.confidence)+.25*Math.min(100,gap*8)+.18*n(sel.reversibility)+.12*(100-critical*25)+.10*(100-contradictions*35);
  const score=clamp(raw);
  return{score:Number(score.toFixed(1)),label:score>=80?"robust":score>=65?"moderate":score>=50?"fragile":"weak",drivers:[
    "confidence "+Math.round(n(sel.confidence))+"/100",
    "priority gap "+gap.toFixed(1),
    "critical unknowns "+critical,
    "high contradictions "+contradictions,
    "reversibility "+Math.round(n(sel.reversibility))+"/100"
  ]};
}
function thesis(sel,runner){
  if(!sel)return{claim:"No action thesis is sufficiently supported.",candidate_id:null};
  return{
    claim:sel.title+" is currently the strongest decision path after uncertainty, reversibility, opportunity cost and counterfactual analysis.",
    candidate_id:sel.candidate_id,
    decision:sel.decision,
    intellectual_priority:sel.intellectual_priority,
    confidence:sel.confidence,
    competing_candidate_id:runner?.candidate_id||null
  };
}
function hypotheses(cog,twin){
  const s=cog.selected,r=cog.runner_up,out=[];
  if(s)out.push(hypothesis("H1",s.title+" is the best current path.",
    ["Highest non-dominated cognitive priority: "+n(s.intellectual_priority).toFixed(1),s.rationale?.summary||""].filter(Boolean),
    arr(s.contradictions).map(x=>x.statement).slice(0,4),
    arr(s.unknowns).find(x=>x.critical)?.question||"Observe whether the next bounded action improves the goal state.",
    "Proceed only through the smallest reversible step consistent with guardrails.",s.confidence));
  if(r)out.push(hypothesis("H2",r.title+" may outperform the current selection if its unresolved assumptions clear.",
    ["Runner-up cognitive priority: "+n(r.intellectual_priority).toFixed(1)],
    arr(r.contradictions).map(x=>x.statement).slice(0,3),
    arr(r.unknowns).find(x=>x.critical)?.question||"Compare realized progress per unit of attention against the selected path.",
    "Switch only if new evidence closes the priority gap.",Math.max(45,n(r.confidence)-8)));
  const b=twin?.digital_twin?.bottleneck||twin?.digital_twin?.current_state?.operating?.bottleneck;
  if(b&&b.type&&b.type!=="insufficient_data")out.push(hypothesis("H3","The modeled bottleneck materially constrains goal progress.",
    [b.title||b.type,b.detail||""].filter(Boolean),[],
    "Run one intervention targeted at the bottleneck and measure whether conversion, margin or throughput improves.",
    "Do not add generic activity if the bottleneck remains binding.",70));
  return out;
}
function uncertaintyMap(sel){
  return arr(sel?.unknowns).map((u,i)=>({rank:i+1,key:u.key||"unknown",question:u.question||String(u),critical:!!u.critical,decision_relevance:u.critical?"high":"medium"}));
}
function mindChange(sel,runner){
  const x=[];
  for(const u of arr(sel?.unknowns).filter(z=>z&&z.critical).slice(0,3))x.push({condition:"If "+u.question,consequence:"Re-evaluate or pause the current path before commitment."});
  for(const c of arr(sel?.contradictions).filter(z=>z&&z.severity==="high").slice(0,3))x.push({condition:"If contradiction persists: "+c.statement,consequence:"Do not escalate commitment."});
  if(r)x.push({condition:"If the runner-up gains enough verified evidence to exceed the selected path on cognitive priority.",consequence:"Switch priority rather than defend the previous recommendation."});
  return x;
}
Deno.serve(async req=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:C});
  if(!["GET","POST"].includes(req.method))return J({error:"GET or POST required"},405);
  const jwt=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,""),u=await auth(jwt);
  if(!u?.id)return J({error:"Invalid user"},401);
  try{
    const body=await req.json().catch(()=>({})); const supplied=body&&body.cognition&&body.cognition.ok?body.cognition:null; const [cog,twin]=await Promise.all([supplied?Promise.resolve(supplied):call("cognitive-engine",jwt),call("trajectory-context",jwt)]);
    const sel=cog?.selected||null,runner=cog?.runner_up||null,rob=robustness(sel,runner),hs=hypotheses(cog,twin),ums=uncertaintyMap(sel),mc=mindChange(sel,runner);
    let recommendation=null;
    if(sel){
      recommendation={
        candidate_id:sel.candidate_id,title:sel.title,module_code:sel.module_code,
        decision:sel.decision,action:sel.recommended_action||null,confidence:sel.confidence,
        intellectual_priority:sel.intellectual_priority,robustness:rob,
        success_probability:sel.success_probability??null,expected_value:sel.expected_value??null,
        expected_value_currency:sel.expected_value_currency||null,information_value:sel.information_value??null,
        reversibility:sel.reversibility??null,urgency:sel.urgency??null,opportunity_cost:sel.opportunity_cost??null,
        goal_contribution:sel.goal_contribution??null,
        reason:sel.rationale?.summary||"Selected by cognitive comparison rather than raw score."
      };
    }
    const run={user_id:u.id,goal_id:null,reasoning_version:"reasoning_core_v1_meta_cognition",thesis:thesis(sel,runner),hypotheses:hs,counterfactuals:arr(sel?.counterfactuals),uncertainties:ums,recommendation:recommendation||{},metadata:{robustness:rob,what_would_change_mind:mc,cognitive_engine:cog?.engine_version||null,principles:["separate facts from inference","seek disconfirming evidence","allow evidence to reverse prior decisions","compare counterfactual paths","prefer reversible information-rich moves under uncertainty"]}};
    const saved=(await rest("reasoning_runs",jwt,{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify([run])}))?.[0]||null;
    return J({ok:true,reasoning_version:run.reasoning_version,generated_at:new Date().toISOString(),thesis:run.thesis,hypotheses:hs,uncertainties:ums,counterfactuals:run.counterfactuals,robustness:rob,what_would_change_mind:mc,recommendation,reasoning_run_id:saved?.id||null,cognitive_engine:cog?.engine_version||null,principle:"PIOS must be able to explain what it believes, what could falsify it, what alternative it rejected, and what evidence would make it change its mind."});
  }catch(e){return J({error:String(e)},500)}
});