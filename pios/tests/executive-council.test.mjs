
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
const src=readFileSync("supabase/functions/executive-council/council-core.js","utf8").replace(/export\s*\{[^}]*\};/g,"");
const build=runInNewContext(src+";buildCouncil;");
const goal={id:"g1",title:"Win three profitable projects",domain:"business_growth",current_value:0,target_value:3,target_unit:"projects",status:"active"};
const candidate={id:"c1",title:"Existing customer quote",module_code:"business_growth",opportunity_type:"existing_pipeline",eligibility_status:"unknown",capital_required_high:1000};
const op={id:"o1",candidate_id:"c1",stage:"quoted",quoted_value:36813,estimated_margin_pct:null};
const personal={goal_id:"g1",status:"investigate",surface:true,why_you:[{node:"goal"},{node:"projects"}],not_known:["Estimated margin unknown"],next_move:{type:"QUALIFY_EXISTING",detail:"Verify quote status",requires_approval_before_external_contact:true},evidence:[{type:"observed_internal",ref:"operating:o1"}]};
const base={goals:[goal],contracts:[{id:"gc",goal_id:"g1",desired_state:{minimum_gross_margin_pct:25}}],candidate,
  operating:[op],profile:{attention_budget_minutes:30,preferred_currency:"CAD"},personalValue:personal,
  finance:{cash:100000,taxes_reserved:10000,payroll_reserved:5000,emergency_reserve:20000,operating_reserve:25000,currency:"CAD",captured_at:"2026-09-17T00:00:00Z"},
  now:"2026-09-19T00:00:00Z"};
const missingMargin=build(base);
assert.equal(missingMargin.mode,"brief");
assert.equal(missingMargin.chief_of_staff.next_move.title,"Verify project economics");
assert.ok(missingMargin.chief_of_staff.conflicts.some(x=>x.between.includes("finance")));
assert.equal(missingMargin.auto_work_executed,false);
assert.ok(missingMargin.specialists.find(x=>x.id==="business").facts.every(x=>x.source));
const cashViolation=build({...base,finance:{...base.finance,cash:10000}});
assert.equal(cashViolation.mode,"blocked");
assert.equal(cashViolation.chief_of_staff.escalation,"guardrail");
const lowMargin=build({...base,operating:[{...op,estimated_margin_pct:18}]});
assert.equal(lowMargin.mode,"blocked");
const irrelevant=build({...base,personalValue:{status:"not_personal",surface:false}});
assert.equal(irrelevant.mode,"quiet");
assert.equal(irrelevant.chief_of_staff.interruption_warranted,false);
assert.equal(irrelevant.chief_of_staff.next_move,null);
const noGoal=build({...base,goals:[],personalValue:null});
assert.equal(noGoal.mode,"needs_goal");
assert.equal(noGoal.chief_of_staff.next_move.kind,"clarify");
const clear=build({...base,operating:[{...op,estimated_margin_pct:30}]});
assert.equal(clear.chief_of_staff.next_move.detail,"Verify quote status");
assert.ok(clear.chief_of_staff.next_move.approval_required);
const noTime=build({...base,profile:{},operating:[op],finance:null});
assert.ok(noTime.specialists.find(x=>x.id==="time").headline.includes("empty calendar"));
const recordedLate=build({...base,personalValue:null,candidate:null,
  commitments:[{due_at:"2026-09-16T18:00:00Z",status:"waiting"}]});
assert.equal(recordedLate.mode,"brief","recorded overdue commitments should be evaluated without a world signal");
assert.equal(recordedLate.chief_of_staff.escalation,"commitment");
const unrelatedCareer=build({...base,goals:[{id:"career",domain:"career_income",title:"Build skills",status:"active"}],personalValue:null,candidate:null});
assert.ok(unrelatedCareer.specialists.some(x=>x.id==="career"),"relevant career adviser should exist");
assert.equal(unrelatedCareer.chief_of_staff.interruption_warranted,false);
const property=build({...base,goals:[{id:"prop",domain:"real_estate",title:"Maintain property",status:"active"}],personalValue:null,candidate:null});
assert.ok(property.specialists.some(x=>x.id==="property"),"real estate goals should activate a property adviser");

console.log("PASS 10 executive-council tests: economics conflict, capital guard, margin guard, quiet relevance, missing goal, approval boundary, unknown capacity");
