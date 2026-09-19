
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const page=readFileSync("pios/index.html","utf8");
const presence=readFileSync("pios/presence-ui.js","utf8");
const style=readFileSync("pios/command-navigation.css","utf8");
const twin=readFileSync("pios/life-twin-ui.js","utf8");
const orch=readFileSync("supabase/functions/universal-orchestrate/index.ts","utf8");
const workbench=readFileSync("supabase/functions/executive-workbench/index.ts","utf8");
for(const src of ["presence-ui.js","presence-ui.css"])assert.ok(page.includes(src),"presence asset must be included in production");
for(const id of ["globeWrap","globe","authBtn","refreshBtn","settingsBtn"])assert.ok(page.includes('id="'+id+'"'),"original core control missing: "+id);
for(const id of ["presenceNeed","presencePrepared","presenceQuiet","presenceChecked"])
 assert.ok(presence.includes('id="'+id+'"'),"home presence section missing: "+id);
assert.ok(style.includes('body[data-pios-view="command"] .right-rail{display:none}'),"dashboard should not overpower home");
assert.ok(style.includes('.world-stage{grid-column:2'),"Earth must dominate the command layout");
assert.ok(twin.includes("window.updatePiosPresence"),"twin updates must feed the executive presence");
assert.ok(orch.includes("callFn('executive-workbench'"),"the intelligence cycle must perform bounded internal preparation");
assert.ok(workbench.includes('operation!=="prepare_quote"'),"workbench must reject unsupported operations");
assert.ok(workbench.includes('stage=eq.quoted'),"only owned quoted work may be prepared");
assert.ok(workbench.includes("external_action_performed:false"),"preparation must never claim external action");
assert.ok(presence.includes("w?.is_current"),"stale prepared artifacts cannot be marked current");
assert.ok(presence.includes("external_message_sent"),"draft state must keep external contact distinguishable");
assert.ok(presence.includes("Prepare quotation follow-up"),"a relevant person can trigger internal preparation directly");
assert.ok(presence.includes("result?.prepared&&currentWork()"),"the interface cannot claim completed work until it reloads the stored artifact");
assert.ok(presence.includes("does not establish a continuous watch"),"no unconfigured always-on monitoring claims");
console.log("PASS ambient executive presence: core Earth/Connect preserved, honest work status, guarded preparation and focused home");
