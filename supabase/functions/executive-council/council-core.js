
const num = x => x===null||x===undefined||x===""||!Number.isFinite(Number(x))?null:Number(x);
const stamp = x => {const n=x?Date.parse(x):NaN;return Number.isFinite(n)?n:null};
const states = new Set(["quoted","submitted","qualified","estimating","lead","won","active","completed","lost"]);
const activePipeline = new Set(["quoted","submitted","qualified","estimating","lead"]);
const day = 86400000;
const fact=(text,source,observed_at=null)=>({text,source,observed_at});
const adviser=(id,name,status,headline,facts=[],challenge=null,next_check=null,affects=[])=>({id,name,status,headline,facts,challenge,next_check,affects});
const money=(n,c)=>new Intl.NumberFormat("en-CA",{style:"currency",currency:c||"CAD",maximumFractionDigits:0}).format(n);
function buildCouncil({profile={},goals=[],contracts=[],finance=null,operating=[],commitments=[],capabilities=[],resources=[],sources=[],personalValue=null,candidate=null,now=new Date().toISOString()}={}){
 const nowMs=stamp(now)||Date.now();
 const pv=personalValue&&typeof personalValue==="object"?personalValue:null;
 const validGoals=(goals||[]).filter(g=>g&&g.status!=="inactive"),goal=validGoals.find(g=>g.id===pv?.goal_id)||(validGoals[0]||null);
 const contract=(contracts||[]).find(c=>c.goal_id===goal?.id)||null;
 const desired=contract?.desired_state||{};
 const floor=num(desired.minimum_gross_margin_pct),target=num(goal?.target_value),current=num(goal?.current_value);
 const amountTarget=num(desired.combined_contract_value_target);
 const candidateId=candidate?.id||null;
 const chosen=(operating||[]).find(o=>candidateId&&o.candidate_id===candidateId)||null;
 const qualified=(operating||[]).filter(o=>["won","active","completed"].includes(o.stage));
 const open=(operating||[]).filter(o=>activePipeline.has(o.stage));
 const urgent=(commitments||[]).filter(c=>!["cancelled","completed","done"].includes(String(c?.status))&&stamp(c?.due_at||c?.starts_at)!==null&&stamp(c?.due_at||c?.starts_at)>=nowMs&&stamp(c?.due_at||c?.starts_at)<=nowMs+7*day);
 const overdue=(commitments||[]).filter(c=>!["cancelled","completed","done"].includes(String(c?.status))&&stamp(c?.due_at)!==null&&stamp(c?.due_at)<nowMs);
 const liquid=num(finance?.cash);
 const reserves=["taxes_reserved","payroll_reserved","emergency_reserve","operating_reserve"];
 const reserved=reserves.reduce((sum,k)=>sum+(num(finance?.[k])||0),0);
 const missingReserves=reserves.some(k=>num(finance?.[k])===null);
 const available=liquid===null||missingReserves?null:Math.max(0,liquid-reserved);
 const estimatedCapital=num(candidate?.capital_required_high??candidate?.capital_required_low);
 const quoted=num(chosen?.quoted_value??candidate?.scope_match?.quoted_value);
 const margin=num(chosen?.estimated_margin_pct??candidate?.scope_match?.estimated_margin_pct);
 const quoteStage=chosen?.stage||null;
 const expired=pv?.status==="expired"|| (stamp(candidate?.window_end)!==null&&stamp(candidate?.window_end)<nowMs);
 const personal=pv?.surface===true&&!expired;
 const personalUnknowns=(pv?.not_known||[]).filter(x=>typeof x==="string").slice(0,6);
 const specialist=[];
 // Only facts linked to the person's current goal or owned state are promoted.
 if(goal){
   const facts=[fact("Active goal: "+goal.title,"goal:"+goal.id,goal.updated_at||null)];
   if(current!==null&&target!==null)facts.push(fact("Recorded progress: "+current+" / "+target+(goal.target_unit?" "+goal.target_unit:""),"goal:"+goal.id));
   if(goal.target_date)facts.push(fact("Recorded deadline: "+goal.target_date,"goal:"+goal.id));
   if(amountTarget!==null)facts.push(fact("Recorded contract-value target: "+money(amountTarget,goal.currency),"contract:"+contract?.id));
   specialist.push(adviser("goal","Goal & trajectory","active",current!==null&&target!==null?"Goal gap: "+Math.max(0,target-current)+(goal.target_unit?" "+goal.target_unit:""):"Goal progress is not fully measurable",facts,
     current===null||target===null?"A baseline or target is missing.":null,
     current===null||target===null?"Record an actual baseline before projecting progress.":"Check the next move against every success criterion.",["goal"]));
 }
 const businessRelevant=personal&&(["business_growth","construction","procurement"].includes(goal?.domain)||chosen);
 if(businessRelevant){
   const facts=[fact(open.length+" open operating record(s) observed.","operating_opportunities")];
   if(chosen){facts.push(fact("Selected owned opportunity stage: "+quoteStage,"operating:"+chosen.id,chosen.updated_at||null));if(quoted!==null)facts.push(fact("Recorded quoted amount: "+money(quoted,profile.preferred_currency),"operating:"+chosen.id));}
   if(!chosen&&candidate?.title)facts.push(fact("Candidate exists; this is not yet an owned contract.","candidate:"+candidate.id));
   specialist.push(adviser("business","Business & opportunity","active",chosen?"Existing opportunity needs a decision on its next stage.":"Candidate requires qualification before becoming a project.",facts,
     chosen&&["quoted","submitted"].includes(quoteStage)?"Customer acceptance has not been observed.":null,
     chosen?"Check the customer's decision status using approved communication; do not mark a quote won.":"Verify the precise service, buyer, scope, and eligibility before estimating.",["business","projects"]));
 }
 if(personal||finance||estimatedCapital!==null){
   const facts=[];
   if(liquid!==null)facts.push(fact("Cash in last recorded snapshot: "+money(liquid,finance?.currency),"financial_snapshot",finance?.captured_at||null));
   if(available!==null)facts.push(fact("Deployable after explicitly recorded reserves: "+money(available,finance?.currency),"financial_snapshot",finance?.captured_at||null));
   if(margin!==null)facts.push(fact("Recorded estimated margin: "+margin+"%.","operating_or_candidate"));
   if(floor!==null)facts.push(fact("Minimum goal margin: "+floor+"%.","goal_contract:"+contract?.id));
   const stale=finance?.captured_at&&stamp(finance.captured_at)!==null&&(nowMs-stamp(finance.captured_at)>45*day);
   const cashOver=available!==null&&estimatedCapital!==null&&estimatedCapital>available;
   const lowMargin=floor!==null&&margin!==null&&margin<floor;
   const missingMargin=businessRelevant&&floor!==null&&margin===null;
   const challenge=cashOver?"Known capital requirement exceeds recorded deployable cash; do not use protected reserves.":
     lowMargin?"Recorded estimated margin falls below the user's minimum.":
     missingMargin?"Estimated margin is unverified; the goal's profitability condition cannot be evaluated.":
     stale?"The financial snapshot is over 45 days old; current cash availability needs confirmation.":
     liquid===null?"Actual cash and reserves are not established.":missingReserves?"Not all reserve amounts are recorded; deployable cash is unknown.":null;
   specialist.push(adviser("finance","Finance & downside",cashOver||lowMargin?"blocked":challenge?"verify":"active",
     cashOver||lowMargin?"A recorded financial guardrail blocks commitment.":challenge?"Financial conditions need verification before commitment.":"No financial gate is currently triggered by the recorded evidence.",facts,challenge,
     cashOver?"Find an approved alternative that does not consume protected reserves, or decline.":
     lowMargin?"Reprice or decline before committing.":
     missingMargin?"Verify estimated direct costs and margin before commitment.":"Verify current cash, terms and exposure before any consequential spend.",["finance"]));
 }
 if(personal||profile.attention_budget_minutes!==undefined||urgent.length||overdue.length){
   const facts=[];
   if(num(profile.attention_budget_minutes)!==null)facts.push(fact("Daily personal attention budget: "+profile.attention_budget_minutes+" minutes.","profile"));
   if(urgent.length)facts.push(fact(urgent.length+" modeled commitment(s) due or starting within seven days.","life_commitments"));
   if(overdue.length)facts.push(fact(overdue.length+" recorded commitment(s) past their due date; completion status needs confirmation.","life_commitments"));
   const t=num(candidate?.time_required_hours);
   if(t!==null)facts.push(fact("Candidate time requirement as recorded: "+t+" hour(s).","candidate:"+candidateId));
   specialist.push(adviser("time","Time & capacity",t===null&&personal?"verify":"active",
     overdue.length?"A recorded deadline has passed and its resolution is unknown.":urgent.length?"Known commitments must be considered before adding work.":"Personal attention is finite; capacity is not established by an empty calendar.",facts,
     t===null&&personal?"The actual estimator or execution time for this decision is unverified.":null,
     "Limit preliminary work to a bounded information step; confirm availability before scheduling external commitments.",["time"]));
 }
 if(["career_income","education_skills"].includes(goal?.domain)){
   const facts=[fact("Recorded skills/capabilities: "+capabilities.length+".","capabilities")];
   specialist.push(adviser("career","Career & learning",personal?"verify":"watch",
     personal?"The opportunity must fit skills, credentials, costs and available time.":"No personally actionable career or learning change is established.",facts,
     personal?"Qualification, training duration and return on time/capital remain unverified.":null,
     "Check requirements and measurable goal contribution before training or applying.",["capabilities","goal","time"]));
 }
 if(goal?.domain==="real_estate"){
   const property=(resources||[]).filter(x=>String(x.category||"").toLowerCase().includes("property")||String(x.category||"").toLowerCase().includes("real_estate"));
   specialist.push(adviser("property","Property & assets",personal?"verify":"watch",
     property.length?"Recorded property-related resources exist; legal ownership and value still need verification.":"No verified property holding is modeled for this goal.",
     [fact(property.length+" recorded property-related resource(s).","resources_assets")],
     personal?"Location, title, carrying costs and permissions require evidence.":null,
     "Verify the specific property's actual state and costs before any commitment.",["assets","finance"]));
 }
 if(personal&&candidate){
   const caps=(pv?.why_you||[]).filter(x=>x.kind==="recorded_capability").map(x=>x.fact);
   const facts=caps.map(x=>fact(x,"capabilities"));
   const eligible=["eligible","verified"].includes(candidate.eligibility_status);
   specialist.push(adviser("eligibility","Capability & eligibility",eligible?"active":"verify",
     eligible?"Candidate eligibility is recorded as eligible; source verification remains relevant.":"A topic match does not establish mandatory qualification.",facts,
     eligible?null:"Qualifications, permissions, insurance or scope may be missing; do not infer eligibility from a skill label.",
     "Check the source requirements against independently recorded qualifications and capacity.",["capabilities","projects"]));
 }
 const evidenceFacts=[];
 const verifiedExternal=(pv?.evidence||[]).filter(e=>e.type==="linked_external_record");
 const linkedInternal=(pv?.evidence||[]).filter(e=>e.type==="observed_internal");
 if(linkedInternal.length)evidenceFacts.push(fact(linkedInternal.length+" linked internal record(s) support the selected personal consequence.","personal_consequence"));
 if(verifiedExternal.length)evidenceFacts.push(fact(verifiedExternal.length+" external source record(s) linked; document details are not automatically verified.","personal_consequence"));
 if(sources.length)evidenceFacts.push(fact(sources.length+" source connection(s) have recorded sync state; this is not proof that all life events were observed.","connected_source_sync_state"));
 const unknownPersonal=personalUnknowns.length>0;
 specialist.push(adviser("evidence","Evidence & assumptions",!personal?"watch":unknownPersonal?"verify":"active",
   !personal?"No verified personally actionable change should interrupt the user.":
   unknownPersonal?"Decision-sensitive unknowns still affect this recommendation.":"An actionable link exists, but real-world outcome is not established.",
   evidenceFacts,
   unknownPersonal?personalUnknowns[0]:null,
   !personal?"Continue passive observation until an event changes personal state or options.":"Resolve the most decision-sensitive unknown and update provenance.",["bottleneck"]));
 const blocking=specialist.filter(s=>s.status==="blocked");
 const openMargin=specialist.find(s=>s.id==="finance"&&s.challenge&&s.challenge.toLowerCase().includes("margin is unverified"));
 const conflicts=[];
 if(businessRelevant&&blocking.length)conflicts.push({between:["business","finance"],issue:"An opportunity fits the business goal but fails a recorded financial guardrail.",resolution:"Do not commit. Reprice, change structure, or decline after verification."});
 else if(businessRelevant&&openMargin)conflicts.push({between:["business","finance"],issue:"The business case is attractive but margin evidence is missing.",resolution:"Verify direct costs and margin before promising delivery or using capital."});
 if(personal&&urgent.length)conflicts.push({between:["business","time"],issue:"An additional opportunity competes with recorded near-term commitments.",resolution:"Verify capacity before accepting any deadline or delivery obligation."});
 let nextMove=null,reason=null,escalation="none",interrupt=false;
 if(!goal){nextMove={kind:"clarify",title:"Define the first personal objective",detail:"What outcome would you like PIOS to help change first?",approval_required:false};reason="No active goal has been observed.";}
 else if(overdue.length){nextMove={kind:"verify",title:"Check a recorded overdue commitment",detail:"Confirm whether the recorded obligation is still open; if so, determine the immediate deadline consequence and appropriate action.",approval_required:false};reason="Your own commitment record shows a past due date without a completed status. Verify reality before reprioritizing.";interrupt=true;escalation="commitment";}
 else if(!personal){nextMove=null;reason="No verified personal consequence clears the attention threshold. Specialist monitoring remains quiet.";}
 else if(blocking.length){const f=blocking[0];nextMove={kind:"verify",title:"Resolve the "+f.name.toLowerCase()+" gate",detail:f.next_check,approval_required:false};reason=f.challenge;interrupt=true;escalation="guardrail";}
 else if(openMargin){nextMove={kind:"verify",title:"Verify project economics",detail:"Confirm the estimated direct costs and gross margin; do not equate the quoted value with secured profit.",approval_required:false};reason="Business and finance specialists disagree because the margin floor cannot yet be checked.";interrupt=true;}
 else if(pv?.next_move){nextMove={kind:"prepare",title:"Prepare the next personal step",detail:pv.next_move.detail||"Verify the next decision gate.",approval_required:pv.next_move.requires_approval_before_external_contact===true};reason="The next step is bounded by the person's active goal, existing state and available evidence.";interrupt=true;}
 else {nextMove={kind:"verify",title:"Clarify personal relevance",detail:"Obtain the minimum evidence that could change the decision.",approval_required:false};reason="The personal consequence is relevant but insufficiently established.";interrupt=false;}
 const affected=[...new Set((personal?pv?.why_you||[]:[]).map(x=>x.node).filter(Boolean))];
 if(overdue.length)affected.push("time");
 if(personal&&unknownPersonal)affected.push("bottleneck");
 const adviserStates=specialist.map(a=>({id:a.id,status:a.status}));
 return {version:"executive_council_v1",as_of:now,mode:!goal?"needs_goal":overdue.length?"brief":!personal?"quiet":blocking.length?"blocked":"brief",
   matched_goal_id:goal?.id||null,candidate_id:personal?candidateId:null,
   chief_of_staff:{headline:nextMove?.title||"No personal intervention required",reason,interruption_warranted:interrupt,
     escalation,next_move:nextMove,conflicts,affected_nodes:[...new Set(affected)]},
   specialists:specialist,adviser_states:adviserStates,
   facts_are_not_forecasts:true,auto_work_executed:false,
   contract:"Advisers assess the same state. A conflicting hard constraint blocks commitment. Unobserved results remain unknown. No external action occurs without explicit approval."};
}
export {buildCouncil};
