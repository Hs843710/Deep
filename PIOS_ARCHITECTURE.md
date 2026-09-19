# PIOS — Architecture Contract

## Product identity

PIOS is a Personal Intelligence OS and evolving Digital Twin of the user's life. It is not primarily a news feed, dashboard, CRM, procurement scanner, or data warehouse.

Core loop:

PERSONAL DIGITAL TWIN
→ WORLD / INTERNAL OBSERVATION
→ CAUSAL & COGNITIVE MODEL
→ DECISION
→ ACTION
→ OUTCOME
→ CALIBRATION & LEARNING
→ UPDATED DIGITAL TWIN

Tagline: **World change → personal consequence → best next move.**

## Non-negotiable principles

1. **YOU is the center.** External information is peripheral input. A world signal should not dominate UI unless it changes the user's state, opportunity set, risk, trajectory, or required action.
2. **Data is not intelligence.** Collecting more records is useful only when it improves state estimation, causal understanding, decision quality, or learning.
3. **Scores are subordinate to reasoning.** Raw opportunity scores may be overridden by contradictions, critical unknowns, causal mechanism, reversibility, expected value, opportunity cost, and counterfactual analysis.
4. **PIOS must be able to change its mind.** Every important recommendation should expose the evidence or condition that would reverse it.
5. **Facts and inference stay separate.** Observed state, inferred state, assumptions, and hypotheses must have distinct provenance/confidence.
6. **Prefer the smallest reversible high-information step under uncertainty.** Irreversible or costly actions require stronger evidence and guardrail checks.
7. **The Digital Twin is living state, not a profile.** Goals, capital, projects, customers, commitments, capabilities, assets, relationships, capacity, risks, and current operating state should evolve from connected evidence where possible.
8. **Outcomes audit reasoning.** Decisions retain reasoning provenance. Real outcomes should calibrate success probabilities, expected value, assumptions, and future strategy.
9. **No fake certainty.** Missing operating history, unknown margin, unverified eligibility, or absent commitments must be shown as unknown rather than filled with guesses.
10. **Text is secondary.** The default product surface should communicate state, relationships, trajectories, bottlenecks, uncertainty and actions visually. Detailed prose is on demand.

## Intellectual stack

### 1. State model
Maintains the Digital Twin and separates:
- observed facts
- inferred state
- assumptions
- unknowns
- confidence
- provenance/freshness

### 2. Causal model
For each material option:
- mechanism
- causal chain
- failure modes
- dependencies
- constraints
- likely personal consequences

### 3. Cognitive engine
Evaluates:
- success probability
- expected value
- information value
- reversibility
- urgency
- opportunity cost
- goal contribution
- contradictions
- decision-sensitive unknowns

### 4. Meta-reasoning
Must produce:
- thesis
- competing hypotheses
- disconfirming tests
- counterfactual paths
- robustness
- explicit “what would change my mind” conditions

### 5. Decision policy
Three proactive pathways remain:
- WORLD → YOU
- YOU → WORLD
- UNKNOWN → LEARN

DO_NOTHING is valid only when all three fail to produce a worthwhile move.

### 6. Action & outcome loop
A recommendation becomes:
decision → bounded action → lifecycle → real outcome → calibration review → policy update.

## Decision quality hierarchy

1. Hard guardrails / eligibility
2. Contradictions
3. Decision-sensitive unknowns
4. Causal executability
5. Expected goal contribution / economics
6. Opportunity cost and capacity
7. Reversibility and information value
8. Evidence confidence
9. Raw candidate score

A high score never overrides a higher-ranked layer.

## Digital Twin UI

Default center view should answer within seconds:
- Where am I now?
- Where am I trying to go?
- What changed?
- What is constraining progress?
- What are my resources/capacity?
- What does PIOS currently believe?
- How robust is that belief?
- What should happen next?

World/news views are secondary.

## Learning requirements

Preference weights alone are insufficient. PIOS should learn:
- prediction calibration
- assumption failures
- qualification failures
- pricing/margin errors
- execution errors
- source quality
- estimator/time prediction error
- causal model errors

The goal is not to reinforce previous selections. The goal is to become better calibrated and better at deciding.

## Anti-drift test

Before adding a feature, ask:

**Does this improve state estimation, causal reasoning, decision quality, execution, outcome measurement, or learning?**

If no, it should not become a primary PIOS feature.
