import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CANADABUYS_OPEN = "https://canadabuys.canada.ca/opendata/pub/openTenderNotice-ouvertAvisAppelOffres.csv";
const CALGARY_PERMITS = "https://data.calgary.ca/resource/c2es-76ed.json?$limit=5000";
const MIN_INTERVAL_MS = 90 * 60 * 1000;

function reply(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}
function norm(v: unknown) { return String(v ?? "").trim(); }
function low(v: unknown) { return norm(v).toLowerCase(); }
function parseCSV(text: string): Record<string, string>[] {
  const rows: string[][] = []; let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') { if (quoted && text[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted; }
    else if (ch === ',' && !quoted) { row.push(cell); cell = ""; }
    else if ((ch === '\n' || ch === '\r') && !quoted) { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); if (row.some((x) => x.length)) rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  if (rows.length < 2) return [];
  const headers = rows.shift()!.map((x) => x.replace(/^\uFEFF/, "").trim());
  return rows.map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ""])));
}
function pick(row: Record<string, unknown>, exact: string[], fuzzy: string[] = []) {
  for (const key of exact) if (norm(row[key])) return norm(row[key]);
  for (const fragment of fuzzy) { const key = Object.keys(row).find((x) => low(x).includes(fragment.toLowerCase())); if (key && norm(row[key])) return norm(row[key]); }
  return "";
}
function iso(v: string) { if (!v) return null; const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d.toISOString(); }
async function db(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers || {}); headers.set("apikey", SERVICE_KEY); headers.set("Authorization", `Bearer ${SERVICE_KEY}`);
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...options, headers }); const text = await res.text();
  if (!res.ok) throw new Error(`DB ${res.status}: ${text.slice(0, 700)}`); return text ? JSON.parse(text) : null;
}
async function source(code: string) {
  const rows = await db(`world_sources?code=eq.${encodeURIComponent(code)}&select=id,code,last_success_at`); return rows?.[0] ?? null;
}
async function patchSource(id: string, patch: Record<string, unknown>) {
  await db(`world_sources?id=eq.${id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(patch) });
}
async function upsertSignal(sourceId: string, body: Record<string, unknown>) {
  await db("signals?on_conflict=source_id,external_id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify([{ source_id: sourceId, ...body }]) });
}
function recent(ts: string | null | undefined) { return ts ? Date.now() - new Date(ts).getTime() < MIN_INTERVAL_MS : false; }


async function piosCronSecret(){const r=await fetch(`${SUPABASE_URL}/rest/v1/system_secrets?name=eq.scheduled_intelligence&select=secret`,{headers:{apikey:SERVICE_KEY,Authorization:`Bearer ${SERVICE_KEY}`}});if(!r.ok)return "";const a=await r.json();return a?.[0]?.secret||""}
function piosSafe(a:string,b:string){if(!a||!b||a.length!==b.length)return false;let x=0;for(let i=0;i<a.length;i++)x|=a.charCodeAt(i)^b.charCodeAt(i);return x===0}
async function piosAuthorized(req:Request){return piosSafe(req.headers.get("x-pios-cron-token")||"",await piosCronSecret())}

Deno.serve(async (req) => {
  if (req.method !== "POST") return reply({ error: "POST required" }, 405);
  if(!(await piosAuthorized(req)))return reply({error:"unauthorized"},401);
  const cb = await source("canadabuys_open"); const cp = await source("calgary_building_permits");
  if (recent(cb?.last_success_at) && recent(cp?.last_success_at)) return reply({ ok: true, skipped: true, reason: "world memory is already fresh" }, 202);

  const result: Record<string, unknown> = { started_at: new Date().toISOString(), sources: {} };
  if (cb && !recent(cb.last_success_at)) {
    try {
      const res = await fetch(CANADABUYS_OPEN, { headers: { "User-Agent": "Personal-Intelligence-OS/1.0" } }); if (!res.ok) throw new Error(`CanadaBuys ${res.status}`);
      const rows = parseCSV(await res.text()); let kept = 0;
      for (const row of rows) {
        const category = pick(row, ["procurementCategory-categorieApprovisionnement"], ["procurementcategory"]);
        const title = pick(row, ["title-titre-eng"], ["title-titre-eng", "title"]);
        const description = pick(row, ["tenderDescription-descriptionAppelOffres-eng"], ["description"]);
        const organization = pick(row, ["organizationName-nomOrganisation-eng"], ["organizationname", "organisation"]);
        const region = pick(row, ["provinceTerritoryDelivery-livraisonProvinceTerritoire-eng"], ["province", "delivery"]);
        const externalId = pick(row, ["tenderReferenceNumber-appelOffresNumero", "solicitationNumber-numeroSollicitation"], ["referencenumber", "solicitationnumber"]);
        const sourceUrl = pick(row, ["tenderNoticeURL-URLAvisAppelOffres-eng"], ["noticeurl", "urlavis", "tendernoticeurl"]);
        const published = pick(row, ["publicationDate-datePublication"], ["publicationdate"]);
        const closing = pick(row, ["closingDate-dateCloture"], ["closingdate", "datecloture"]);
        const text = `${title} ${description} ${organization} ${region} ${category}`;
        const isConstruction = category.toUpperCase().includes("CNST") || /construction|concrete|civil|building|demolition|foundation|renovation|excavat|infrastructure|road|utility|water/i.test(text);
        if (!isConstruction || !title || !externalId) continue;
        await upsertSignal(cb.id, { external_id: externalId, signal_type: "procurement_tender", title, summary: description || null, organization: organization || null, region: region || null, published_at: iso(published), deadline_at: iso(closing), source_url: sourceUrl || "https://canadabuys.canada.ca/en/tender-opportunities", verified_facts: ["Present in the authoritative CanadaBuys open-tender feed.", category ? `Published procurement category: ${category}.` : null, closing ? `Published closing date: ${closing}.` : null].filter(Boolean), raw_payload: row });
        kept++; if (kept >= 750) break;
      }
      await patchSource(cb.id, { last_success_at: new Date().toISOString(), last_error: null }); (result.sources as any).canadabuys = { scanned: rows.length, stored_or_updated: kept };
    } catch (e) { await patchSource(cb.id, { last_error: String(e).slice(0, 500) }); (result.sources as any).canadabuys = { error: String(e) }; }
  }
  if (cp && !recent(cp.last_success_at)) {
    try {
      const res = await fetch(CALGARY_PERMITS, { headers: { "User-Agent": "Personal-Intelligence-OS/1.0" } }); if (!res.ok) throw new Error(`Calgary permits ${res.status}`);
      const rows = await res.json(); if (!Array.isArray(rows)) throw new Error("Unexpected permit payload");
      const keywords = ["concrete","foundation","basement","secondary suite","window","renovation","alteration","addition","excavation","demolition"];
      const relevant = rows.filter((r: any) => { const text = Object.values(r || {}).join(" ").toLowerCase(); return keywords.some((k) => text.includes(k)); });
      const today = new Date().toISOString().slice(0, 10);
      await upsertSignal(cp.id, { external_id: `calgary-permit-demand-${today}`, signal_type: "local_demand_cluster", title: "Calgary construction permit demand cluster", summary: `${relevant.length} of ${rows.length} recent permit records matched core construction-demand keywords.`, organization: "City of Calgary", region: "Calgary, Alberta, Canada", published_at: new Date().toISOString(), source_url: "https://data.calgary.ca/Business-and-Economic-Activity/Building-Permits/c2es-76ed", verified_facts: [`Reviewed ${rows.length} recent permit records.`, `${relevant.length} matched the shared construction-demand keyword set.`], raw_payload: { reviewed_count: rows.length, relevant_count: relevant.length, sample: relevant.slice(0, 30) } });
      await patchSource(cp.id, { last_success_at: new Date().toISOString(), last_error: null }); (result.sources as any).calgary_permits = { scanned: rows.length, relevant: relevant.length };
    } catch (e) { await patchSource(cp.id, { last_error: String(e).slice(0, 500) }); (result.sources as any).calgary_permits = { error: String(e) }; }
  }
  result.completed_at = new Date().toISOString(); return reply(result);
});
