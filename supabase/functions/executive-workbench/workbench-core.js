
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
 const normalizedCaps=capNames.map(x=>x.toLowerCase());
 const matchedCaps=matches.filter(m=>normalizedCaps.some(c=>c.includes(m.toLowerCase())||m.toLowerCase().includes(c))).slice(0,8);
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

export {prepareQuote,prepareCandidateQualification};
