
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {prepareQuote,prepareCandidateQualification,prepareEstimateWorkspace} from "./workbench-core.js";
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
    const candidateIds=[...new Set(rows.map((r:any)=>r.candidate_id).filter(Boolean))];
    const [current,currentCandidates]=await Promise.all([
      ids.length?db("operating_opportunities?user_id=eq."+uid+"&id=in.("+ids.join(",")+")&select=id,updated_at,stage",jwt):Promise.resolve([]),
      candidateIds.length?db("opportunity_candidates?user_id=eq."+uid+"&id=in.("+candidateIds.join(",")+")&select=id,updated_at,status",jwt):Promise.resolve([])
    ]);
    const byId=new Map(current.map((x:any)=>[x.id,x])),byCandidate=new Map(currentCandidates.map((x:any)=>[x.id,x]));
    return rows.map((r:any)=>{
      const op=r.operating_id?byId.get(r.operating_id):null,c=r.candidate_id?byCandidate.get(r.candidate_id):null;
      const source=op||c;
      return {...r,is_current:!!source&&new Date(source.updated_at).getTime()===new Date(r.source_updated_at).getTime()&&
        (op?op.stage==="quoted":!["stale","expired","dismissed","rejected"].includes(String(c?.status||"")))};
    });
  };
  if(request.method==="GET"){
    const works=await latest();
    return J({ok:true,as_of:new Date().toISOString(),works,
      completed_preparations:works.filter((w:any)=>w.status==="prepared"&&w.is_current).length,
      note:"These are completed internal preparation artifacts, not completed external actions or verified customer outcomes."});
  }
  const body=await request.json().catch(()=>({})),operation=body?.operation;
  if(!["prepare_quote","prepare_candidate_qualification","prepare_estimate_workspace"].includes(operation))
    return J({error:"Unsupported internal preparation operation."},400);
  let candidate=typeof body.candidate_id==="string"?body.candidate_id:null;
  if(candidate&&!UUID.test(candidate))return J({error:"Invalid candidate ID."},400);

  if(operation==="prepare_estimate_workspace"){
    let candidates:any[];
    if(candidate)candidates=await db("opportunity_candidates?user_id=eq."+uid+"&id=eq."+candidate+"&select=*&limit=1",jwt);
    else candidates=await db("opportunity_candidates?user_id=eq."+uid+"&status=in.(new,investigate,watch,approved,executing)&module_code=in.(construction,procurement)&select=*&order=updated_at.desc&limit=1",jwt);
    const c=candidates?.[0];
    if(!c)return J({ok:true,prepared:false,reason:"No current construction/procurement candidate is available for estimate preparation."});
    if(!["construction","procurement"].includes(String(c.module_code||""))||c.opportunity_type==="existing_pipeline")
      return J({ok:true,prepared:false,reason:"The selected candidate is not an external construction/procurement opportunity."});
    const existing=await db("prepared_work?user_id=eq."+uid+"&candidate_id=eq."+c.id+"&operating_id=is.null&work_type=eq.estimate_workspace&select=*&order=created_at.desc&limit=5",jwt);
    const exact=(existing||[]).find((x:any)=>new Date(x.source_updated_at).getTime()===new Date(c.updated_at).getTime());
    if(exact)return J({ok:true,prepared:true,already_prepared:true,work:exact,external_action_performed:false});
    const [signals,caps,goals,qualificationRows,researchRows]=await Promise.all([
      c.primary_signal_id?db("signals?id=eq."+c.primary_signal_id+"&select=*&limit=1",jwt):Promise.resolve([]),
      db("capabilities?user_id=eq."+uid+"&active=eq.true&select=name,category,proficiency,evidence&limit=80",jwt),
      db("goals?user_id=eq."+uid+"&status=eq.active&domain=eq.business_growth&select=id&order=priority.asc&limit=1",jwt),
      db("prepared_work?user_id=eq."+uid+"&candidate_id=eq."+c.id+"&work_type=eq.candidate_qualification&status=eq.prepared&select=content,created_at&order=created_at.desc&limit=1",jwt),
      db("research_artifacts?user_id=eq."+uid+"&candidate_id=eq."+c.id+"&select=*&order=created_at.desc&limit=1",jwt)
    ]);
    const contracts=goals?.[0]?await db("goal_contracts?user_id=eq."+uid+"&goal_id=eq."+goals[0].id+"&select=desired_state,guardrails&order=updated_at.desc&limit=1",jwt):[];
    const content=prepareEstimateWorkspace(c,signals?.[0]||null,caps||[],contracts?.[0]||null,qualificationRows?.[0]?.content||null,researchRows?.[0]||null,new Date().toISOString());
    const insertion={user_id:uid,operating_id:null,candidate_id:c.id,work_type:"estimate_workspace",status:"prepared",source_updated_at:c.updated_at,content};
    let saved:any[]=[],insertError:any=null;
    try{saved=await db("prepared_work",jwt,{method:"POST",headers:{"Content-Type":"application/json",Prefer:"return=representation"},body:JSON.stringify([insertion])})}catch(e){insertError=e}
    const work=saved?.[0]||(await db("prepared_work?user_id=eq."+uid+"&candidate_id=eq."+c.id+"&operating_id=is.null&work_type=eq.estimate_workspace&select=*&order=created_at.desc&limit=1",jwt))?.[0]||null;
    if(!work&&insertError)throw insertError;
    return J({ok:true,prepared:!!work,work,external_action_performed:false,
      note:"An evidence-bounded estimate workspace was prepared. No quantities, unit prices, bid, message or commitment were invented or executed."});
  }

  if(operation==="prepare_candidate_qualification"){
    let candidates:any[];
    if(candidate)candidates=await db("opportunity_candidates?user_id=eq."+uid+"&id=eq."+candidate+"&select=*&limit=1",jwt);
    else candidates=await db("opportunity_candidates?user_id=eq."+uid+"&status=in.(new,investigate,watch,approved,executing)&module_code=in.(construction,procurement)&select=*&order=updated_at.desc&limit=1",jwt);
    const c=candidates?.[0];
    if(!c)return J({ok:true,prepared:false,reason:"No current construction/procurement candidate is available for internal qualification."});
    if(!["construction","procurement"].includes(String(c.module_code||""))||c.opportunity_type==="existing_pipeline")
      return J({ok:true,prepared:false,reason:"The selected candidate is not an external construction/procurement opportunity."});
    const existing=await db("prepared_work?user_id=eq."+uid+"&candidate_id=eq."+c.id+"&operating_id=is.null&work_type=eq.candidate_qualification&select=*&order=created_at.desc&limit=5",jwt);
    const exact=(existing||[]).find((x:any)=>new Date(x.source_updated_at).getTime()===new Date(c.updated_at).getTime());
    if(exact)return J({ok:true,prepared:true,already_prepared:true,work:exact,external_action_performed:false});

    const [signals,caps,fin,goals]=await Promise.all([
      c.primary_signal_id?db("signals?id=eq."+c.primary_signal_id+"&select=*&limit=1",jwt):Promise.resolve([]),
      db("capabilities?user_id=eq."+uid+"&active=eq.true&select=name,category,proficiency,evidence&limit=80",jwt),
      db("financial_snapshots?user_id=eq."+uid+"&select=*&order=captured_at.desc&limit=1",jwt),
      db("goals?user_id=eq."+uid+"&status=eq.active&domain=eq.business_growth&select=id&order=priority.asc&limit=1",jwt)
    ]);
    const contracts=goals?.[0]?await db("goal_contracts?user_id=eq."+uid+"&goal_id=eq."+goals[0].id+"&select=desired_state,guardrails&order=updated_at.desc&limit=1",jwt):[];
    const content=prepareCandidateQualification(c,signals?.[0]||null,caps||[],fin?.[0]||null,contracts?.[0]||null,new Date().toISOString());
    const insertion={user_id:uid,operating_id:null,candidate_id:c.id,work_type:"candidate_qualification",status:"prepared",source_updated_at:c.updated_at,content};
    let saved:any[]=[],insertError:any=null;
    try{
      saved=await db("prepared_work",jwt,{method:"POST",headers:{"Content-Type":"application/json",Prefer:"return=representation"},body:JSON.stringify([insertion])});
    }catch(e){insertError=e}
    const work=saved?.[0]||(await db("prepared_work?user_id=eq."+uid+"&candidate_id=eq."+c.id+"&operating_id=is.null&work_type=eq.candidate_qualification&select=*&order=created_at.desc&limit=1",jwt))?.[0]||null;
    if(!work&&insertError)throw insertError;
    return J({ok:true,prepared:!!work,work,external_action_performed:false,
      note:"A source-linked qualification/economics pack was prepared. No bid, price, customer contact or commitment was made."});
  }

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
