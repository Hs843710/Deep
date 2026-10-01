
const txt=x=>String(x??"").trim();
const uniq=a=>[...new Set((a||[]).filter(Boolean).map(String))];
function checkPriority(check){
  const state=String(check?.state||"");
  const label=String(check?.label||"").toLowerCase();
  const stateRank={blocked:100,expired:100,missing:90,needs_verification:80,needs_pricing:75,unknown:70,needs_data:70,partial_match:45,recorded_eligible:15,recorded_fit:10,linked:5,recorded:5}[state]??35;
  const topicRank=label.includes("eligib")?9:label.includes("profit")||label.includes("margin")?8:label.includes("capital")?7:label.includes("deadline")?6:label.includes("capability")?5:3;
  return stateRank+topicRank;
}
function deliberation({council=null,candidate=null,personalValue=null,preparedWork=[],learningContext=null}={}){
  const chief=council?.chief_of_staff||{},specialists=Array.isArray(council?.specialists)?council.specialists:[];
  const work=(preparedWork||[]).find(w=>w?.status==="prepared"&&w?.candidate_id===candidate?.id)||null,content=work?.content||{};
  const checks=[...(content.qualification_checks||[]),...(content.internal_checks||[])].filter(Boolean).sort((a,b)=>checkPriority(b)-checkPriority(a));
  const blockedCheck=checks.find(x=>["blocked","expired","missing"].includes(String(x.state||"")));
  const openCheck=checks.find(x=>["needs_verification","needs_pricing","unknown","needs_data"].includes(String(x.state||"")));
  const blockedSpecialist=specialists.find(s=>s.status==="blocked")||null;
  const verifying=specialists.filter(s=>s.status==="verify");
  const personalUnknowns=(personalValue?.not_known||[]).filter(x=>typeof x==="string");
  const workUnknowns=(content.unknowns||[]).filter(x=>typeof x==="string");
  const challenges=specialists.map(s=>s.challenge).filter(Boolean);
  const unknowns=uniq([...personalUnknowns,...workUnknowns,...challenges]);
  const supports=[];
  for(const s of specialists)for(const f of s.facts||[])if(f?.text)supports.push({claim:f.text,source:f.source||s.id});
  for(const e of content.evidence||[])supports.push({claim:txt(e.field)+": "+(typeof e.value==="string"?e.value:JSON.stringify(e.value)),source:e.source||"prepared_work"});
  const conflict=(chief.conflicts||[])[0]||null;
  const hard=blockedCheck||blockedSpecialist||council?.mode==="blocked";
  const missingFact=hard?
    (blockedCheck?.detail||blockedSpecialist?.challenge||chief.reason||null):
    (openCheck?.detail||unknowns[0]||null);
  let policy="PROCEED_REVERSIBLY";
  if(council?.mode==="quiet")policy="QUIET";
  else if(hard)policy="BLOCK";
  else if(missingFact)policy="LEARN_FIRST";
  else if(chief?.next_move?.approval_required)policy="PREPARE_FOR_APPROVAL";
  const counterargument=conflict?
    conflict.issue:
    blockedSpecialist?.challenge||
    verifying[0]?.challenge||
    (policy==="PROCEED_REVERSIBLY"?"The current evidence may still omit an unobserved constraint or a better use of attention.":"Proceeding now may consume attention or capital before the decision-sensitive uncertainty is resolved.");
  const falsification=hard?
    "Reverse the block only if new verified evidence removes the stated constraint without violating another guardrail.":
    missingFact?
      "If the missing fact resolves against the current thesis, pause or reverse the recommendation before commitment.":
      "If new evidence creates a hard guardrail, material contradiction, or superior alternative, re-run the decision before escalating commitment.";
  const hypotheses=[
    {id:"PROCEED",claim:"Advance the selected opportunity through the smallest reversible next step.",status:policy==="PROCEED_REVERSIBLY"||policy==="PREPARE_FOR_APPROVAL"?"leading":hard?"rejected":"uncertain",
      support:supports.slice(0,4),against:uniq([blockedSpecialist?.challenge,openCheck?.detail,conflict?.issue]).slice(0,4)},
    {id:"LEARN_FIRST",claim:"Acquire the minimum evidence that can change the decision before increasing commitment.",status:policy==="LEARN_FIRST"?"leading":missingFact?"plausible":"secondary",
      support:missingFact?[missingFact]:[],against:policy==="PROCEED_REVERSIBLY"?["No decision-sensitive unknown currently dominates the recorded evidence."]:[]},
    {id:"HOLD_OR_DECLINE",claim:"Preserve attention/capital or decline if the constraint cannot be cleared economically.",status:policy==="BLOCK"?"leading":"alternative",
      support:hard?[blockedCheck?.detail||blockedSpecialist?.challenge||chief.reason].filter(Boolean):[],against:!hard&&supports.length?[supports[0].claim]:[]}
  ];
  const learning=learningContext?.summary||{};
  const calibrationNote=Number(learning.calibration_ready||0)>0?
    "Historical calibration evidence exists and should be considered alongside this decision.":
    "There is not yet enough linked real-world outcome evidence to treat confidence as empirically calibrated.";
  const confidenceBand=hard?"high_constraint_confidence":unknowns.length>=3?"low_decision_confidence":unknowns.length?"moderate_decision_confidence":"provisional_high_decision_confidence";
  return {
    version:"executive_deliberation_v1",
    policy,
    belief:policy==="QUIET"?"No personal intervention is justified by the current evidence.":
      policy==="BLOCK"?"Do not escalate commitment until the binding constraint is cleared.":
      policy==="LEARN_FIRST"?"The highest-value move is to reduce the decision-sensitive uncertainty before commitment.":
      policy==="PREPARE_FOR_APPROVAL"?"The option can move to preparation, but consequential action remains behind approval.":
      "The option can advance only through the smallest reversible step.",
    confidence_band:confidenceBand,
    strongest_counterargument:counterargument||"No strong counterargument is currently supported by the recorded evidence.",
    binding_constraint:blockedCheck?.detail||blockedSpecialist?.challenge||null,
    highest_value_missing_fact:missingFact,
    falsification_test:falsification,
    competing_hypotheses:hypotheses,
    evidence_for_current_view:supports.slice(0,8),
    unknowns:unknowns.slice(0,8),
    what_would_change_mind:uniq([
      blockedCheck?.detail,
      openCheck?.detail,
      missingFact,
      ...(content.dependencies||[]).slice(0,2)
    ]).slice(0,5),
    research_commission:policy==="LEARN_FIRST"&&missingFact?{objective:missingFact,boundary:"Acquire only evidence capable of changing the decision; do not make an external commitment.",auto_execution_authorized:false}:null,
    calibration_note:calibrationNote,
    prepared_work_id:work?.id||null,
    prepared_work_kind:content.kind||null
  };
}
export {deliberation};
