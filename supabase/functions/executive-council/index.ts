
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {buildCouncil} from "./council-core.js";
const U=Deno.env.get("SUPABASE_URL")!,A=Deno.env.get("SUPABASE_ANON_KEY")!;
const C={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,x-client-info,apikey,content-type","Access-Control-Allow-Methods":"GET,POST,OPTIONS"};
const J=(d:any,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{...C,"Content-Type":"application/json","Cache-Control":"no-store"}});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function fetchJson(url:string,jwt:string,init:RequestInit={}){
 const r=await fetch(url,{...init,headers:{apikey:A,Authorization:"Bearer "+jwt,...init.headers},signal:AbortSignal.timeout(20000)});
 const t=await r.text();if(!r.ok)throw new Error("Source unavailable "+r.status+": "+t.slice(0,180));
 return t?JSON.parse(t):null;
}
const query=(table:string,params:string,jwt:string)=>fetchJson(U+"/rest/v1/"+table+"?"+params,jwt);
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:C});
 if(req.method!=="GET"&&req.method!=="POST")return J({error:"GET or POST required"},405);
 const jwt=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");
 if(!jwt)return J({error:"Connect to load your personal briefing."},401);
 try{
  const me=await fetchJson(U+"/auth/v1/user",jwt);if(!me?.id)return J({error:"Invalid session"},401);
  const uid=me.id,b=req.method==="POST"?await req.json().catch(()=>({})):{},id=typeof b?.candidate_id==="string"?b.candidate_id:"";
  if(id&&!uuid.test(id))return J({error:"Invalid candidate identifier"},400);
  const [profiles,goals,contracts,finance,operating,commits,capabilities,resources,sources,snaps]=await Promise.all([
   query("profiles","user_id=eq."+uid+"&select=home_region,attention_budget_minutes,risk_posture,preferred_currency&limit=1",jwt),
   query("goals","user_id=eq."+uid+"&status=eq.active&select=id,title,domain,current_value,target_value,target_unit,target_date,status,priority,updated_at,currency&order=priority.asc,created_at.asc&limit=20",jwt),
   query("goal_contracts","user_id=eq."+uid+"&select=id,goal_id,desired_state,guardrails&order=updated_at.desc&limit=40",jwt),
   query("financial_snapshots","user_id=eq."+uid+"&select=cash,taxes_reserved,payroll_reserved,emergency_reserve,operating_reserve,currency,captured_at&order=captured_at.desc&limit=1",jwt),
   query("operating_opportunities","user_id=eq."+uid+"&select=id,candidate_id,stage,quoted_value,contract_value,estimated_margin_pct,updated_at&order=updated_at.desc&limit=100",jwt),
   query("life_commitments","user_id=eq."+uid+"&select=id,starts_at,due_at,status&order=starts_at.asc&limit=50",jwt),
   query("capabilities","user_id=eq."+uid+"&active=eq.true&select=id,name,category&limit=60",jwt),
   query("resources_assets","user_id=eq."+uid+"&active=eq.true&select=id,name,category&limit=60",jwt),
   query("connected_source_sync_state","user_id=eq."+uid+"&select=source_kind,status,last_observed_at,last_sync_at&limit=20",jwt),
   id?Promise.resolve([]):query("strategy_snapshots","user_id=eq."+uid+"&select=next_best_move,generated_at&order=generated_at.desc&limit=1",jwt)
  ]);
  const selectedId=id||snaps?.[0]?.next_best_move?.candidate_id||null;
  const candidate=selectedId?(await query("opportunity_candidates","user_id=eq."+uid+"&id=eq."+selectedId+"&select=id,title,module_code,opportunity_type,status,eligibility_status,window_end,scope_match,capital_required_low,capital_required_high,time_required_hours&limit=1",jwt))?.[0]||null:null;
  // The personal consequence endpoint authenticates and reads facts for this same user.
  // It may return no actionable fit; the Council must remain quiet in that case.
  let personalValue=null;
  if(candidate){
   const r=await fetchJson(U+"/functions/v1/personal-consequence",jwt,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({candidate_id:candidate.id})});
   if(r?.ok)personalValue=r.personal_value||null;
  }
  const now=new Date().toISOString();
  const council=buildCouncil({profile:profiles?.[0]||{},goals:goals||[],contracts:contracts||[],finance:finance?.[0]||null,
   operating:operating||[],commitments:commits||[],capabilities:capabilities||[],resources:resources||[],
   sources:sources||[],candidate,personalValue,now});
  return J({ok:true,generated_at:now,council,
   limitations:{specialists:"Evidence-based specialist analyses, not independent licensed professionals or autonomous agents.",
     execution:"No emails, financial transactions, external submissions or other consequential actions are performed.",
     freshness:"The Council evaluates stored evidence. A connected source may have observations that are incomplete or stale."}});
 }catch(err){
  return J({ok:false,error:"The executive briefing could not be assembled from the currently connected sources.",detail:String(err).slice(0,180)},503);
 }
});
