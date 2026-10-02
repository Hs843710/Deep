import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {acquireEvidence} from "./evidence-core.js";
const U=Deno.env.get("SUPABASE_URL")!,A=Deno.env.get("SUPABASE_ANON_KEY")!;
const C={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,x-client-info,apikey,content-type","Access-Control-Allow-Methods":"GET,POST,OPTIONS"};
const J=(d:any,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{...C,"Content-Type":"application/json","Cache-Control":"no-store"}});
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
async function F(url:string,jwt:string,init:RequestInit={}){const r=await fetch(url,{...init,headers:{apikey:A,Authorization:"Bearer "+jwt,...init.headers},signal:init.signal||AbortSignal.timeout(18000)});const t=await r.text();if(!r.ok)throw Error(r.status+" "+t.slice(0,350));return t?JSON.parse(t):null}
const R=(path:string,jwt:string,init:RequestInit={})=>F(U+"/rest/v1/"+path,jwt,init);
async function me(jwt:string){try{return await F(U+"/auth/v1/user",jwt)}catch{return null}}
async function sha(text:string){const b=new TextEncoder().encode(text),d=await crypto.subtle.digest("SHA-256",b);return [...new Uint8Array(d)].map(x=>x.toString(16).padStart(2,"0")).join("")}
function stripHtml(x:string){return x.replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/&nbsp;|&amp;|&quot;|&#39;/g," ").replace(/\s+/g," ").trim().slice(0,18000)}
async function sourceFetch(urlText:string|null){
  const at=new Date().toISOString(); if(!urlText)return{ok:false,error:"no_source_url",fetched_at:at};
  let url:URL;try{url=new URL(urlText)}catch{return{ok:false,error:"invalid_source_url",fetched_at:at}}
  if(url.protocol!=="https:"||url.hostname!=="purchasing.alberta.ca")return{ok:false,error:"source_not_allowlisted",fetched_at:at};
  try{
    const res=await fetch(url.toString(),{method:"GET",headers:{Accept:"text/html,application/xhtml+xml;q=0.9,*/*;q=0.5","User-Agent":"PIOS-Evidence-Reader/1.0"},redirect:"follow",signal:AbortSignal.timeout(10000)});
    const type=res.headers.get("content-type")||"",len=Number(res.headers.get("content-length")||0);
    if(len>1500000)return{ok:false,status:res.status,error:"source_too_large",content_type:type,bytes:len,final_url:res.url,fetched_at:at};
    const bytes=new Uint8Array(await res.arrayBuffer()); if(bytes.length>1500000)return{ok:false,status:res.status,error:"source_too_large",content_type:type,bytes:bytes.length,final_url:res.url,fetched_at:at};
    const digest=await crypto.subtle.digest("SHA-256",bytes),hex=[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,"0")).join("");
    const text=/text|html|json|xml/i.test(type)?stripHtml(new TextDecoder().decode(bytes)):"";
    return{ok:res.ok,status:res.status,final_url:res.url,content_type:type,bytes:bytes.length,sha256:hex,fetched_at:at,text};
  }catch(e){return{ok:false,error:String(e).slice(0,220),fetched_at:at}}
}
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:C});
 if(!["GET","POST"].includes(req.method))return J({error:"GET or POST required"},405);
 const jwt=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,""),u=await me(jwt);if(!u?.id)return J({error:"Invalid session"},401);
 try{
  const body=req.method==="POST"?await req.json().catch(()=>({})):{}; let cid=typeof body?.candidate_id==="string"?body.candidate_id:"";
  if(cid&&!UUID.test(cid))return J({error:"Invalid candidate ID"},400);
  if(!cid){const snap=(await R("strategy_snapshots?user_id=eq."+u.id+"&select=next_best_move&order=generated_at.desc&limit=1",jwt))?.[0];cid=String(snap?.next_best_move?.candidate_id||"")}
  if(!cid||!UUID.test(cid))return J({ok:true,researched:false,reason:"No selected candidate is available for autonomous research."});
  const [cands,caps,nodes]=await Promise.all([
    R("opportunity_candidates?user_id=eq."+u.id+"&id=eq."+cid+"&select=*&limit=1",jwt),
    R("capabilities?user_id=eq."+u.id+"&active=eq.true&select=name,category,evidence&limit=100",jwt),
    R("personal_graph_nodes?user_id=eq."+u.id+"&valid_to=is.null&select=node_type,label,state,source_kind,source_ref,confidence&limit=600",jwt)
  ]);
  const candidate=cands?.[0];if(!candidate)return J({error:"Candidate not found"},404);
  const signal=candidate.primary_signal_id?(await R("signals?id=eq."+candidate.primary_signal_id+"&select=*&limit=1",jwt))?.[0]||null:null;
  let question=String(body?.question||"").trim();
  if(!question){try{const cr=await F(U+"/functions/v1/executive-council",jwt,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({candidate_id:cid})});question=String(cr?.council?.deliberation?.research_commission?.objective||cr?.council?.deliberation?.highest_value_missing_fact||candidate.next_action||"Verify the decision-sensitive qualification evidence.")}catch{question=String(candidate.next_action||"Verify the decision-sensitive qualification evidence.")}}
  const fingerprint=await sha([candidate.updated_at,signal?.updated_at||"",question].join("|"));
  const existing=(await R("research_artifacts?user_id=eq."+u.id+"&candidate_id=eq."+cid+"&research_type=eq.decision_evidence&fingerprint=eq."+fingerprint+"&select=*&limit=1",jwt))?.[0];
  if(existing)return J({ok:true,researched:true,already_researched:true,artifact:existing,external_action_performed:false});
  const fetched=await sourceFetch(signal?.source_url||null);
  const result=acquireEvidence({candidate,signal:signal||{},capabilities:caps||[],graphNodes:nodes||[],question,fetchSnapshot:fetched});
  const row={user_id:u.id,candidate_id:cid,signal_id:signal?.id||null,research_type:"decision_evidence",question,status:result.conclusion.status==="complete"?"complete":"partial",source_url:signal?.source_url||null,source_updated_at:signal?.updated_at||candidate.updated_at,source_fetch:fetched,evidence:result.evidence,unresolved:result.unresolved,conclusion:result.conclusion,fingerprint};
  const saved=(await R("research_artifacts",jwt,{method:"POST",headers:{"Content-Type":"application/json",Prefer:"return=representation"},body:JSON.stringify([row])}))?.[0]||null;
  return J({ok:true,researched:!!saved,artifact:saved,decision_recheck_recommended:!!saved&&result.conclusion.uncertainty_reduced,external_action_performed:false,note:"Read-only evidence acquisition only. No bid, message, authentication, form submission or commitment was performed."});
 }catch(e){return J({ok:false,error:"Evidence acquisition could not be completed.",detail:String(e).slice(0,420),external_action_performed:false},503)}
});
