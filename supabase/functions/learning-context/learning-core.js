
const n=x=>x===null||x===undefined||x===""||!Number.isFinite(Number(x))?null:Number(x);
function classifyObservation(obs,decision,reason,floor=null){
 const facts=obs?.facts||{},stage=String(facts.stage||""),margin=n(facts.actual_margin_pct),profit=n(facts.actual_gross_profit);
 const executed=["execute","completed"].includes(String(decision?.action||""))||String(decision?.action||"").startsWith("stage_");
 const reasoningLinked=!!reason&&String(reason.id)===String(decision?.reasoning_run_id||"");
 const actualFinancial=margin!==null||profit!==null;
 let goalQualification=null;
 if(margin!==null&&floor!==null)goalQualification=margin>=floor;
 const factualSummary={
   stage:stage||null,contract_value:n(facts.contract_value),actual_direct_cost:n(facts.actual_direct_cost),
   actual_gross_profit:profit,actual_margin_pct:margin,estimator_hours:n(facts.estimator_hours),
   loss_reason:facts.loss_reason||null
 };
 if(!decision)return{state:"observed_unlinked",calibration_ready:false,reason:"Observed operating state is not linked to a recorded decision.",goal_qualification:goalQualification,facts:factualSummary};
 if(!reasoningLinked)return{state:"decision_without_prediction_trace",calibration_ready:false,reason:"A decision exists, but its original reasoning trace is unavailable.",goal_qualification:goalQualification,facts:factualSummary};
 if(!executed)return{state:"pre_execution_observation",calibration_ready:false,reason:"The linked decision did not record execution; project state should not be used to score the recommendation.",goal_qualification:goalQualification,facts:factualSummary};
 if(stage==="won"&&!actualFinancial)return{state:"won_profit_unverified",calibration_ready:false,reason:"Win status is observed, but actual profitability is not yet known.",goal_qualification:null,facts:factualSummary};
 if(stage==="completed"&&actualFinancial)return{state:"calibration_ready",calibration_ready:true,reason:"Execution and actual financial evidence are recorded.",goal_qualification:goalQualification,facts:factualSummary};
 if(stage==="lost")return{state:"calibration_candidate",calibration_ready:true,reason:"Loss state is observed after a linked execution decision; interpretation should consider loss reason and avoided downside.",goal_qualification:false,facts:factualSummary};
 return{state:"outcome_incomplete",calibration_ready:false,reason:"More actual result evidence is required before changing model confidence.",goal_qualification:goalQualification,facts:factualSummary};
}
export {classifyObservation};
