
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
export {prepareQuote};
