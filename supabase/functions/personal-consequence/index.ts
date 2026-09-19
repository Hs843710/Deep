
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {evaluateAcrossGoals} from "./value-core.js";

const U=Deno.env.get("SUPABASE_URL")!,A=Deno.env.get("SUPABASE_ANON_KEY")!;
const C={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,x-client-info,apikey,content-type","Access-Control-Allow-Methods":"GET,POST,OPTIONS"};
const J=(d:any,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{...C,"Content-Type":"application/json","Cache-Control":"no-store"}});
async function get(url:string,jwt:string){
 const r=await fetch(url,{headers:{apikey:A,Authorization:"Bearer "+jwt}});
 const t=await r.text();if(!r.ok)throw Error("Read failed "+r.status+": "+t.slice(0,300));
 return t?JSON.parse(t):null;
}
async function query(table:string,params:string,jwt:string){
 return get(U+"/rest/v1/"+table+"?"+params,jwt);
}
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:C});
 if(req.method!=="GET"&&req.method!=="POST")return J({error:"GET or POST required"},405);
 const jwt=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");
 if(!jwt)return J({error:"Connect to your account first."},401);
 try{
  const user=await get(U+"/auth/v1/user",jwt);
  if(!user?.id)return J({error:"Invalid user."},401);
  const uid=user.id,body=req.method==="POST"?await req.json().catch(()=>({})):{};
  const cid=typeof body?.candidate_id==="string"?body.candidate_id:"";
  if(cid&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cid))
   return J({error:"Invalid candidate identifier."},400);
  const [profiles,goals,financeRows,caps,snapRows]=await Promise.all([
   query("profiles","user_id=eq."+uid+"&select=user_id,home_region,risk_posture,attention_budget_minutes&limit=1",jwt),
   query("goals","user_id=eq."+uid+"&status=eq.active&select=id,title,domain,current_value,target_value,target_unit,target_date&order=priority.asc,created_at.asc&limit=20",jwt),
   query("financial_snapshots","user_id=eq."+uid+"&select=cash,taxes_reserved,payroll_reserved,emergency_reserve,operating_reserve,currency,captured_at&order=captured_at.desc&limit=1",jwt),
   query("capabilities","user_id=eq."+uid+"&active=eq.true&select=name,evidence&limit=60",jwt),
   cid?Promise.resolve([]):query("strategy_snapshots","user_id=eq."+uid+"&select=next_best_move,generated_at&order=generated_at.desc&limit=1",jwt)
  ]);
  const goal=goals?.[0]||null,profile=profiles?.[0]||{},finance=financeRows?.[0]||null;
  const chosen=cid||snapRows?.[0]?.next_best_move?.candidate_id||null;
  const [contracts,candidates]=await Promise.all([
   goal?query("goal_contracts","user_id=eq."+uid+"&select=goal_id,desired_state,guardrails,success_criteria&order=updated_at.desc&limit=60",jwt):Promise.resolve([]),
   chosen?query("opportunity_candidates","user_id=eq."+uid+"&id=eq."+chosen+"&select=id,title,module_code,opportunity_type,window_end,eligibility_status,scope_match,capital_required_low,capital_required_high,primary_signal_id,next_action&limit=1",jwt):Promise.resolve([])
  ]);
  const candidate=candidates?.[0]||null;
  const [operating,signalRows]=await Promise.all([
   candidate?query("operating_opportunities","user_id=eq."+uid+"&candidate_id=eq."+candidate.id+"&select=id,candidate_id,stage,quoted_value,contract_value,estimated_margin_pct&limit=3",jwt):Promise.resolve([]),
   candidate?.primary_signal_id?query("signals","id=eq."+candidate.primary_signal_id+"&select=id,title,locality,region,source_url,published_at,ingested_at,deadline_at&limit=1",jwt).catch(()=>[]):Promise.resolve([])
  ]);
  const value=evaluateAcrossGoals({profile,goals:goals||[],contracts:contracts||[],finance,
    capabilities:caps||[],candidate,signal:signalRows?.[0]||null,operating:operating||[],now:new Date().toISOString()});
  return J({ok:true,generated_at:new Date().toISOString(),candidate_id:candidate?.id||null,
    goal_id:value?.goal_id||goal?.id||null,personal_value:value,
    principle:"One event must produce distinct actions or silence based on the person's observed state and desired future. Unknown is not a negative fact; a quotation is not a won outcome."});
 }catch(e){return J({error:"Could not evaluate personal consequence.",detail:String(e).slice(0,300)},500)}
});
