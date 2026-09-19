import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const source=fs.readFileSync("supabase/functions/personal-consequence/value-core.js","utf8").replace(/export\s*\{[^}]*\};/g,"");
const {evaluatePersonalConsequence:evaluate,evaluateAcrossGoals}=vm.runInNewContext(source+"\n({evaluatePersonalConsequence,evaluateAcrossGoals})");
const candidate={id:"11111111-1111-4111-8111-111111111111",title:"Roofing maintenance tender",module_code:"construction",window_end:"2026-10-10T00:00:00Z",eligibility_status:"unknown",capital_required_high:5000,scope_match:{matches:["roofing"],location:"Calgary"}};
const signal={id:"s1",title:"City roofing tender",locality:"Calgary",source_url:"https://example.org/tender"};
const goal={id:"g1",title:"Win projects",domain:"business_growth",current_value:0,target_value:3};
const business=evaluate({profile:{home_region:"Calgary, Alberta"},goal,capabilities:[{name:"roofing"}],candidate,signal});
const employee=evaluate({profile:{home_region:"Calgary, Alberta"},goal:{id:"g2",title:"Career growth",domain:"career_income"},capabilities:[{name:"office administration"}],candidate,signal});
assert.equal(business.status,"investigate","business should investigate a capability-matched active tender");
assert.equal(employee.status,"not_personal","same event must not become a career recommendation for an unrelated person");
assert.equal(employee.surface,false);
const owned=evaluate({profile:{home_region:"Calgary"},goal,contract:{desired_state:{combined_contract_value_target:150000,minimum_gross_margin_pct:25}},candidate:{...candidate,module_code:"business_growth",opportunity_type:"existing_pipeline"},operating:[{id:"o1",candidate_id:candidate.id,stage:"quoted",quoted_value:36813}]});
assert.equal(owned.next_move.type,"QUALIFY_EXISTING");
assert.equal(owned.actual_state_change,false,"quoted is never a win");
assert.equal(owned.possible_effect.counts_as_won,false);
assert.equal(owned.possible_effect.possible_contract_value_share,24.5);
const winUnknown=evaluate({goal,contract:{desired_state:{minimum_gross_margin_pct:25}},candidate:{...candidate,module_code:"business_growth",opportunity_type:"existing_pipeline"},operating:[{id:"o1",candidate_id:candidate.id,stage:"won",contract_value:36813}]});
assert.equal(winUnknown.actual_state_change,true,"won status is factual state");
assert.equal(winUnknown.possible_effect.qualifies_for_goal,false,"unverified margin must not satisfy profitable goal");
const winQualified=evaluate({goal,contract:{desired_state:{minimum_gross_margin_pct:25}},candidate:{...candidate,module_code:"business_growth",opportunity_type:"existing_pipeline"},operating:[{id:"o1",candidate_id:candidate.id,stage:"won",contract_value:36813,estimated_margin_pct:28}]});
assert.equal(winQualified.possible_effect.qualifies_for_goal,true);
const lowMargin=evaluate({goal,contract:{desired_state:{minimum_gross_margin_pct:25}},candidate:{...candidate,scope_match:{...candidate.scope_match,estimated_margin_pct:18}},capabilities:[{name:"roofing"}],signal});
assert.equal(lowMargin.next_move.type,"REPRICE_OR_DECLINE");
const protection=evaluate({goal,candidate:{...candidate,capital_required_high:25000},finance:{cash:40000,emergency_reserve:20000},capabilities:[{name:"roofing"}],signal});
assert.equal(protection.next_move.type,"CHECK_FEASIBILITY");
assert.equal(protection.possible_effect.recorded_deployable,20000);
const stale=evaluate({goal,candidate:{...candidate,window_end:"2025-01-01T00:00:00Z"},capabilities:[{name:"roofing"}]});
assert.equal(stale.status,"expired");
assert.equal(stale.surface,false);
const context=evaluate({profile:{home_region:"Calgary"},goal,candidate,signal});
assert.equal(context.status,"context_only");
assert.equal(context.surface,false);
const noGoal=evaluate({candidate,signal});
assert.equal(noGoal.status,"needs_goal");
assert.equal(noGoal.next_move.type,"ASK_ONE_QUESTION");
const crossGoal=evaluateAcrossGoals({
  profile:{home_region:"Calgary"},
  goals:[{id:"career1",title:"Advance my office career",domain:"career_income"},{...goal,id:"business2"}],
  contracts:[{goal_id:"business2",desired_state:{minimum_gross_margin_pct:25}}],
  capabilities:[{name:"roofing"}],candidate,signal
});
assert.equal(crossGoal.status,"investigate","an opportunity must be considered against secondary active goals");
assert.equal(crossGoal.goal_id,"business2","relevant secondary goal should be selected over unrelated primary goal");
assert.equal(crossGoal.considered_goals[0].goal_id,"business2","multi-goal audit must identify the chosen goal");
assert.equal(crossGoal.considered_goals.length,2);

const unknownMoney=evaluate({goal,candidate,capabilities:[{name:"roofing"}],signal});
assert.equal(unknownMoney.possible_effect.recorded_deployable,null,"missing finance must not become $0");
console.log("PASS 12 personal-consequence tests: individual difference, owned quote, progress integrity, margin, reserve, deadline, context, no goal, unknown finance");
