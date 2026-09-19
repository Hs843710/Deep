# PIOS — Product and system organization

## Purpose and non-negotiable experience
PIOS is a private Personal Intelligence OS. The user and their evolving Digital Twin are the center of the product. External information is evidence, not the product. The Earth remains at the center of the default command view, with personal state, specialist interpretation, consequence, the next decision, and a guarded action pathway around it.

**Home must answer:** Where am I? Where am I trying to go? What actually changed? What matters to me? What is my next useful move? What can PIOS do without requiring my attention?

The app must never fill the home screen simply because scans produced records. Showing nothing important is a valid result.

## Information architecture

| Workspace | Job | What it displays | What it does not claim |
|---|---|---|---|
| Command Center (default) | One concise personal executive brief | Earth + Twin, active goal, capital firewall, Chief of Staff, current next move | A large list of global news, disconnected module scores or completed autonomous work |
| My Digital Twin | Inspect and correct personal reality | Goals, operating state, resources, capacity, changes, capabilities, guardrails, model controls | That missing data is zero, or that a complete form means a complete life model |
| World Intelligence | Inspect relevant outside evidence | World signals, geography, original source links, selection and attention shielding | That a signal is personally executable merely because it matches an interest |
| Decisions & Futures | Examine alternatives before commitment | Decision, causal rationale, competing options, possible-future comparisons and conditions that change the recommendation | Validated predictions or guaranteed returns; comparative simulation scores are provisional |
| Actions & Outcomes | Move from decision to measured reality | Owned operating opportunities, guarded action graph, approval gates, recorded outcomes and learning | That an AUTO-ELIGIBLE step was actually executed or that a draft was sent |
| Evidence & System | Review provenance and operating health | Changes, module coverage, source/evidence detail, benchmarks and diagnostics | That scanner throughput alone equals intelligence or decision quality |

The primary navigation changes **presentation only**. It must never unmount, clear or replace the authenticated person's data. The original Connect, Run Intelligence and Model & Guardrails controls stay reachable from every workspace. On smaller screens navigation is horizontally scrollable; the Command Center remains the default.

## Cognitive ownership and flow

1. **Authenticated sources / observed state:** Each record belongs to the signed-in user; data permissions and provenance travel with it.
2. **Personal Digital Twin:** Maintain actual goals, resources, relationships, cash/reserves, commitments, skills and operating outcomes. Unknown facts stay unknown.
3. **Personal Consequence:** Determine which external or internal change has a defensible link to this person's goals and actual situation. Irrelevant signals stay quiet.
4. **Executive Council:** Relevant specialist *decision lenses* assess the same Twin; finance/time/evidence can challenge an apparent opportunity. The Chief of Staff reconciles findings. The current lenses are evidence-based software, not licensed advisers or independently operating agent employees.
5. **Cognition / Decision:** Compare hypotheses, constraints, opportunities, timing, uncertainty, opportunity cost and what would change the conclusion. A guardrail cannot be overcome by an aggregate score.
6. **Counterfactual simulation:** Show temporary alternatives for decision support; never overwrite observed state with simulated state. Numeric results require calibration and must not be treated as verified forecasts.
7. **Guarded Action Graph:** Plan internal research and preparation; actual execution must be verified separately. Spending, external messages, bids and consequential commitments require explicit approval.
8. **Outcomes and learning:** Record observed consequences and compare them with earlier predictions so the next reasoning cycle can be corrected.

## Existing implementation responsibilities

- `pios/index.html`, `pios/styles.css`: base shell and current controls.
- `pios/command-navigation.js`, `pios/command-navigation.css`: workspace hierarchy, no data ownership.
- `pios/life-twin-ui.js`, `pios/life-twin-ui.css`: Earth + Twin visual interpretation, specialist brief, simulations and guarded action display.
- `pios/app.js`: core runtime, auth interaction, world scene and strategy UI.
- `pios/twin-ui.js`, `pios/operating-ui.js`, `pios/outcome-ui.js`: personal trajectory, operating records, outcome lifecycle.
- `pios/intelligence-ui.js`, `pios/model-truth-ui.js`, `pios/alignment-ui.js`: explanation, evidence and model truth.
- `supabase/functions/personal-consequence/`: personal relevance and consequence gate.
- `supabase/functions/executive-council/`: cross-specialist analysis and one executive brief.
- `supabase/functions/strategy-brief/`: governing recommendation and guardrail integration.
- `supabase/functions/future-simulator/`: comparative possible states, not actual outcomes.
- `supabase/functions/action-graph/`: dependency/approval plan, not proof of step completion.
- `supabase/functions/operating-strategy-sync/`: linkage between owned opportunities and candidate records.
- `supabase/functions/universal-orchestrate/`: cross-layer intelligence cycle.

## Quality gates

- The Earth and Connect stay present after any home-screen redesign.
- Navigation must preserve access to personal modeling, source evidence, decision comparison, the operating pipeline and outcome entry.
- A source with no personal consequence does not produce a top recommendation solely because of its raw score.
- A quotation is never treated as won revenue; an unverified margin does not meet a profitable-project target.
- A financial guardrail blocks commitment even when a business specialist sees upside.
- Personal state from different accounts must not be mixed.
- One failing secondary endpoint must not erase the whole Twin.
- No claim of autonomous execution is made without an observed completed action.
- Production deployment is gated by JS syntax, person-specific, Executive Council and navigation regression tests.

## Development order from this point

1. Validate the signed-in experience and page layout across desktop/mobile; keep the default command surface focused.
2. Connect AUTO-ELIGIBLE Action Graph steps to real, permissioned read/prepare capabilities, tracking completed versus planned work.
3. Add outcome calibration from actual actions, reducing unsupported numeric confidence.
4. Expand cross-domain coverage based on recorded life state and available permissions, not generic topic popularity.
5. Only add a new panel if it improves the user's state understanding, decision, action or learning.
