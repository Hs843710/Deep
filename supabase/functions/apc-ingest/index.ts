import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const U=Deno.env.get("SUPABASE_URL")!;
const K=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APC="https://purchasing.alberta.ca/api";
const APP="https://purchasing.alberta.ca";
const SOURCE_CODE="alberta_purchasing_connection";
const PAGE_SIZE=100;
const DEFAULT_MAX=300;

const J=(d:unknown,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});
const val=(v:unknown)=>String(v??"").trim();
async function db(path:string,opt:RequestInit={}){const h=new Headers(opt.headers||{});h.set("apikey",K);h.set("Authorization",`Bearer ${K}`);if(opt.body&&!h.has("Content-Type"))h.set("Content-Type","application/json");const r=await fetch(`${U}/rest/v1/${path}`,{...opt,headers:h});const t=await r.text();if(!r.ok)throw new Error(`DB ${r.status}: ${t.slice(0,800)}`);return t?JSON.parse(t):null}
function sel(v:string){return {value:v,selected:true,count:0}}
function payload(limit:number,page:number){return {query:"",queryMode:"standard",includeEnhancedMatchIds:true,filter:{solicitationNumber:"",categories:[sel("CNST")],statuses:[sel("OPEN")],agreementTypes:[],solicitationTypes:[],opportunityTypes:[],deliveryRegions:[],deliveryRegion:"",organizations:[],unspsc:[],postDateRange:"$$custom",closeDateRange:"$$custom",onlyBookmarked:false,onlyInterestExpressed:false},limit,offset:page,sortOptions:[{field:"PostDateTime",direction:"desc"}]}}
async function search(limit=PAGE_SIZE,page=0){const r=await fetch(`${APC}/opportunity/search`,{method:"POST",headers:{"Accept":"application/json, text/plain, */*","Content-Type":"application/json","Referer":`${APP}/search`,"User-Agent":"Personal-Intelligence-OS/1.0"},body:JSON.stringify(payload(limit,page)),signal:AbortSignal.timeout(20000)});const t=await r.text();if(!r.ok)throw new Error(`APC search ${r.status}: ${t.slice(0,500)}`);return JSON.parse(t)}
function rows(data:any){return Array.isArray(data?.values)?data.values:Array.isArray(data)?data:[]}
function publicUrl(ref:string){const m=ref.match(/AB-(\d{4})-(\d+)/i);return m?`${APP}/opportunity/${m[1]}/${Number(m[2])}`:`${APP}/search`}
function iso(v:any){if(!v)return null;const d=new Date(v);return Number.isNaN(d.getTime())?null:d.toISOString()}
function textList(v:any){return Array.isArray(v)?v.map(val).filter(Boolean).join("; "):val(v)}
function compactSummary(o:any){const parts=[o.projectDescription,o.additionalRequirements,o.bidSecurity,textList(o.commodityCodeTitles),textList(o.aiVersionKeywords)].map(val).filter(Boolean);return parts.join("\n\n").slice(0,16000)||null}
async function source(){const x=await db(`world_sources?code=eq.${SOURCE_CODE}&select=id,last_success_at`);return x?.[0]}
function normalize(sourceId:string,o:any){const ref=val(o.referenceNumber||o.solicitationNumber||o.id);if(!ref)return null;const title=val(o.title||o.shortTitle||o.opportunityTitle||"Untitled Alberta opportunity");const org=val(o.contractingOrganization||o.contractingOrgName||o.organizationName||"")||null;const regionRaw=o.regionOfDelivery||o.deliveryRegion||o.region||"Alberta";const region=Array.isArray(regionRaw)?regionRaw.join(", "):val(regionRaw)||"Alberta";const closing=o.closeDateTime||o.closingDateTime||o.closeDate||null;const posted=o.postDateTime||o.postingDateTime||o.postDate||null;const solType=val(o.solicitationTypeCode).toUpperCase();const oppType=val(o.opportunityTypeCode).toUpperCase();const isAward=solType==="NOA"||/notice of award/i.test(title);const isNotice=!isAward&&(oppType==="NOTICE"||Boolean(o.isNotice)||["NPP","NOI","APC-NA"].includes(solType));const signalType=isAward?"procurement_award_notice":isNotice?"procurement_pipeline_notice":"procurement_tender";const facts=["Present in the authoritative Alberta Purchasing Connection public opportunity API.","APC category: Construction (CNST).",oppType?`Opportunity type: ${oppType}.`:null,solType?`Solicitation type: ${solType}.`:null,val(o.bidSecurity)?"Published APC record contains bid-security information.":null,closing?`Published closing date: ${closing}.`:null].filter(Boolean);
 return {source_id:sourceId,external_id:ref,signal_type:signalType,title,summary:compactSummary(o),organization:org,region,published_at:iso(posted),deadline_at:iso(closing),source_url:publicUrl(ref),verified_facts:facts,raw_payload:o}}
