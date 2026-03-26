# EvalKit — Customer Service AI Evaluator

**Live demo:** https://evalkit-eta.vercel.app

A browser-based tool for evaluating and comparing customer service response quality using Claude as the scoring engine. Built to demonstrate real-world LLM evaluation patterns grounded in enterprise support experience.

---

## The problem this solves

Support teams handling thousands of tickets a month cannot manually QA every conversation. Human reviewers are inconsistent — scoring varies by reviewer, time of day, and familiarity with the agent. EvalKit applies a consistent, structured rubric to any support interaction using Claude as the evaluator, making quality assessment scalable and repeatable.

This pattern — using an LLM to evaluate LLM or human output — is increasingly standard in production AI systems. EvalKit is a working proof-of-concept of that pattern, built on real support scenarios.

---

## What it does

### Tab 1 — Single Evaluation
Paste any customer service conversation. EvalKit sends it to the Anthropic API with a structured scoring prompt and returns scores across five dimensions with reasoning and an overall assessment.

### Tab 2 — Human vs AI Comparison
Paste a customer context, a human agent response, and an AI-generated response. EvalKit scores both side by side and returns a winner verdict with per-dimension reasoning.

---

## Evaluation dimensions

| Dimension | What it measures |
|-----------|-----------------|
| Accuracy | Correctness of the information provided |
| Tone & Empathy | Warmth, professionalism, emotional awareness |
| Hallucination Risk | Likelihood of fabricated or unsupported claims |
| Conciseness | Clarity and brevity without losing substance |
| Resolution Quality | How effectively the issue was resolved |

Scores are 0–10. For Hallucination Risk, the displayed score is inverted (10 = clean, 0 = high risk) so higher is always better across all dimensions.

---

## Sample scenarios

All three samples are grounded in real Twilio support patterns:

**Voice Call Dropping** — Diagnosing error 13227, TwiML statusCallback debugging, webhook response validation.

**Voice AI Implementation** — STT → LLM → TTS latency pipeline, streaming LLM output to TTS, speechTimeout tuning.

**Billing Spike** — Usage anomaly investigation, retry loop diagnosis, credential exposure check, courtesy credit workflow.

---

## How it works — end to end

```
User pastes conversation
        ↓
buildSingleEvalPrompt() wraps input in role instructions + JSON schema
        ↓
fetch() POST → https://api.anthropic.com/v1/messages
        ↓
Claude reads full prompt, generates scores token by token
        ↓
Response arrives as JSON string (~2–5 seconds)
        ↓
parseJSON() converts to JS object
        ↓
Guardrail check: is_evaluable flag prevents rendering on non-support input
        ↓
React re-renders score rings, reasoning text, overall badge
```

The "backend" is Anthropic's API. There is no server, no database, no authentication layer beyond the API key handled by the artifact environment. Everything runs in the browser.

---

## Prompt design

The core of EvalKit is prompt engineering, not application logic. Two prompts do the work:

**Single eval prompt pattern:**
```
You are an expert customer service quality evaluator.
First determine if the input is actually a customer service conversation.
If not, set is_evaluable to false.
If yes, score on 5 dimensions and return as JSON only.

[user input inserted here]

Return this exact structure: { ... }
```

Key decisions:
- Role assignment up front ("You are an expert...") anchors the evaluation frame
- Guardrail instruction before scoring prevents wasted API calls on bad input
- Strict JSON-only output eliminates parsing failures from conversational preamble
- Explicit schema in the prompt reduces hallucinated field names

