import { useState } from "react";

const ANTHROPIC_MODEL = "claude-sonnet-4-20250514";

const DIMENSIONS = [
  { key: "accuracy", label: "Accuracy", icon: "◎", desc: "Correctness of information provided" },
  { key: "tone", label: "Tone & Empathy", icon: "◈", desc: "Warmth, professionalism, emotional awareness" },
  { key: "hallucination", label: "Hallucination Risk", icon: "◬", desc: "Likelihood of fabricated or unsupported claims" },
  { key: "conciseness", label: "Conciseness", icon: "◧", desc: "Clarity and brevity without losing substance" },
  { key: "resolution", label: "Resolution Quality", icon: "◉", desc: "How effectively the issue was resolved" },
];

// ─── Sample Scenarios (Twilio-specific) ───────────────────────────────────────
const SCENARIOS = [
  {
    id: "voice_drop",
    label: "Voice Call Dropping",
    conversation: `Customer: Our outbound calls are dropping after exactly 30 seconds. It started happening this morning across all our agents. We're losing customers mid-conversation.

Agent: I'm sorry to hear that — mid-call drops at a consistent interval are almost always a signaling issue rather than a network problem on your end. The 30-second pattern is a strong indicator that your TwiML response isn't returning a valid verb after the initial connection, causing Twilio's timeout to kick in.

Can you confirm whether you're using <Dial> or <Connect> in your TwiML, and whether your webhook is returning a response within the 5-second window? Also, are you seeing error code 11200 or 13227 in your debugger logs?

Customer: We're using <Dial> and I'm seeing 13227 in the logs.

Agent: That confirms it — error 13227 means Twilio received an empty or invalid TwiML response on the callStatus callback. Your statusCallback URL is likely returning a 200 with no body, or timing out. Check that your statusCallback endpoint returns a valid TwiML response or at minimum an empty <Response/> tag. I'd also recommend enabling Twilio's real-time monitoring on that webhook so you can see the exact payload being returned. Want me to walk you through setting that up?`,
    human: `I'm sorry to hear that — mid-call drops at a consistent interval are almost always a signaling issue rather than a network problem on your end. The 30-second pattern is a strong indicator that your TwiML response isn't returning a valid verb after the initial connection, causing Twilio's timeout to kick in.

Can you confirm whether you're using <Dial> or <Connect> in your TwiML, and whether your webhook is returning a response within the 5-second window? Also, are you seeing error code 11200 or 13227 in your debugger logs?`,
    ai: `Hi! Call drops at exactly 30 seconds usually mean a TwiML timeout issue. Check your webhook is responding within 5 seconds and returning valid TwiML. Error 13227 in your logs would confirm this. Let me know what you find and I can help from there.`,
  },
  {
    id: "voice_ai",
    label: "Voice AI Implementation",
    conversation: `Customer: We're building a Voice AI IVR using Twilio and an LLM backend. Latency is really bad — callers are waiting 4-5 seconds between speaking and hearing a response. How do we fix this?

Agent: That latency is coming from your end-to-end pipeline — STT processing, LLM inference, and TTS synthesis are all happening sequentially, which stacks up fast. There are a few levers you can pull depending on where the bottleneck is.

First, check if you're using Twilio's <Gather> with speechTimeout — setting it too high delays when the STT result is sent to your backend. Keep it at 1–2 seconds max. Second, if you're using a hosted LLM, streaming the response to your TTS engine as tokens arrive (instead of waiting for the full completion) can cut 1–2 seconds alone. Third, consider switching to a streaming TTS provider like ElevenLabs or Deepgram if you're not already — they start speaking before the full audio is synthesized.

What does your current pipeline look like — are you streaming LLM output or waiting for full completion before sending to TTS?

Customer: We're waiting for full completion before TTS. I didn't know streaming was an option.

Agent: That's your biggest win right there. Switch to streaming LLM output directly into your TTS call — most providers support chunked input now. Combined with tightening your speechTimeout, you should get latency down to under 1.5 seconds. I can send you a reference architecture doc for low-latency Voice AI pipelines if that would help.`,
    human: `That latency is coming from your end-to-end pipeline — STT processing, LLM inference, and TTS synthesis are all happening sequentially, which stacks up fast. There are a few levers you can pull depending on where the bottleneck is.

First, check if you're using Twilio's <Gather> with speechTimeout — setting it too high delays when the STT result is sent to your backend. Keep it at 1–2 seconds max. Second, if you're using a hosted LLM, streaming the response to your TTS engine as tokens arrive (instead of waiting for the full completion) can cut 1–2 seconds alone. Third, consider switching to a streaming TTS provider like ElevenLabs or Deepgram if you're not already — they start speaking before the full audio is synthesized.`,
    ai: `High latency in Voice AI pipelines usually comes from sequential STT → LLM → TTS processing. Key fixes: reduce speechTimeout to 1-2 seconds, enable LLM response streaming so TTS starts before full completion, and use a streaming TTS provider. These changes typically get latency under 2 seconds. What's your current stack?`,
  },
  {
    id: "billing",
    label: "Billing Question",
    conversation: `Customer: My bill this month is $4,200 and last month it was $800. Nothing changed on our end. I need an explanation before I can approve payment.

Agent: That's a significant jump and I completely understand the need to review it before approving. Let me pull up the usage breakdown.

Looking at your account, the increase is driven by a spike in outbound voice minutes — you went from roughly 12,000 minutes last month to about 68,000 this month. The majority of that traffic happened between the 14th and 18th. Does that timeframe correspond to any campaigns, load tests, or deployments on your side?

If this was unexpected, it's worth checking whether any of your API credentials were exposed — a spike in that pattern can sometimes indicate unauthorized use. I'd recommend rotating your auth tokens immediately as a precaution, and I can temporarily flag the account for manual review while we investigate.

Customer: We did push a new release on the 14th. It's possible there's a bug causing excessive retries.

Agent: That aligns perfectly with the pattern. A retry loop on failed calls would generate exactly this kind of spike. I'd check your call logs filtered by status=failed for that date range — if you see the same numbers being dialed repeatedly, that confirms it. I can also apply a courtesy credit while your engineering team investigates if this was an unintended usage pattern.`,
    human: `That's a significant jump and I completely understand the need to review it before approving. Let me pull up the usage breakdown.

Looking at your account, the increase is driven by a spike in outbound voice minutes — you went from roughly 12,000 minutes last month to about 68,000 this month. The majority of that traffic happened between the 14th and 18th. Does that timeframe correspond to any campaigns, load tests, or deployments on your side?

If this was unexpected, it's worth checking whether any of your API credentials were exposed — a spike in that pattern can sometimes indicate unauthorized use. I'd recommend rotating your auth tokens immediately as a precaution.`,
    ai: `I can see your voice minutes increased significantly this month, from around 12K to 68K minutes, which explains the billing difference. The spike occurred mid-month. Can you check if any deployments, campaigns, or retry loops were active around the 14th? If usage was unintended, we can review options including a courtesy credit.`,
  },
];