async function upsertBatch(items:any[]){if(!items.length)return;await db("signals?on_conflict=source_id,external_id",{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify(items)})}


async function piosCronSecret(){const r=await fetch(`${U}/rest/v1/system_secrets?name=eq.scheduled_intelligence&select=secret`,{headers:{apikey:K,Authorization:`Bearer ${K}`}});if(!r.ok)return "";const a=await r.json();return a?.[0]?.secret||""}
function piosSafe(a:string,b:string){if(!a||!b||a.length!==b.length)return false;let x=0;for(let i=0;i<a.length;i++)x|=a.charCodeAt(i)^b.charCodeAt(i);return x===0}
async function piosAuthorized(req:Request){return piosSafe(req.headers.get("x-pios-cron-token")||"",await piosCronSecret())}

Deno.serve(async(req:Request)=>{if(req.method!=="POST")return J({error:"POST required"},405);if(!(await piosAuthorized(req)))return J({error:"unauthorized"},401);let src:any=null;try{const body=await req.json().catch(()=>({}));const dry=Boolean(body?.dry_run);const maxRows=Math.min(500,Math.max(1,Number(body?.max_rows||DEFAULT_MAX)));const first=await search(Math.min(PAGE_SIZE,maxRows),0);const firstRows=rows(first);const total=Math.max(firstRows.length,Number(first?.totalCount||firstRows.length));if(dry)return J({ok:true,dry_run:true,totalCount:total,page_count:firstRows.length,top_level_keys:Object.keys(first||{}),sample:firstRows.slice(0,5)});
 src=await source();if(!src?.id)throw new Error("APC source row missing");let all=[...firstRows];const pageCount=Math.min(Math.ceil(Math.min(total,maxRows)/PAGE_SIZE),5);for(let page=1;page<pageCount;page++){const r=rows(await search(PAGE_SIZE,page));all.push(...r);if(!r.length)break}
 all=all.slice(0,maxRows);let stored=0,awards=0,pipeline=0,tenders=0;for(let i=0;i<all.length;i+=25){const batch=all.slice(i,i+25).map((o:any)=>normalize(src.id,o)).filter(Boolean);for(const x of batch){if(x.signal_type==="procurement_award_notice")awards++;else if(x.signal_type==="procurement_pipeline_notice")pipeline++;else tenders++}await upsertBatch(batch);stored+=batch.length}
 await db(`world_sources?id=eq.${src.id}`,{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({last_success_at:new Date().toISOString(),last_error:null,updated_at:new Date().toISOString()})});return J({ok:true,totalCount:total,scanned:all.length,stored_or_updated:stored,active_tenders:tenders,pipeline_notices:pipeline,award_notices:awards,pages:pageCount,sample_refs:all.slice(0,8).map((o:any)=>o.referenceNumber||o.solicitationNumber||o.id)})
 }catch(e){try{if(!src)src=await source();if(src?.id)await db(`world_sources?id=eq.${src.id}`,{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({last_error:String(e).slice(0,500),updated_at:new Date().toISOString()})})}catch{}return J({error:String(e)},500)}});
