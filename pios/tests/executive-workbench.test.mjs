
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
const source=readFileSync("supabase/functions/executive-workbench/workbench-core.js","utf8").replace(/export\s*\{[^}]*\};/g,"");
const {prepareQuote:prepare,prepareCandidateQualification:prepareCandidate,prepareEstimateWorkspace:prepareEstimate}=runInNewContext(source+";({prepareQuote,prepareCandidateQualification,prepareEstimateWorkspace});");
const record={id:"11111111-1111-4111-8111-111111111111",title:"Northwest egress windows",customer:"Example property manager",
 stage:"quoted",quoted_value:36813,updated_at:"2026-09-18T10:00:00Z",estimated_direct_cost:null,estimated_margin_pct:null};
const w=prepare(record,{desired_state:{minimum_gross_margin_pct:25}},"2026-09-19T00:00:00Z");
assert.equal(w.action_status.preparation,"completed");
assert.equal(w.action_status.external_contact,"not_performed");
assert.equal(w.draft.external_message_sent,false);
assert.equal(w.draft.ready_to_send,false);
assert.equal(w.draft.recipient,null);
assert.equal(w.profit_qualification.verified_actual_profit,false);
assert.equal(w.profit_qualification.passes_recorded_floor,null);
assert.ok(w.internal_checks.some(x=>x.state==="needs_data"));
assert.ok(w.draft.body.includes("Could you confirm"));
assert.ok(!w.draft.body.includes("accepted"));
assert.equal(w.evidence.find(x=>x.field==="quoted_value").value,36813);
const cheap=prepare({...record,estimated_direct_cost:32000},{desired_state:{minimum_gross_margin_pct:25}});
assert.equal(cheap.internal_checks[1].state,"below_floor");
assert.equal(cheap.profit_qualification.passes_recorded_floor,false);
const adequate=prepare({...record,estimated_direct_cost:26000},{desired_state:{minimum_gross_margin_pct:25}});
assert.equal(adequate.profit_qualification.passes_recorded_floor,true);
assert.throws(()=>prepare({...record,stage:"won"}),/quoted stage/);
assert.throws(()=>prepare({...record,updated_at:null}),/timestamp/);
const special=prepare({...record,title:"  <img src=x onerror=alert(1)>  "});
assert.ok(special.draft.subject.includes("<img"),"Data stays literal; the presentation must use textContent");
const candidate={id:"22222222-2222-4222-8222-222222222222",title:"Kananaskis Residences - Exterior Renewal",
 updated_at:"2026-10-01T18:43:16Z",status:"watch",eligibility_status:"open",module_code:"construction",
 capital_required_high:null,time_required_hours:null,scope_match:{matches:["siding/cladding","exterior envelope"]}};
const signal={id:"33333333-3333-4333-8333-333333333333",organization:"Infrastructure",source_url:"https://purchasing.alberta.ca/opportunity/2026/6600",
 deadline_at:"2026-10-29T14:00:00Z",summary:"Asbestos and lead paint abatement, exterior wall cladding, fibre cement cladding and electrical garage door opener work.",
 verified_facts:["Present in authoritative public opportunity API."],raw_payload:{bidSecurity:"Not Applicable"}};
const pack=prepareCandidate(candidate,signal,[{name:"siding/cladding"},{name:"exterior envelope"}],
 {cash:100000,taxes_reserved:10000,payroll_reserved:5000,emergency_reserve:20000,operating_reserve:25000},
 {desired_state:{minimum_gross_margin_pct:25}},"2026-10-01T23:00:00Z");
assert.equal(pack.action_status.preparation,"completed");
assert.equal(pack.action_status.external_contact,"not_performed");
assert.equal(pack.action_status.bid_submitted,false);
assert.equal(pack.action_status.source_documents_retrieved,false);
assert.equal(pack.recommendation.state,"verify_before_estimate");
assert.equal(pack.economics.profitability_verified,false);
assert.ok(pack.dependencies.some(x=>x.includes("Hazardous-material")));
assert.ok(pack.dependencies.some(x=>x.includes("Electrical/garage-door")));
assert.ok(pack.qualification_checks.some(x=>x.label==="Source record"&&x.state==="linked"));
assert.ok(pack.qualification_checks.some(x=>x.label==="Capability fit"&&x.state==="partial_match"),"siding/cladding must match Siding and cladding");
assert.ok(pack.qualification_checks.some(x=>x.label==="Profitability"&&x.state==="needs_pricing"));
const capitalBlocked=prepareCandidate({...candidate,capital_required_high:50000},signal,[{name:"siding/cladding"}],
 {cash:40000,taxes_reserved:0,payroll_reserved:0,emergency_reserve:20000,operating_reserve:5000},
 {desired_state:{minimum_gross_margin_pct:25}},"2026-10-01T23:00:00Z");
assert.equal(capitalBlocked.recommendation.state,"blocked");
assert.equal(capitalBlocked.qualification_checks.find(x=>x.label==="Capital").state,"blocked");
const expired=prepareCandidate(candidate,{...signal,deadline_at:"2026-09-30T14:00:00Z"},[{name:"siding/cladding"}],null,null,"2026-10-01T23:00:00Z");
assert.equal(expired.recommendation.state,"blocked");
assert.equal(expired.qualification_checks.find(x=>x.label==="Deadline").state,"expired");
const estimate=prepareEstimate(candidate,signal,[{name:"Siding and cladding"},{name:"Construction estimating"}],{desired_state:{minimum_gross_margin_pct:25}},pack,{unresolved:[{topic:"tender_documents",reason:"Tender drawings have not been retrieved.",decision_sensitive:true}]},"2026-10-01T23:00:00Z");
assert.equal(estimate.action_status.preparation,"completed");
assert.equal(estimate.action_status.estimate_completed,false);
assert.equal(estimate.action_status.external_contact,"not_performed");
assert.equal(estimate.pricing.minimum_gross_margin_pct,25);
assert.equal(estimate.pricing.quoted_price,null);
assert.ok(estimate.line_items.some(x=>x.code==="cladding"&&x.quantity===null&&x.total_cost===null));
assert.ok(estimate.line_items.some(x=>x.code==="abatement"&&x.bucket==="specialist_partner"));
assert.ok(estimate.line_items.some(x=>x.code==="electrical"&&x.bucket==="specialist_partner"));
assert.ok(estimate.unknowns.some(x=>x.includes("drawings")));
assert.match(estimate.truth_boundary,/not a completed estimate or bid/i);
console.log("PASS executive workbench: quote follow-up + candidate qualification + estimate workspace, evidence gaps preserved, no fabricated pricing or external execution");