const SAMPLE_CONVERSATION = SCENARIOS[0].conversation;
const SAMPLE_HUMAN = SCENARIOS[0].human;
const SAMPLE_AI = SCENARIOS[0].ai;

function ScoreRing({ score, size = 56, hallucination = false }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const display = hallucination ? 10 - score : score;
  const fillScore = hallucination ? 10 - score : score;
  const pct = fillScore / 10;
  const color = fillScore >= 8 ? "#4ade80" : fillScore >= 5 ? "#facc15" : "#f87171";
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1e293b" strokeWidth={6} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={6}
        strokeDasharray={`${circ * pct} ${circ}`}
        strokeLinecap="round"
        style={{ transition: "stroke-dasharray 1s cubic-bezier(.4,0,.2,1)" }}
      />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central"
        style={{ transform: "rotate(90deg)", transformOrigin: "center", fill: color, fontSize: size * 0.28, fontFamily: "'DM Mono', monospace", fontWeight: 700 }}>
        {display.toFixed(1)}
      </text>
    </svg>
  );
}

function ScoreCard({ dim, score, reasoning, animate }) {
  const isHallucination = dim.key === "hallucination";
  const displayScore = isHallucination ? 10 - score : score;
  const color = displayScore >= 8 ? "#4ade80" : displayScore >= 5 ? "#facc15" : "#f87171";
  return (
    <div style={{
      background: "#0f172a",
      border: "1px solid #1e293b",
      borderRadius: 12,
      padding: "20px",
      display: "flex",
      gap: 16,
      alignItems: "flex-start",
      opacity: animate ? 1 : 0,
      transform: animate ? "translateY(0)" : "translateY(12px)",
      transition: "opacity 0.5s ease, transform 0.5s ease",
    }}>
      <div style={{ flexShrink: 0 }}>
        <ScoreRing score={score} hallucination={isHallucination} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span style={{ color: color, fontSize: 13, fontFamily: "'DM Mono', monospace" }}>{dim.icon}</span>
          <span style={{ color: "#e2e8f0", fontWeight: 600, fontSize: 14, fontFamily: "'Sora', sans-serif" }}>{dim.label}</span>
        </div>
        <p style={{ color: "#64748b", fontSize: 12, margin: "0 0 8px", fontFamily: "'DM Mono', monospace" }}>{dim.desc}</p>
        {reasoning && <p style={{ color: "#94a3b8", fontSize: 13, margin: 0, lineHeight: 1.6, fontFamily: "'Sora', sans-serif" }}>{reasoning}</p>}
      </div>
    </div>
  );
}

