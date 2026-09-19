
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {prepareQuote} from "./workbench-core.js";
const U=Deno.env.get("SUPABASE_URL")!,A=Deno.env.get("SUPABASE_ANON_KEY")!;
const H={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,x-client-info,apikey,content-type","Access-Control-Allow-Methods":"GET,POST,OPTIONS"};
const J=(x:any,status=200)=>new Response(JSON.stringify(x),{status,headers:{...H,"Content-Type":"application/json","Cache-Control":"no-store"}});
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
async function req(url:string,jwt:string,init:RequestInit={}){
 const r=await fetch(url,{...init,headers:{apikey:A,Authorization:"Bearer "+jwt,...init.headers},signal:AbortSignal.timeout(18000)});
 const t=await r.text();if(!r.ok)throw Error("Source unavailable ("+r.status+"): "+t.slice(0,300));return t?JSON.parse(t):null;
}
const db=(path:string,jwt:string,init:RequestInit={})=>req(U+"/rest/v1/"+path,jwt,init);
Deno.serve(async request=>{
 if(request.method==="OPTIONS")return new Response("ok",{headers:H});
 if(!["GET","POST"].includes(request.method))return J({error:"GET or POST required"},405);
 const jwt=(request.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");
 if(!jwt)return J({error:"Connect to load your prepared work."},401);
 try{
  const who=await req(U+"/auth/v1/user",jwt);if(!who?.id)return J({error:"Invalid session."},401);
  const uid=who.id;
  const latest=async()=>{
    const rows=await db("prepared_work?user_id=eq."+uid+"&select=*&order=created_at.desc&limit=8",jwt);
    if(!rows?.length)return [];
    const ids=[...new Set(rows.map((r:any)=>r.operating_id).filter(Boolean))];
    const current=ids.length?await db("operating_opportunities?user_id=eq."+uid+"&id=in.("+ids.join(",")+")&select=id,updated_at,stage",jwt):[];
    const byId=new Map(current.map((x:any)=>[x.id,x]));
    return rows.map((r:any)=>({...r,is_current:byId.has(r.operating_id)&&
      new Date(byId.get(r.operating_id)?.updated_at).getTime()===new Date(r.source_updated_at).getTime()&&
      byId.get(r.operating_id)?.stage==="quoted"}));
  };
  if(request.method==="GET"){
    const works=await latest();
    return J({ok:true,as_of:new Date().toISOString(),works,
      completed_preparations:works.filter((w:any)=>w.status==="prepared"&&w.is_current).length,
      note:"These are completed internal preparation artifacts, not completed external actions or verified customer outcomes."});
  }
  const body=await request.json().catch(()=>({})),operation=body?.operation;
  if(operation!=="prepare_quote")return J({error:"Only internal quotation preparation is supported."},400);
  let candidate=typeof body.candidate_id==="string"?body.candidate_id:null;
  if(candidate&&!UUID.test(candidate))return J({error:"Invalid candidate ID."},400);
  let rows:any[];
  if(candidate)rows=await db("operating_opportunities?user_id=eq."+uid+"&candidate_id=eq."+candidate+"&stage=eq.quoted&select=*&order=updated_at.desc&limit=1",jwt);
  else rows=await db("operating_opportunities?user_id=eq."+uid+"&stage=eq.quoted&select=*&order=updated_at.desc&limit=1",jwt);
  const record=rows?.[0];
  if(!record)return J({ok:true,prepared:false,reason:"No owned quotation in quoted stage is available for safe preparation."});
  const all=await db("prepared_work?user_id=eq."+uid+"&operating_id=eq."+record.id+"&work_type=eq.quote_followup&select=*&order=created_at.desc&limit=3",jwt);
  const exact=(all||[]).find((x:any)=>new Date(x.source_updated_at).getTime()===new Date(record.updated_at).getTime());
  if(exact)return J({ok:true,prepared:true,already_prepared:true,work:exact,external_action_performed:false});
  const goals=await db("goals?user_id=eq."+uid+"&status=eq.active&domain=eq.business_growth&select=id&order=priority.asc&limit=1",jwt);
  const contracts=goals?.[0]?await db("goal_contracts?user_id=eq."+uid+"&goal_id=eq."+goals[0].id+"&select=desired_state&order=updated_at.desc&limit=1",jwt):[];
  const content=prepareQuote(record,contracts?.[0]||null,new Date().toISOString());
  const insertion={user_id:uid,operating_id:record.id,candidate_id:record.candidate_id||null,
    work_type:"quote_followup",status:"prepared",source_updated_at:record.updated_at,content};
  const saved=await db("prepared_work?on_conflict=user_id,operating_id,work_type,source_updated_at",jwt,{
    method:"POST",headers:{"Content-Type":"application/json",Prefer:"resolution=ignore-duplicates,return=representation"},
    body:JSON.stringify([insertion])
  });
  const work=saved?.[0]||(await latest()).find((r:any)=>r.operating_id===record.id&&r.source_updated_at===record.updated_at);
  return J({ok:true,prepared:!!work,work:work||null,external_action_performed:false,
    note:"A source-linked internal draft and review checklist were prepared. Nothing was sent or accepted."});
 }catch(error){return J({ok:false,error:"Preparation could not be verified.",detail:String(error).slice(0,320)},503)}
});
