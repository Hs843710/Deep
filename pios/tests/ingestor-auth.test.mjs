import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const guarded=["world-ingest","award-ingest","prime-directory-ingest","alberta-upcoming-ingest","apc-ingest","jobbank-ingest"];
for(const slug of guarded){
  const src=readFileSync(`supabase/functions/${slug}/index.ts`,"utf8");
  assert.ok(src.includes("x-pios-cron-token"),slug+" must read the internal scheduling header");
  assert.ok(src.includes("scheduled_intelligence"),slug+" must verify against the internal scheduling secret");
  assert.ok(src.includes("piosAuthorized"),slug+" must reject unguarded requests");
  assert.ok(src.includes("unauthorized"),slug+" must return an unauthorized result for a bad token");
}
console.log("PASS source ingestion auth: all service-role writers require the internal cron token");