function OverallBadge({ score }) {
  const color = score >= 8 ? "#4ade80" : score >= 6 ? "#facc15" : "#f87171";
  const label = score >= 8 ? "Excellent" : score >= 6 ? "Acceptable" : "Needs Improvement";
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 10,
      background: `${color}15`, border: `1px solid ${color}40`,
      borderRadius: 100, padding: "8px 20px",
    }}>
      <ScoreRing score={score} size={48} />
      <div>
        <div style={{ color, fontWeight: 700, fontSize: 15, fontFamily: "'Sora', sans-serif" }}>{label}</div>
        <div style={{ color: "#64748b", fontSize: 12, fontFamily: "'DM Mono', monospace" }}>Overall Score</div>
      </div>
    </div>
  );
}

async function callClaude(prompt) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await res.json();
  return data.content.map(b => b.text || "").join("");
}

function buildSingleEvalPrompt(conversation) {
  return `You are an expert customer service quality evaluator. First determine if the input is actually a customer service conversation or support interaction. If it is NOT (e.g. random text, code, a poem, gibberish, an unrelated article), set "is_evaluable" to false and skip scoring. If it IS a valid support interaction, set "is_evaluable" to true and score it. Respond ONLY with valid JSON, no markdown.

Input:
${conversation}

Return this exact JSON structure:
{
  "is_evaluable": true | false,
  "not_evaluable_reason": "<one sentence explaining why, only if is_evaluable is false, else empty string>",
  "accuracy": { "score": <0-10>, "reasoning": "<2 sentences>" },
  "tone": { "score": <0-10>, "reasoning": "<2 sentences>" },
  "hallucination": { "score": <0-10 where 10 = high hallucination risk>, "reasoning": "<2 sentences>" },
  "conciseness": { "score": <0-10>, "reasoning": "<2 sentences>" },
  "resolution": { "score": <0-10>, "reasoning": "<2 sentences>" },
  "summary": "<3-sentence overall assessment, empty string if not evaluable>"
}`;
}

