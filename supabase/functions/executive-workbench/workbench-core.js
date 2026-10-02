
const v=x=>x===null||x===undefined||x===""||!Number.isFinite(Number(x))?null:Number(x);
const trim=(x,max=180)=>String(x??"").replace(/[\u0000-\u001f\u007f]/g," ").trim().slice(0,max);
function prepareQuote(record,goalContract=null,now=new Date().toISOString()){
 if(!record||record.stage!=="quoted")throw new Error("Only an owned quotation in quoted stage can be prepared.");
 if(!record.id||!record.updated_at)throw new Error("Quotation source ID or update timestamp missing.");
 const title=trim(record.title||"your project"),customer=trim(record.customer||"",130),amount=v(record.quoted_value);
 const cost=v(record.estimated_direct_cost),recordedMargin=v(record.estimated_margin_pct);
 const computedMargin=amount!==null&&amount>0&&cost!==null?Number(((amount-cost)/amount*100).toFixed(1)):null;
 const margin=recordedMargin!==null?recordedMargin:computedMargin;
 const floor=v(goalContract?.desired_state?.minimum_gross_margin_pct);
 const facts=[{field:"project",value:title,source:"operating_opportunities:"+record.id},
 {field:"stage",value:"quoted",source:"operating_opportunities:"+record.id}];
 if(customer)facts.push({field:"customer",value:customer,source:"operating_opportunities:"+record.id});
 if(amount!==null)facts.push({field:"quoted_value",value:amount,source:"operating_opportunities:"+record.id});
 if(cost!==null)facts.push({field:"estimated_direct_cost",value:cost,source:"operating_opportunities:"+record.id});
 if(recordedMargin!==null)facts.push({field:"recorded_estimated_margin_pct",value:recordedMargin,source:"operating_opportunities:"+record.id});
 const unknowns=[
 "Customer acceptance and decision timeline have not been verified from this quotation record.",
 ...(amount===null?["Quotation amount is not recorded."]:[]),
 ...(margin===null?["Estimated direct cost or gross margin is missing; profitability is unverified."]:[]),
 ...(floor!==null&&margin!==null&&margin<floor?["Estimated margin is below the recorded minimum; reprice or decline before accepting."]:[]),
 "Scope, payment terms and delivery capacity must be checked before any commitment."
 ];
 const checks=[
 {label:"Confirm quote status",state:"needs_verification",detail:"Check customer response, outstanding clarifications and expected decision date."},
 {label:"Verify gross margin",state:margin===null?"needs_data":floor!==null&&margin<floor?"below_floor":"recorded_estimate",detail:margin===null?"Enter estimated direct costs; do not count an unverified profit.":floor===null?"Estimated margin "+margin+"%; no minimum margin is recorded.":"Estimated margin "+margin+"%; recorded minimum "+floor+"%."},
 {label:"Check scope, capacity and terms",state:"needs_verification",detail:"Verify scope exclusions, scheduling, payment terms and available resources before external commitments."}
 ];
 const formattedAmount=amount===null?"":(" for the quotation valued at CAD "+new Intl.NumberFormat("en-CA",{maximumFractionDigits:0}).format(amount));
 const subject="Quotation follow-up — "+title;
 const body="Hello,\n\nI am following up on our quotation for "+title+". Could you confirm whether the project is moving forward, whether any clarification is needed, or whether your decision timeline has changed?\n\nThank you.";
 return {
  kind:"quote_followup",headline:"Follow-up package prepared for "+title,
  stage:"prepared_internal",recorded_customer:customer||null,source_record_id:record.id,
  source_updated_at:record.updated_at,prepared_at:now,
  summary:"A draft follow-up and a three-part internal decision checklist are prepared from the recorded quotation. No customer response or contract acceptance has been verified.",
  evidence:facts,unknowns,internal_checks:checks,
  draft:{subject,body,recipient:null,ready_to_send:false,external_message_sent:false,
    warning:"Internal draft only. Verify recipient, message, scope and approval before any external communication."},
  profit_qualification:{estimated_margin_pct:margin,minimum_margin_pct:floor,
    passes_recorded_floor:margin!==null&&floor!==null?margin>=floor:null,
    verified_actual_profit:false},
  action_status:{preparation:"completed",external_contact:"not_performed",customer_acceptance:"unverified",
    requires_human_approval:true}
 };
}

