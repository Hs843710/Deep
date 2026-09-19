
/* PIOS personal consequence: pure and domain-neutral. Facts, possibilities and unknowns remain distinct. */
const DOMAIN_LINKS={
 business_growth:["business_growth","construction","procurement","grants_funding","cost_savings"],
 construction:["construction","procurement","business_growth"],career_income:["career_income","education_skills"],
 education_skills:["education_skills","career_income"],investing:["investing","real_estate","cost_savings"],
 real_estate:["real_estate","cost_savings"],cost_savings:["cost_savings","business_growth"],
 grants_funding:["grants_funding","business_growth"]
};
const finite=x=>(x===null||x===undefined||x===""||!Number.isFinite(Number(x)))?null:Number(x);
const words=x=>String(x??"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const time=x=>{const v=x?Date.parse(x):NaN;return Number.isFinite(v)?v:null};
const matchCaps=(caps,c)=>{
 const terms=Array.isArray(c?.scope_match?.matches)?c.scope_match.matches:[];
 const hay=" "+words([c?.title,c?.scope_match?.service_type,...terms].filter(Boolean).join(" "))+" ";
 return (caps||[]).filter(x=>{const name=words(x.name);return name.length>=4&&hay.includes(" "+name+" ")}).map(x=>x.name).slice(0,4);
};
function evaluatePersonalConsequence({profile={},goal=null,contract=null,capabilities=[],finance=null,operating=[],candidate=null,signal=null,now="2026-09-19T00:00:00Z"}={}){
 const empty={version:"personal_consequence_v1",status:"unknown",surface:false,pathway:"UNKNOWN_TO_LEARN",why_you:[],not_known:[],evidence:[],next_move:null,actual_state_change:false};
 if(!goal)return {...empty,status:"needs_goal",not_known:["No active desired future recorded."],next_move:{type:"ASK_ONE_QUESTION",question:"What outcome should PIOS help you change first?"}};
 const current=finite(goal.current_value),target=finite(goal.target_value),remaining=current!==null&&target!==null?Math.max(0,target-current):null;
 const goalState={title:goal.title||"",domain:goal.domain||"general",current,target,unit:goal.target_unit||null,remaining,deadline:goal.target_date||null};
 if(!candidate)return {...empty,status:"no_material_change",goal:goalState,not_known:["No current event or operating change is linked to this goal."],next_move:{type:"OBSERVE",detail:"Update the Twin without inventing a recommendation."}};
 const module=String(candidate.module_code||""),owned=(operating||[]).find(x=>x.candidate_id===candidate.id)||null,ownedSignal=!!owned||candidate.opportunity_type==="existing_pipeline";
 const links=[],unknowns=[],evidence=[];
 const related=goal.domain===module||(DOMAIN_LINKS[goal.domain]||[]).includes(module);
 if(related)links.push({node:"goal",kind:"goal_fit",fact:"This relates to your active "+String(goal.domain).replaceAll("_"," ")+" goal.",source:"goal:"+goal.id});
 if(ownedSignal){
   links.push({node:"projects",kind:"owned_state",fact:owned?"Already recorded in your operating pipeline.":"Labeled existing pipeline, but source linkage is unverified.",source:owned?"operating:"+owned.id:"candidate:"+candidate.id});
   if(owned)evidence.push({type:"observed_internal",ref:"operating:"+owned.id});
 }
 const capabilityMatches=matchCaps(capabilities,candidate);
 if(capabilityMatches.length)links.push({node:"capabilities",kind:"recorded_capability",fact:"Recorded capability: "+capabilityMatches.join(", ")+".",source:"capabilities"});
 const home=words(profile.home_region).split(" ")[0],place=" "+words([signal?.locality,signal?.region,candidate?.scope_match?.location,candidate?.scope_match?.city].filter(Boolean).join(" "))+" ";
 if(home.length>=4&&place.includes(" "+home+" "))links.push({node:"location",kind:"geography",fact:"Located in your recorded home region.",source:"profile:home_region"});
 const linkedSource=!!(signal?.source_url&&signal?.title);
 if(linkedSource)evidence.push({type:"linked_external_record",ref:"signal:"+signal.id,url:signal.source_url,observed_at:signal.published_at||signal.ingested_at||null});
 else if(!owned)unknowns.push("Original source evidence for the external opportunity is not linked; verify before acting.");
 const deadline=time(candidate.window_end||signal?.deadline_at),asof=time(now)||Date.now();
 if(deadline!==null&&deadline<asof)return {...empty,status:"expired",goal:goalState,why_you:links,evidence,not_known:["Recorded deadline passed; official extension unknown."],next_move:{type:"VERIFY_REOPENING",detail:"Verify an official extension before investing time."}};
 if(!related&&!owned)return {...empty,status:"not_personal",goal:goalState,why_you:links,evidence,not_known:["No documented link to the active goal or owned state."],next_move:null};
 const direct=!!owned||capabilityMatches.length>0;
 if(!direct)unknowns.push("Direct capability, relationship or resource fit is not established.");
 const cash=finite(finance?.cash),deployable=cash===null?null:Math.max(0,cash-["taxes_reserved","payroll_reserved","emergency_reserve","operating_reserve"].reduce((a,k)=>a+(finite(finance[k])||0),0));
 const required=finite(candidate.capital_required_high??candidate.capital_required_low);
 if(required!==null&&deployable!==null&&required>deployable)unknowns.push("Known capital requirement exceeds recorded deployable capital.");
 else if(required===null)unknowns.push("Capital exposure is unknown.");
 const quoted=finite(owned?.contract_value??owned?.quoted_value??candidate?.scope_match?.quoted_value),won=!!owned&&["won","active","completed"].includes(owned.stage);
 const margin=finite(owned?.estimated_margin_pct??candidate?.scope_match?.estimated_margin_pct),floor=finite(contract?.desired_state?.minimum_gross_margin_pct);
 const qualifyingWin=won&&(floor===null||(margin!==null&&margin>=floor));
 if(floor!==null&&margin===null)unknowns.push(won?"Project is marked won, but profitability is unverified; it does not yet qualify toward the profitable-project target.":"Margin is unknown; minimum margin cannot be checked.");
 if(floor!==null&&margin!==null&&margin<floor)unknowns.push("Estimated margin is below the recorded minimum.");
 if(!ownedSignal&&!["verified","eligible"].includes(candidate.eligibility_status))unknowns.push("Mandatory eligibility and capacity remain unverified.");
 let move=owned&&!won?{type:"QUALIFY_EXISTING",detail:"Check customer decision status and verify margin before committing further resources.",requires_approval_before_external_contact:true}:
 won?{type:"MEASURE_OUTCOME",detail:"Record verified contract value, cost, and result; update goal progress.",requires_approval_before_external_contact:false}:
 !direct?{type:"VERIFY_PERSONAL_FIT",detail:"Check whether you have the required capability, resource or relationship.",requires_approval_before_external_contact:false}:
 {type:"VERIFY_BEFORE_COMMIT",detail:"Verify eligibility, scope, margin, capacity and capital exposure before estimating or committing.",requires_approval_before_external_contact:true};
 if(required!==null&&deployable!==null&&required>deployable)move={type:"CHECK_FEASIBILITY",detail:"Respect protected reserves: seek an acceptable partner/financing option or decline.",requires_approval_before_external_contact:true};
 if(floor!==null&&margin!==null&&margin<floor)move={type:"REPRICE_OR_DECLINE",detail:"Reprice or decline; modeled margin fails your minimum.",requires_approval_before_external_contact:true};
 const status=links.length<2?"needs_personal_evidence":!direct?"context_only":unknowns.length?"investigate":"potential_next_step";
 const valueTarget=finite(contract?.desired_state?.combined_contract_value_target);
 return {version:"personal_consequence_v1",status,surface:["investigate","potential_next_step"].includes(status),
  pathway:ownedSignal?"YOU_TO_WORLD":status==="context_only"?"UNKNOWN_TO_LEARN":"WORLD_TO_YOU",
  goal:goalState,why_you:links,evidence,actual_state_change:won,
  possible_effect:{contract_value:quoted,counts_as_won:won,qualifies_for_goal:qualifyingWin,goal_remaining:remaining,unverified_opportunity:!won,
   possible_contract_value_share:valueTarget&&quoted?Number((quoted/valueTarget*100).toFixed(1)):null,
   estimated_margin:margin,minimum_margin:floor,capital_required:required,recorded_deployable:deployable,
   deadline:deadline===null?null:new Date(deadline).toISOString()},
  not_known:unknowns,next_move:move,missing_single_question:status==="needs_personal_evidence"?"What direct role or resource links this event to your goal?":null};
}
function evaluateAcrossGoals({goals=[],contracts=[],...state}={}){
 if(!goals.length)return evaluatePersonalConsequence({...state,goal:null});
 const results=goals.slice(0,20).map((goal,index)=>{
  const contract=contracts.find(x=>x?.goal_id===goal.id)||null;
  return {priority_index:index,...evaluatePersonalConsequence({...state,goal,contract})};
 });
 const order={potential_next_step:6,investigate:5,context_only:3,needs_personal_evidence:2,no_material_change:1,expired:1,not_personal:0,needs_goal:0,unknown:0};
 results.sort((a,b)=>(order[b.status]??0)-(order[a.status]??0)||a.priority_index-b.priority_index);
 const selected=results[0];
 return {...selected,considered_goals:results.map(x=>({goal_id:x.goal?.id||null,status:x.status,surface:x.surface})),
   version:"personal_consequence_v2_multi_goal"};
}
export {evaluatePersonalConsequence,evaluateAcrossGoals};
