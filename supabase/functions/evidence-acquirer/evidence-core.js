const clean=(x,max=3000)=>String(x??"").replace(/\s+/g," ").trim().slice(0,max);
const has=(text,re)=>re.test(String(text||""));
const ev=(field,value,source,confidence=100)=>({field,value,source,confidence});
function acquireEvidence({candidate={},signal={},capabilities=[],graphNodes=[],question="",fetchSnapshot=null}={}){
  const raw=signal?.raw_payload||{}, verified=Array.isArray(signal?.verified_facts)?signal.verified_facts:[];
  const evidence=[], unresolved=[];
  const sourceRef=signal?.id?("signal:"+signal.id):"signal:unknown";
  const add=(field,value,source=sourceRef,confidence=100)=>{ if(value===null||value===undefined||value==="")return; evidence.push(ev(field,value,source,confidence)); };
  add("source_url",signal?.source_url,sourceRef,100);
  add("organization",signal?.organization,sourceRef,100);
  add("published_deadline",signal?.deadline_at||raw.closeDateTime,sourceRef,100);
  add("solicitation_type",raw.solicitationTypeCode,sourceRef,100);
  add("opportunity_type",raw.opportunityTypeCode,sourceRef,100);
  add("reference_number",raw.referenceNumber,sourceRef,100);
  add("solicitation_number",raw.solicitationNumber,sourceRef,100);
  add("bid_security_published_field",raw.bidSecurity,sourceRef,100);
  add("submission_details",clean(raw.submissionDetails,1800),sourceRef,100);
  add("question_submission_details",clean(raw.questionSubmissionDetails,1800),sourceRef,100);
  add("additional_requirements",clean(raw.additionalRequirements,2500),sourceRef,100);
  if(verified.length)add("verified_source_facts",verified.slice(0,20),sourceRef,100);
  const scope=clean(raw.projectDescription||signal?.summary,5000);
  if(scope)add("published_scope_excerpt",scope,sourceRef,100);
  const dependencies=[];
  if(has(scope,/asbestos|lead[- ]containing|hazardous material/i))dependencies.push("hazardous_materials");
  if(has(scope,/electrical|powered garage door|medical gas|air handling/i))dependencies.push("specialty_trade");
  if(has(scope,/demolition|abatement/i))dependencies.push("demolition_abatement");
  if(dependencies.length)add("scope_dependencies",dependencies,sourceRef,95);
  const requirementText=clean(raw.additionalRequirements,5000);
  const modelText=[...(capabilities||[]).map(x=>String(x?.name||"")+" "+String(x?.category||"")+" "+String(x?.evidence||"")),...(graphNodes||[]).map(x=>String(x?.node_type||"")+" "+String(x?.label||"")+" "+JSON.stringify(x?.state||{}))].join(" ").toLowerCase();
  const reqChecks=[
    {key:"COR_or_SECOR",re:/\b(?:cor|secor|certificate of recognition)\b/i,model:/\b(?:cor|secor|certificate of recognition)\b/i},
    {key:"insurance",re:/insurance|cgl|commercial general liability/i,model:/insurance|cgl|commercial general liability/i},
    {key:"bonding",re:/bond|surety/i,model:/bond|surety/i},
    {key:"security_clearance",re:/security clearance|reliability status|designated organization screening/i,model:/security clearance|reliability status|designated organization screening/i}
  ];
  for(const check of reqChecks){ if(check.re.test(requirementText)){ const present=check.model.test(modelText); add("published_requirement_"+check.key,true,sourceRef,100); if(!present)unresolved.push({topic:check.key,reason:"The authoritative source record states this requirement, but the current Digital Twin does not contain evidence that it is satisfied.",decision_sensitive:true}); else add("twin_evidence_mentions_"+check.key,true,"personal_graph/capabilities",80); } }
  if(!requirementText)unresolved.push({topic:"mandatory_eligibility",reason:"The stored authoritative API record does not contain the full mandatory qualification/document requirements. Absence of an additional-requirements field is not proof that none exist.",decision_sensitive:true});
  if(!clean(raw.submissionDetails,1200))unresolved.push({topic:"submission_method",reason:"Detailed submission instructions are not present in the stored source payload.",decision_sensitive:true});
  if(fetchSnapshot){
    add("live_source_fetch",{ok:!!fetchSnapshot.ok,status:fetchSnapshot.status??null,final_url:fetchSnapshot.final_url||null,content_type:fetchSnapshot.content_type||null,bytes:fetchSnapshot.bytes??null,sha256:fetchSnapshot.sha256||null,fetched_at:fetchSnapshot.fetched_at||null},"live_source_fetch",fetchSnapshot.ok?95:60);
    if(fetchSnapshot.ok&&fetchSnapshot.text){ const t=fetchSnapshot.text; const meeting=t.match(/(?:pre[- ]?bid|information)\s+(?:meeting|session)[^.!?\n]{0,220}/i); if(meeting)add("possible_prebid_meeting_text",clean(meeting[0],320),"live_source_fetch",65); const contact=t.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i); if(contact)add("possible_contact_email",contact[0],"live_source_fetch",65); }
    else if(!fetchSnapshot.ok)unresolved.push({topic:"live_source_refresh",reason:"The original public source could not be read in this research run; stored authoritative data remains the only verified source.",decision_sensitive:false});
  }
  const q=clean(question,1200);
  if(/margin|profit|cost|capital|price|econom/i.test(q))unresolved.push({topic:"project_economics",reason:"Public procurement metadata cannot establish direct costs, estimator effort, working capital, or achievable gross margin.",decision_sensitive:true});
  const decisionSensitive=unresolved.filter(x=>x.decision_sensitive);
  const blockers=unresolved.filter(x=>["COR_or_SECOR","insurance","bonding","security_clearance"].includes(x.topic));
  const status=blockers.length?"blocked_by_unverified_requirement":decisionSensitive.length?"partial":"complete";
  const conclusion={status,uncertainty_reduced:evidence.length>0,decision_sensitive_gaps:decisionSensitive.length,blocking_requirement_gaps:blockers.length,recommendation:blockers.length?"Do not escalate commitment until the published requirement is verified as satisfied.":decisionSensitive.length?"Use the verified source facts, but keep the decision in LEARN FIRST until the remaining decision-sensitive gap is resolved.":"The requested evidence question is sufficiently answered by the currently stored and fetched source evidence."};
  return {version:"evidence_acquirer_v1",question:q,evidence,unresolved,conclusion};
}
export {acquireEvidence};