function prepareCandidateQualification(candidate,signal=null,capabilities=[],finance=null,goalContract=null,now=new Date().toISOString()){
 if(!candidate?.id||!candidate?.updated_at)throw new Error("Candidate source ID or update timestamp missing.");
 const title=trim(candidate.title||"opportunity",220);
 const matches=Array.isArray(candidate?.scope_match?.matches)?candidate.scope_match.matches.map(x=>trim(x,120)).filter(Boolean):[];
 const capNames=(capabilities||[]).map(x=>trim(x?.name,120)).filter(Boolean);
 const terms=x=>String(x||"").toLowerCase().replace(/[^a-z0-9]+/g," ").split(/\s+/).filter(t=>t&&!["and","or","the","of","for"].includes(t));
 const capabilityMatch=(scope,cap)=>{
   const a=terms(scope),b=terms(cap);if(!a.length||!b.length)return false;
   const overlap=a.filter(t=>b.includes(t));
   return overlap.length>=Math.min(2,a.length)||overlap.length>=Math.min(2,b.length);
 };
 const matchedCaps=matches.filter(m=>capNames.some(c=>capabilityMatch(m,c))).slice(0,8);
 const raw=signal?.raw_payload||{},verified=Array.isArray(signal?.verified_facts)?signal.verified_facts:[];
 const sourceLinked=!!signal?.source_url;
 const deadline=signal?.deadline_at||candidate.window_end||null;
 const capitalHigh=v(candidate.capital_required_high),cash=v(finance?.cash);
 const reserveKeys=["taxes_reserved","payroll_reserved","emergency_reserve","operating_reserve"];
 const reservesKnown=finance&&reserveKeys.every(k=>v(finance[k])!==null);
 const deployable=v(finance?.deployable_capital)!==null?v(finance.deployable_capital):
   cash!==null&&reservesKnown?Math.max(0,cash-reserveKeys.reduce((a,k)=>a+(v(finance[k])||0),0)):null;
 const minMargin=v(goalContract?.desired_state?.minimum_gross_margin_pct);
 const summary=trim(signal?.summary||raw?.projectDescription||"",1400);
 const scopeText=(title+" "+summary).toLowerCase();
 const dependencies=[];
 if(/asbestos|lead containing|lead paint/.test(scopeText))dependencies.push("Hazardous-material abatement responsibilities appear in the source scope; exact qualification/subcontract strategy must be verified.");
 if(/electrical|powered garage door/.test(scopeText))dependencies.push("Electrical/garage-door work appears in the source scope; package boundaries and qualified trade responsibility must be verified.");
 if(/fiber cement|cladding|siding|exterior/.test(scopeText)&&!matchedCaps.length)dependencies.push("Exterior/cladding scope is present, but the current capability match has not been independently confirmed from the stored capability list.");
 const facts=[
  {field:"candidate_title",value:title,source:"opportunity_candidates:"+candidate.id},
  {field:"candidate_status",value:candidate.status||null,source:"opportunity_candidates:"+candidate.id},
  {field:"candidate_eligibility_classification",value:candidate.eligibility_status||null,source:"opportunity_candidates:"+candidate.id}
 ];
 if(sourceLinked)facts.push({field:"source_url",value:signal.source_url,source:"signals:"+signal.id});
 if(signal?.organization)facts.push({field:"organization",value:trim(signal.organization,180),source:"signals:"+signal.id});
 if(deadline)facts.push({field:"recorded_deadline",value:deadline,source:"signals:"+(signal?.id||"unknown")});
 if(raw?.bidSecurity!==undefined&&raw?.bidSecurity!==null)facts.push({field:"published_bid_security_field",value:trim(raw.bidSecurity,180),source:"signals:"+signal.id});
 if(verified.length)facts.push({field:"source_verified_facts",value:verified.slice(0,12),source:"signals:"+signal.id});
 if(matches.length)facts.push({field:"scanner_scope_matches",value:matches,source:"opportunity_candidates:"+candidate.id});
 if(matchedCaps.length)facts.push({field:"recorded_capability_overlap",value:matchedCaps,source:"capabilities"});
 const unknowns=[
  ...(!sourceLinked?["The original source URL is not linked."]:[]),
  "Exact solicitation documents, mandatory forms, insurance, bonding and bidder qualifications have not been independently verified by this workbench.",
  ...(candidate.time_required_hours==null?["Estimator/preparation time is unknown."]:[]),
  ...(capitalHigh===null?["Working-capital requirement is unknown."]:[]),
  "Profitability is unknown until quantities, pricing, delivery requirements and package boundaries are established.",
  ...dependencies
 ];
 const hardCapital=capitalHigh!==null&&deployable!==null&&capitalHigh>deployable;
 const deadlinePassed=deadline&&Date.parse(deadline)<Date.parse(now);
 const gates=[
  {label:"Source record",state:sourceLinked?"linked":"missing",detail:sourceLinked?"Authoritative source link is stored; document-level requirements still need verification.":"No source link is stored."},
  {label:"Capability fit",state:matchedCaps.length?"partial_match":"needs_verification",detail:matchedCaps.length?"Recorded overlap: "+matchedCaps.join(", ")+". This does not prove full-scope qualification.":"No direct stored capability overlap was confirmed by this preparer."},
  {label:"Eligibility",state:["verified","eligible"].includes(candidate.eligibility_status)?"recorded_eligible":"needs_verification",detail:"Stored eligibility classification: "+trim(candidate.eligibility_status||"unknown",80)+". Verify exact solicitation requirements."},
  {label:"Capital",state:hardCapital?"blocked":capitalHigh===null||deployable===null?"unknown":"recorded_fit",detail:hardCapital?"Known capital requirement exceeds recorded deployable capital.":capitalHigh===null||deployable===null?"Capital requirement or deployable amount is unknown.":"Recorded capital requirement does not exceed recorded deployable capital."},
  {label:"Profitability",state:"needs_pricing",detail:minMargin===null?"Build the estimate before deciding; no minimum margin is recorded.":"Build the estimate and require at least the recorded "+minMargin+"% margin before commitment."},
  {label:"Deadline",state:deadlinePassed?"expired":deadline?"recorded":"unknown",detail:deadlinePassed?"Recorded deadline has passed; verify reopening/extension before work.":deadline?"Recorded closing time: "+deadline+".":"Closing time is not established."}
 ];
 const blocked=hardCapital||deadlinePassed;
 return {
  kind:"candidate_qualification",headline:"Qualification pack prepared for "+title,
  stage:"prepared_internal",source_candidate_id:candidate.id,source_signal_id:signal?.id||null,
  source_updated_at:candidate.updated_at,prepared_at:now,
  summary:blocked?"A recorded guardrail currently blocks commitment. The opportunity was not advanced.":"A source-linked internal qualification pack is prepared. It narrows what must be verified before estimator/pricing effort or commitment.",
  evidence:facts,unknowns,dependencies,qualification_checks:gates,
  recommendation:{state:blocked?"blocked":"verify_before_estimate",
    detail:blocked?"Resolve the blocking condition or decline.":"Verify exact package/mandatory requirements, then estimate only if capability and eligibility remain credible."},
  economics:{capital_required_high:capitalHigh,recorded_deployable:deployable,minimum_margin_pct:minMargin,profitability_verified:false},
  action_status:{preparation:"completed",source_documents_retrieved:false,external_contact:"not_performed",bid_submitted:false,commitment_made:false,requires_human_approval:true}
 };
}


