import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const config=readFileSync("supabase/config.toml","utf8");
const falseConfigured=[...config.matchAll(/\[functions\.([^\]]+)\]\s*\n\s*verify_jwt\s*=\s*false/g)].map(m=>m[1]).sort();

const expectedFalse=[
  "alberta-upcoming-ingest",
  "apc-ingest",
  "award-ingest",
  "benchmark-runner",
  "brief-refresh",
  "career-scheduled",
  "jobbank-ingest",
  "personal-graph-core",
  "prime-directory-ingest",
  "world-ingest"
].sort();

assert.deepEqual(falseConfigured,expectedFalse,
  "verify_jwt=false must remain limited to the reviewed scheduler/dual-auth functions");

for(const slug of falseConfigured){
  const src=readFileSync(`supabase/functions/${slug}/index.ts`,"utf8");
  assert.ok(src.includes("x-pios-cron-token"),slug+" must authenticate its non-JWT caller with the internal scheduler token");
  assert.ok(src.includes("scheduled_intelligence"),slug+" must verify against the stored scheduler secret");
  assert.ok(/unauthorized/i.test(src),slug+" must reject unauthorized requests");
}

const userJwtFunctions=[
  "career-evaluate",
  "demo-scan",
  "deep-investigate",
  "partner-match",
  "executive-council",
  "executive-workbench",
  "evidence-acquirer",
  "universal-orchestrate"
];
for(const slug of userJwtFunctions){
  assert.ok(!falseConfigured.includes(slug),slug+" must retain the Supabase JWT gateway");
}

const graph=readFileSync("supabase/functions/personal-graph-core/index.ts","utf8");
assert.ok(graph.includes("auth(jwt)"),"personal-graph-core must validate user JWTs on its user-authenticated path");
assert.ok(graph.includes("x-pios-cron-token"),"personal-graph-core must separately authenticate its scheduler path");

console.log("PASS Supabase auth policy: JWT-off exceptions are explicit, bounded and internally authenticated");