function buildComparePrompt(context, humanResponse, aiResponse) {
  return `You are an expert customer service quality evaluator. First determine if the inputs describe a genuine customer service interaction. If they do NOT (e.g. random text, gibberish, unrelated content), set "is_evaluable" to false. Otherwise set it to true and score both responses. Respond ONLY with valid JSON, no markdown.

Customer context:
${context}

Human Agent Response:
${humanResponse}

AI Response:
${aiResponse}

Return this exact JSON structure:
{
  "is_evaluable": true | false,
  "not_evaluable_reason": "<one sentence, only if is_evaluable is false, else empty string>",
  "human": {
    "accuracy": { "score": <0-10>, "reasoning": "<1 sentence>" },
    "tone": { "score": <0-10>, "reasoning": "<1 sentence>" },
    "hallucination": { "score": <0-10>, "reasoning": "<1 sentence>" },
    "conciseness": { "score": <0-10>, "reasoning": "<1 sentence>" },
    "resolution": { "score": <0-10>, "reasoning": "<1 sentence>" }
  },
  "ai": {
    "accuracy": { "score": <0-10>, "reasoning": "<1 sentence>" },
    "tone": { "score": <0-10>, "reasoning": "<1 sentence>" },
    "hallucination": { "score": <0-10>, "reasoning": "<1 sentence>" },
    "conciseness": { "score": <0-10>, "reasoning": "<1 sentence>" },
    "resolution": { "score": <0-10>, "reasoning": "<1 sentence>" }
  },
  "verdict": "<2-sentence comparison verdict, empty string if not evaluable>",
  "winner": "human" | "ai" | "tie" | "none"
}`;
}

function parseJSON(text) {
  try {
    const clean = text.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
  } catch {
    return null;
  }
}

function avgScore(scores, isHallucination = false) {
  const vals = Object.entries(scores).map(([k, v]) => {
    const s = v.score;
    return k === "hallucination" ? 10 - s : s;
  });
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────
function Tab({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      background: "none", border: "none", cursor: "pointer",
      padding: "10px 20px", fontFamily: "'Sora', sans-serif",
      fontSize: 14, fontWeight: 600,
      color: active ? "#e2e8f0" : "#475569",
      borderBottom: active ? "2px solid #6366f1" : "2px solid transparent",
      transition: "all 0.2s",
    }}>{label}</button>
  );
}