function prepareEstimateWorkspace(candidate,signal=null,capabilities=[],goalContract=null,qualification=null,research=null,now=new Date().toISOString()){
 if(!candidate?.id||!candidate?.updated_at)throw new Error("Candidate source ID or update timestamp missing.");
 const raw=signal?.raw_payload||{},scope=trim(raw.projectDescription||signal?.summary||candidate.title||"",7000);
 const capNames=(capabilities||[]).map(x=>trim(x?.name,120)).filter(Boolean);
 const items=[];
 const push=(code,label,bucket,source_text,quantity_needed=true)=>{if(!items.some(x=>x.code===code))items.push({code,label,bucket,source_text:trim(source_text,500),quantity:null,unit:null,unit_cost:null,labor_cost:null,material_cost:null,subcontract_cost:null,total_cost:null,quantity_needed,status:quantity_needed?"needs_quantity":"scope_check"})};
 if(/siding|cladding|fiber cement|fibre cement/i.test(scope))push("cladding","Exterior siding / cladding","core_or_partner","Published scope includes exterior cladding.");
 if(/sheathing/i.test(scope))push("sheathing","Wall sheathing repair/replacement","scope_dependent","Published scope includes wall sheathing work.");
 if(/weather barrier|air barrier|water-resistive|wrb/i.test(scope))push("barrier","Weather / air barrier","scope_dependent","Published scope includes building-envelope barrier work.");
 if(/sealant|caulk/i.test(scope))push("sealants","Exterior sealants","scope_dependent","Published scope includes sealant work.");
 if(/fascia|eavestrough|gutter|downspout/i.test(scope))push("drainage","Fascia / eavestrough / downspout","core_or_partner","Published scope includes roof-edge/drainage components.");
 if(/asbestos|lead[- ]containing|lead paint|abatement/i.test(scope))push("abatement","Hazardous-material abatement","specialist_partner","Published scope references hazardous-material work.");
 if(/electrical|powered garage door|garage door opener/i.test(scope))push("electrical","Electrical / powered garage-door work","specialist_partner","Published scope references electrical or powered garage-door work.");
 if(/demolition|remove|removal/i.test(scope))push("demolition","Removal / demolition","scope_dependent","Published scope includes removal/demolition activity.");
 if(!items.length)push("general_scope","General construction scope","needs_document_breakdown","Public record does not provide enough structured trade detail.");
 const matched=(qualification?.evidence||[]).find(x=>x.field==="recorded_capability_overlap")?.value||[];
 const floor=v(goalContract?.desired_state?.minimum_gross_margin_pct);
 const docs=(research?.unresolved||[]).filter(x=>/document|quantity|mandatory|submission|drawing|specification|requirement/i.test(String(x?.topic||"")+" "+String(x?.reason||"")));
 const unknowns=[
   "No unit prices or quantities are invented by this workspace.",
   "Direct labour, material, equipment, subcontract and disposal costs require project-specific evidence.",
   "Schedule, mobilization, payment terms, retainage and working-capital timing require verification before commitment.",
   ...(docs||[]).map(x=>String(x.reason||x.topic)),
   ...((qualification?.unknowns||[]).filter(x=>typeof x==="string").slice(0,6))
 ];
 const pricing={currency:candidate.currency||"CAD",minimum_gross_margin_pct:floor,
   subtotal_direct_cost:null,contingency:null,total_estimated_cost:null,quoted_price:null,estimated_gross_profit:null,estimated_margin_pct:null,
   formula:floor!==null?"Minimum price check: price must support at least "+floor+"% estimated gross margin after verified direct costs.":"No minimum margin floor is recorded."};
 const nextChecks=[
   {order:1,label:"Obtain quantity-bearing documents",detail:"Use drawings/specifications or a verified takeoff before entering quantities."},
   {order:2,label:"Confirm package boundaries",detail:"Separate self-performed work from licensed/specialist subcontract scopes."},
   {order:3,label:"Enter project-specific direct costs",detail:"Populate labour, materials, equipment, subcontract, disposal and mobilization from evidence."},
   {order:4,label:"Apply profitability guardrail",detail:floor!==null?"Do not advance if estimated gross margin is below "+floor+"%.":"Record a profitability floor before commitment."}
 ];
 return {kind:"estimate_workspace",headline:"Estimate workspace prepared for "+trim(candidate.title||"opportunity",220),
   stage:"prepared_internal",source_candidate_id:candidate.id,source_signal_id:signal?.id||null,source_updated_at:candidate.updated_at,prepared_at:now,
   summary:"PIOS converted the published scope into an internal pricing skeleton. Quantities and prices remain blank until supported by project evidence.",
   published_scope:scope,recorded_capability_overlap:Array.isArray(matched)?matched:[],capabilities_considered:capNames,
   line_items:items,pricing,unknowns:[...new Set(unknowns)],next_checks:nextChecks,
   action_status:{preparation:"completed",estimate_completed:false,external_contact:"not_performed",bid_submitted:false,commitment_made:false,requires_human_approval:false},
   truth_boundary:"This is an estimating workspace, not a completed estimate or bid. Blank numeric fields are intentional until evidence is available."};
}