**Compare prompt pattern:**
Same structure, but all three inputs (context, human response, AI response) are passed in a single API call. Claude evaluates both responses in context of the customer issue simultaneously — this is intentional. Relative scoring (how does response A compare to response B given this customer's actual problem?) is more meaningful than two independent absolute scores.

---

## Guardrail design

Before rendering scores, the app checks `is_evaluable` in Claude's response. If false, a warning banner is shown instead of scores. This is implemented as a model-side check rather than a regex or keyword filter — Claude makes the judgment as part of its JSON response.

This pattern is called input validation via the model itself. It is more flexible than rule-based filtering because it handles edge cases (partial conversations, single-turn exchanges, non-English text) without hard-coded logic.

---

## Scaling to production

EvalKit as built is pull-based — a human triggers evaluation manually. A production deployment would be event-driven:

```
Ticket closes in CRM (Zendesk / Twilio Flex / Salesforce)
        ↓
Webhook POST → FastAPI receiver
        ↓
Job enqueued → SQS / Redis message queue
        ↓
Worker pool pulls jobs, calls Anthropic API in parallel
        ↓
Scores written to PostgreSQL (ticket_id, scores, timestamp, agent_id)
        ↓
Dashboard / alerts / weekly reports read from DB
```

At 1,000 tickets/day: ~$2–5/day in API costs, well within rate limits.
At high volume: Anthropic's Batch API handles async bulk evaluation at lower cost.

The Twilio-specific version: wire EvalKit to a Twilio Flex task completion webhook. Scores flow back into Flex reporting or attached to Salesforce CRM records on ticket close.

---

## Tech stack

| Layer | Choice | Why |
|-------|--------|-----|
| UI framework | React (JSX) | Component-based, state-driven re-renders |
| Styling | Inline styles | No build step required, self-contained |
| API | Anthropic Messages API | claude-sonnet-4, single endpoint |
| HTTP | Browser fetch() | No backend, direct from client |
| Fonts | Sora + DM Mono | Technical credibility without generic defaults |

No build tooling, no dependencies beyond React. Runs in Claude's artifact renderer or any Vite/CRA project.

---

## Design decisions worth discussing

**Why Claude as evaluator, not a fine-tuned classifier?**
Speed to working prototype. A classifier requires labeled training data, fine-tuning infrastructure, and ongoing maintenance. Claude with a well-engineered prompt produces useful scores immediately and can be updated by editing a string. For a proof-of-concept, the tradeoff strongly favors the prompt approach.

**Why one API call for comparison instead of two?**
Relative judgment requires shared context. If human and AI responses are scored in separate calls, Claude has no basis for comparison — it can only score each in isolation. A single call with both responses allows Claude to make statements like "the human response addresses the billing anxiety the AI response ignores." That nuance is lost with two independent calls.

**Why is hallucination risk inverted in the display?**
All other dimensions are "higher = better." Keeping hallucination risk on the same visual scale (higher = worse) would break the intuitive reading of the score rings. Inverting it in the display (10 = clean, 0 = high risk) means a user can scan five rings and know immediately that green is good everywhere.

---

## Limitations and honest caveats

**Scores are not ground truth.** Claude's evaluation reflects patterns learned during training, not a validated QA rubric. Two runs of the same conversation may produce slightly different scores. This is expected behavior from a generative model.

**Validation requires calibration.** To trust EvalKit scores, compare them against human reviewer scores on the same conversations. If agreement is above 80% on high/medium/low buckets, the eval is calibrated. If a specific dimension diverges systematically, the prompt for that dimension needs tuning.

**Hallucination detection is probabilistic.** The model flags likely fabrications but cannot verify claims against a knowledge base. A response stating a specific Twilio error code has a 48-hour fix SLA would score low on hallucination risk correctly — but EvalKit cannot confirm whether that SLA is real.

---

## What this demonstrates

- Prompt engineering: structured JSON output, role assignment, guardrails, in-context evaluation
- LLM evaluation patterns: using a model to score model and human output
- API integration: direct Anthropic Messages API, async fetch, response parsing
- Production thinking: input validation, scalable architecture, known limitations

Built by someone who spent 7+ years triaging real support escalations and wanted tooling that reflects how QA actually works at scale.

---

## Running locally

```bash
npm create vite@latest evalkit -- --template react
cd evalkit
cp evalkit.jsx src/App.jsx
npm install
npm run dev
```

Requires an Anthropic API key set in your environment or passed via the Vite proxy config.

---

## License

MIT