// ─── Single Eval Panel ────────────────────────────────────────────────────────
function SingleEval() {
  const [conversation, setConversation] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [animated, setAnimated] = useState(false);

  async function handleEval() {
    if (!conversation.trim()) return;
    setLoading(true); setResult(null); setError(""); setAnimated(false);
    try {
      const raw = await callClaude(buildSingleEvalPrompt(conversation));
      const parsed = parseJSON(raw);
      if (!parsed) throw new Error("Could not parse response.");
      setResult(parsed);
      setTimeout(() => setAnimated(true), 50);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const overall = (result && result.is_evaluable) ? avgScore(
    { accuracy: result.accuracy, tone: result.tone, hallucination: result.hallucination, conciseness: result.conciseness, resolution: result.resolution }
  ) : null;

  return (
    <div>
      <p style={{ color: "#64748b", fontFamily: "'Sora', sans-serif", fontSize: 14, marginBottom: 16 }}>
        Paste a full customer service conversation below to receive a scored evaluation across all five quality dimensions.
      </p>
      <textarea
        value={conversation}
        onChange={e => setConversation(e.target.value)}
        placeholder="Paste conversation here..."
        style={{
          width: "100%", minHeight: 200, background: "#0f172a",
          border: "1px solid #1e293b", borderRadius: 10, padding: 16,
          color: "#e2e8f0", fontFamily: "'DM Mono', monospace", fontSize: 13,
          resize: "vertical", outline: "none", boxSizing: "border-box",
          lineHeight: 1.7,
        }}
      />
      <div style={{ display: "flex", gap: 12, marginTop: 12, marginBottom: 28, flexWrap: "wrap", alignItems: "center" }}>
        <button onClick={handleEval} disabled={loading || !conversation.trim()} style={{
          background: loading ? "#312e81" : "#6366f1", color: "#fff",
          border: "none", borderRadius: 8, padding: "10px 24px",
          fontFamily: "'Sora', sans-serif", fontWeight: 600, fontSize: 14,
          cursor: loading ? "not-allowed" : "pointer", transition: "background 0.2s",
        }}>
          {loading ? "Evaluating…" : "Evaluate →"}
        </button>
        <span style={{ color: "#334155", fontSize: 12, fontFamily: "'DM Mono', monospace" }}>Load sample:</span>
        {SCENARIOS.map(s => (
          <button key={s.id} onClick={() => setConversation(s.conversation)}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "#6366f1"; e.currentTarget.style.color = "#a5b4fc"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "#1e293b"; e.currentTarget.style.color = "#64748b"; }}
            style={{
              background: "none", border: "1px solid #1e293b", color: "#64748b",
              borderRadius: 8, padding: "8px 14px", fontFamily: "'Sora', sans-serif",
              fontSize: 12, cursor: "pointer", transition: "border-color 0.2s, color 0.2s",
            }}>{s.label}</button>
        ))}
      </div>

      {error && <p style={{ color: "#f87171", fontFamily: "'DM Mono', monospace", fontSize: 13 }}>{error}</p>}

      {result && !result.is_evaluable && (
        <div style={{
          background: "#1c1008", border: "1px solid #92400e",
          borderRadius: 10, padding: 16, display: "flex", gap: 12, alignItems: "flex-start",
        }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>⚠</span>
          <div>
            <p style={{ color: "#fbbf24", fontWeight: 600, fontFamily: "'Sora', sans-serif", fontSize: 14, margin: "0 0 4px" }}>
              Not a customer service conversation
            </p>
            <p style={{ color: "#d97706", fontFamily: "'Sora', sans-serif", fontSize: 13, margin: 0 }}>
              {result.not_evaluable_reason || "The input doesn't appear to be a support interaction. Please paste a real customer service conversation to evaluate."}
            </p>
          </div>
        </div>
      )}

      {result && result.is_evaluable && (
        <div>
          <div style={{ marginBottom: 24 }}>
            <OverallBadge score={overall} />
          </div>
          {result.summary && (
            <div style={{
              background: "#0f172a", border: "1px solid #1e293b", borderRadius: 10,
              padding: 16, marginBottom: 20,
            }}>
              <p style={{ color: "#94a3b8", fontFamily: "'Sora', sans-serif", fontSize: 14, margin: 0, lineHeight: 1.7 }}>
                {result.summary}
              </p>
            </div>
          )}
          <div style={{ display: "grid", gap: 12 }}>
            {DIMENSIONS.map((dim, i) => (
              <ScoreCard
                key={dim.key} dim={dim}
                score={result[dim.key]?.score ?? 0}
                reasoning={result[dim.key]?.reasoning}
                animate={animated}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Compare Panel ────────────────────────────────────────────────────────────
function CompareEval() {
  const [context, setContext] = useState("");
  const [human, setHuman] = useState("");
  const [ai, setAi] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [animated, setAnimated] = useState(false);

  async function handleCompare() {
    if (!context.trim() || !human.trim() || !ai.trim()) return;
    setLoading(true); setResult(null); setError(""); setAnimated(false);
    try {
      const raw = await callClaude(buildComparePrompt(context, human, ai));
      const parsed = parseJSON(raw);
      if (!parsed) throw new Error("Could not parse response.");
      setResult(parsed);
      setTimeout(() => setAnimated(true), 50);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function loadSample(scenario) {
    const firstLine = scenario.conversation.split("\n").find(l => l.startsWith("Customer:")) || "";
    setContext(firstLine.replace("Customer:", "").trim() || scenario.label);
    setHuman(scenario.human);
    setAi(scenario.ai);
  }

  const winnerColor = result?.winner === "human" ? "#818cf8" : result?.winner === "ai" ? "#34d399" : "#facc15";
  const winnerLabel = result?.winner === "human" ? "Human Agent" : result?.winner === "ai" ? "AI Response" : "Tie";

  return (
    <div>
      <p style={{ color: "#64748b", fontFamily: "'Sora', sans-serif", fontSize: 14, marginBottom: 20 }}>
        Enter the customer context and two responses to compare human agent vs. AI quality side by side.
      </p>

      <label style={labelStyle}>Customer Context</label>
      <textarea value={context} onChange={e => setContext(e.target.value)}
        placeholder="Describe the customer's issue or paste the customer message..."
        style={{ ...taStyle, minHeight: 80 }} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
        <div>
          <label style={{ ...labelStyle, color: "#818cf8" }}>◈ Human Agent Response</label>
          <textarea value={human} onChange={e => setHuman(e.target.value)}
            placeholder="Paste human agent response..." style={{ ...taStyle, minHeight: 160, borderColor: "#312e81" }} />
        </div>
        <div>
          <label style={{ ...labelStyle, color: "#34d399" }}>◉ AI Response</label>
          <textarea value={ai} onChange={e => setAi(e.target.value)}
            placeholder="Paste AI-generated response..." style={{ ...taStyle, minHeight: 160, borderColor: "#064e3b" }} />
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, marginTop: 16, marginBottom: 28, flexWrap: "wrap", alignItems: "center" }}>
        <button onClick={handleCompare} disabled={loading || !context.trim() || !human.trim() || !ai.trim()} style={{
          background: loading ? "#312e81" : "#6366f1", color: "#fff",
          border: "none", borderRadius: 8, padding: "10px 24px",
          fontFamily: "'Sora', sans-serif", fontWeight: 600, fontSize: 14,
          cursor: loading ? "not-allowed" : "pointer",
        }}>
          {loading ? "Comparing…" : "Compare →"}
        </button>
        <span style={{ color: "#334155", fontSize: 12, fontFamily: "'DM Mono', monospace" }}>Load sample:</span>
        {SCENARIOS.map(s => (
          <button key={s.id} onClick={() => loadSample(s)}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "#6366f1"; e.currentTarget.style.color = "#a5b4fc"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "#1e293b"; e.currentTarget.style.color = "#64748b"; }}
            style={{
              background: "none", border: "1px solid #1e293b", color: "#64748b",
              borderRadius: 8, padding: "8px 14px", fontFamily: "'Sora', sans-serif",
              fontSize: 12, cursor: "pointer", transition: "border-color 0.2s, color 0.2s",
            }}>{s.label}</button>
        ))}
      </div>

      {error && <p style={{ color: "#f87171", fontFamily: "'DM Mono', monospace", fontSize: 13 }}>{error}</p>}

      {result && !result.is_evaluable && (
        <div style={{
          background: "#1c1008", border: "1px solid #92400e",
          borderRadius: 10, padding: 16, display: "flex", gap: 12, alignItems: "flex-start",
        }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>⚠</span>
          <div>
            <p style={{ color: "#fbbf24", fontWeight: 600, fontFamily: "'Sora', sans-serif", fontSize: 14, margin: "0 0 4px" }}>
              Not a valid support interaction
            </p>
            <p style={{ color: "#d97706", fontFamily: "'Sora', sans-serif", fontSize: 13, margin: 0 }}>
              {result.not_evaluable_reason || "The inputs don't appear to describe a customer service interaction. Please provide a real support context and responses to compare."}
            </p>
          </div>
        </div>
      )}

      {result && result.is_evaluable && (
        <div style={{ opacity: animated ? 1 : 0, transform: animated ? "translateY(0)" : "translateY(12px)", transition: "all 0.5s ease" }}>
          {/* Verdict */}
          <div style={{
            background: "#0f172a", border: `1px solid ${winnerColor}40`,
            borderRadius: 12, padding: 20, marginBottom: 24,
            display: "flex", alignItems: "center", gap: 16,
          }}>
            <div style={{
              background: `${winnerColor}20`, border: `1px solid ${winnerColor}50`,
              borderRadius: 8, padding: "6px 16px",
              color: winnerColor, fontWeight: 700, fontSize: 13,
              fontFamily: "'Sora', sans-serif", whiteSpace: "nowrap",
            }}>
              Winner: {winnerLabel}
            </div>
            <p style={{ color: "#94a3b8", fontFamily: "'Sora', sans-serif", fontSize: 14, margin: 0, lineHeight: 1.6 }}>
              {result.verdict}
            </p>
          </div>

          {/* Side by side */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {["human", "ai"].map(side => {
              const sideColor = side === "human" ? "#818cf8" : "#34d399";
              const sideLabel = side === "human" ? "Human Agent" : "AI Response";
              const data = result[side];
              const avg = data ? avgScore(data) : 0;
              return (
                <div key={side} style={{
                  background: "#0f172a", border: `1px solid ${sideColor}30`,
                  borderRadius: 12, padding: 20,
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                    <span style={{ color: sideColor, fontWeight: 700, fontFamily: "'Sora', sans-serif", fontSize: 14 }}>{sideLabel}</span>
                    <ScoreRing score={avg} size={48} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {DIMENSIONS.map(dim => {
                      const entry = data?.[dim.key];
                      const isH = dim.key === "hallucination";
                      const displayScore = isH ? 10 - (entry?.score ?? 0) : (entry?.score ?? 0);
                      const barColor = displayScore >= 8 ? "#4ade80" : displayScore >= 5 ? "#facc15" : "#f87171";
                      return (
                        <div key={dim.key}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                            <span style={{ color: "#94a3b8", fontSize: 12, fontFamily: "'Sora', sans-serif" }}>{dim.label}</span>
                            <span style={{ color: barColor, fontSize: 12, fontFamily: "'DM Mono', monospace", fontWeight: 700 }}>
                              {displayScore.toFixed(1)}
                            </span>
                          </div>
                          <div style={{ background: "#1e293b", borderRadius: 4, height: 4 }}>
                            <div style={{
                              background: barColor, height: 4, borderRadius: 4,
                              width: `${displayScore * 10}%`,
                              transition: "width 1s cubic-bezier(.4,0,.2,1)",
                            }} />
                          </div>
                          {entry?.reasoning && (
                            <p style={{ color: "#475569", fontSize: 11, margin: "4px 0 0", fontFamily: "'Sora', sans-serif", lineHeight: 1.5 }}>
                              {entry.reasoning}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const labelStyle = {
  display: "block", color: "#64748b", fontSize: 12,
  fontFamily: "'DM Mono', monospace", marginBottom: 6, letterSpacing: "0.05em",
};

const taStyle = {
  width: "100%", background: "#0f172a",
  border: "1px solid #1e293b", borderRadius: 10, padding: 14,
  color: "#e2e8f0", fontFamily: "'DM Mono', monospace", fontSize: 13,
  resize: "vertical", outline: "none", boxSizing: "border-box", lineHeight: 1.7,
};

// ─── App ──────────────────────────────────────────────────────────────────────
export default function EvalKit() {
  const [tab, setTab] = useState("single");

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #0f172a; }
        ::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 3px; }
        textarea:focus { border-color: #6366f1 !important; box-shadow: 0 0 0 3px #6366f120; }
      `}</style>
      <div style={{
        minHeight: "100vh", background: "#020817",
        color: "#e2e8f0", fontFamily: "'Sora', sans-serif",
        padding: "0 0 60px",
      }}>
        {/* Header */}
        <div style={{
          borderBottom: "1px solid #0f172a",
          background: "#020817",
          padding: "28px 32px 0",
          position: "sticky", top: 0, zIndex: 10,
          backdropFilter: "blur(12px)",
        }}>
          <div style={{ maxWidth: 860, margin: "0 auto" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 4 }}>
              <h1 style={{
                margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-0.03em",
                background: "linear-gradient(135deg, #e2e8f0 0%, #6366f1 100%)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              }}>EvalKit</h1>
              <span style={{
                background: "#6366f115", border: "1px solid #6366f130",
                color: "#818cf8", fontSize: 11, padding: "2px 8px", borderRadius: 100,
                fontFamily: "'DM Mono', monospace", letterSpacing: "0.08em",
              }}>v1.0</span>
            </div>
            <p style={{ color: "#475569", fontSize: 13, margin: "0 0 20px" }}>
              Customer Service AI Evaluator · Powered by Claude
            </p>
            <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #0f172a" }}>
              <Tab label="Single Evaluation" active={tab === "single"} onClick={() => setTab("single")} />
              <Tab label="Human vs AI Comparison" active={tab === "compare"} onClick={() => setTab("compare")} />
            </div>
          </div>
        </div>

        {/* Content */}
        <div style={{ maxWidth: 860, margin: "32px auto 0", padding: "0 32px" }}>
          {tab === "single" ? <SingleEval /> : <CompareEval />}
        </div>
      </div>
    </>
  );
}