function applyVerifiedEstimateEvidence(workspace,evidence=[],now=new Date().toISOString()){
 if(!workspace||workspace.kind!=="estimate_workspace")throw new Error("A prepared estimate workspace is required.");
 const currency=String(workspace?.pricing?.currency||"CAD").toUpperCase(),floor=v(workspace?.pricing?.minimum_gross_margin_pct);
 const kinds=new Set(["quantity","labor","material","equipment","subcontract","disposal","mobilization","other","contingency_pct","contingency_amount"]);
 const latest=new Map(),rejected=[];
 const ts=x=>{const n=Date.parse(String(x||""));return Number.isFinite(n)?n:0};
 for(const raw of Array.isArray(evidence)?evidence:[]){
   const e=raw&&typeof raw==="object"?raw:{},kind=String(e.kind||""),line=String(e.line_code||"");
   const value=v(e.value),source=trim(e.source_ref,500),state=String(e.verification_state||"");
   const costKind=["labor","material","equipment","subcontract","disposal","mobilization","other","contingency_amount"].includes(kind);
   const estimateKind=["contingency_pct","contingency_amount"].includes(kind);
   const basis=String(e.basis||"");
   let reason="";
   if(!kinds.has(kind))reason="unsupported_kind";
   else if(state!=="verified")reason="not_verified";
   else if(!source)reason="missing_source";
   else if(value===null||value<0||(kind==="quantity"&&value<=0))reason="invalid_value";
   else if(!estimateKind&&!line)reason="missing_line_code";
   else if(costKind&&String(e.currency||"").toUpperCase()!==currency)reason="currency_mismatch";
   else if(["labor","material","equipment","subcontract","disposal","mobilization","other"].includes(kind)&&!["unit","total"].includes(basis))reason="missing_cost_basis";
   else if(kind==="contingency_pct"&&(value<0||value>=100))reason="invalid_contingency_pct";
   if(reason){rejected.push({line_code:line||null,kind:kind||null,reason});continue}
   const component=trim(e.component||kind,160)||kind,key=(estimateKind?"__estimate__":line)+"|"+kind+"|"+component;
   const prior=latest.get(key);
   if(!prior||ts(e.observed_at)>=ts(prior.observed_at))latest.set(key,{...e,line_code:line,kind,value,source_ref:source,component,basis});
 }
 const accepted=[...latest.values()],forLine=code=>accepted.filter(e=>e.line_code===code&&!e.kind.startsWith("contingency_"));
 const round2=n=>Math.round((Number(n)+Number.EPSILON)*100)/100;
 const items=(workspace.line_items||[]).map(item=>{
   const code=String(item.code||""),ev=forLine(code),q=ev.find(e=>e.kind==="quantity")||null,quantity=q?.value??null,unit=q?trim(q.unit,80)||null:null;
   const rejectedCostEvidence=rejected.some(r=>r.line_code===code&&["labor","material","equipment","subcontract","disposal","mobilization","other"].includes(String(r.kind||"")));
   const components=[];let total=0,hasCost=false,unitCostNeedsQuantity=false;
   for(const e of ev.filter(x=>["labor","material","equipment","subcontract","disposal","mobilization","other"].includes(x.kind))){
     const multiplier=e.basis==="unit"?quantity:1;
     if(e.basis==="unit"&&quantity===null){unitCostNeedsQuantity=true;components.push({kind:e.kind,component:e.component,basis:e.basis,rate:e.value,total:null,source_ref:e.source_ref});continue}
     const amount=round2(e.value*multiplier);total+=amount;hasCost=true;components.push({kind:e.kind,component:e.component,basis:e.basis,rate:e.value,total:amount,source_ref:e.source_ref});
   }
   const totalCost=hasCost&&!unitCostNeedsQuantity&&!rejectedCostEvidence?round2(total):null;
   const quantityVerified=quantity!==null,costVerified=totalCost!==null;
   return {...item,quantity,unit,total_cost:totalCost,status:rejectedCostEvidence?"invalid_cost_evidence":costVerified?(quantityVerified?"verified_costed":"verified_lump_sum_cost"):unitCostNeedsQuantity?"needs_quantity":"needs_cost",verified_cost_components:components,
     evidence_state:{quantity_verified:quantityVerified,cost_verified:costVerified}};
 });
 const missing=[];
 for(const item of items){
   if(item.quantity_needed&&item.quantity===null)missing.push(item.code+": verified quantity");
   if(item.total_cost===null)missing.push(item.code+": verified direct cost");
 }
 const costComplete=items.length>0&&items.every(x=>x.total_cost!==null),takeoffComplete=items.every(x=>!x.quantity_needed||x.quantity!==null);
 const subtotal=costComplete?round2(items.reduce((a,x)=>a+Number(x.total_cost||0),0)):null;
 const cp=accepted.filter(e=>e.kind==="contingency_pct").sort((a,b)=>ts(b.observed_at)-ts(a.observed_at))[0]||null;
 const ca=accepted.filter(e=>e.kind==="contingency_amount").sort((a,b)=>ts(b.observed_at)-ts(a.observed_at))[0]||null;
 let contingency=null,contingencyMode=null;
 const rejectedContingency=rejected.some(r=>["contingency_pct","contingency_amount"].includes(String(r.kind||"")));
 if(subtotal!==null&&!rejectedContingency&&ca){contingency=round2(ca.value);contingencyMode="verified_amount"}
 else if(subtotal!==null&&!rejectedContingency&&cp){contingency=round2(subtotal*cp.value/100);contingencyMode="verified_percent"}
 else missing.push("estimate: verified contingency policy");
 const totalEstimatedCost=subtotal!==null&&contingency!==null?round2(subtotal+contingency):null;
 const validFloor=floor!==null&&floor>=0&&floor<100;
 if(!validFloor)missing.push("estimate: valid minimum gross margin");
 const minPrice=totalEstimatedCost!==null&&validFloor?round2(totalEstimatedCost/(1-floor/100)):null;
 const grossProfit=minPrice!==null&&totalEstimatedCost!==null?round2(minPrice-totalEstimatedCost):null;
 const complete=costComplete&&takeoffComplete&&contingency!==null&&validFloor;
 return {...workspace,summary:complete?"PIOS applied source-linked verified quantities and cost evidence to calculate an internal estimate and margin-floor price check.":"PIOS applied the available source-linked evidence, but the internal estimate remains partial until every required quantity, direct cost, contingency and margin input is verified.",line_items:items,pricing:{...workspace.pricing,subtotal_direct_cost:subtotal,contingency,
   contingency_mode:contingencyMode,total_estimated_cost:totalEstimatedCost,minimum_price_at_margin_floor:minPrice,
   estimated_gross_profit_at_margin_floor:grossProfit,estimated_margin_pct:minPrice!==null?floor:null,quoted_price:null},
   calculation:{status:complete?"verified_complete":"partial",takeoff_complete:takeoffComplete,direct_cost_complete:costComplete,
     verified_evidence_used:accepted.length,rejected_evidence_count:rejected.length,missing_evidence:[...new Set(missing)],calculated_at:now},
   rejected_evidence:rejected,
   action_status:{...(workspace.action_status||{}),estimate_completed:complete,external_contact:"not_performed",bid_submitted:false,commitment_made:false},
   truth_boundary:complete?"Verified source-linked quantities and direct costs support this internal estimate calculation. The minimum-price check is not a customer quote, bid or commitment.":"This estimate remains partial. Missing or unverified evidence is left unresolved; no customer quote, bid or commitment was created."};
}

export {prepareQuote,prepareCandidateQualification,prepareEstimateWorkspace,applyVerifiedEstimateEvidence};
