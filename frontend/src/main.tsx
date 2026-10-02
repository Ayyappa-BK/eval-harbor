import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";
type Label = "positive" | "negative" | "neutral";
interface Case {
  id: string;
  text: string;
  label: Label;
  slice?: string;
}
interface Prediction extends Case {
  baseline: Label;
  candidate: Label;
}
interface Metrics {
  accuracy: number;
  macro_f1: number;
  confusion: { actual: Label; predicted: Label; count: number }[];
}
interface Result {
  count: number;
  metrics: { baseline: Metrics; candidate: Metrics };
  delta: number;
  interval: [number, number];
  decision: string;
  slices: {
    name: string;
    count: number;
    baseline: number;
    candidate: number;
  }[];
  disagreements: Prediction[];
}
interface Dashboard {
  cases: Case[];
  history: { run: number; count: number; delta: number; decision: string }[];
}
type Api = { state: Dashboard; evaluate: Result };
type Action = Exclude<keyof Api, "state">;
async function api<K extends keyof Api>(
  path: K,
  body?: Record<string, unknown>,
): Promise<Api[K]> {
  const response = await fetch(
    `/api/${path}`,
    body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : undefined,
  );
  const value = await response.json();
  if (!response.ok) throw new Error(value.error || "Request failed");
  return value;
}
function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="stat">
      <b>{value}</b>
      <span>{label}</span>
    </div>
  );
}
function App() {
  const [state, setState] = useState<Partial<Dashboard>>({});
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    api("state")
      .then(setState)
      .catch((e) => setError(e.message));
  }, []);
  async function run(path: Action, body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      const data = await api(path, body);
      setResult(path === "evaluate" ? (data as Result) : null);
      setState(await api("state"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }
  const [source, setSource] = useState<string | null>(null);
  const casesText = source ?? JSON.stringify(state.cases || [], null, 2);
  const percent = (n: number) => `${(n * 100).toFixed(1)}%`;
  function evaluate() {
    try {
      void run("evaluate", { cases: JSON.parse(casesText) });
    } catch {
      setError("Cases must be valid JSON");
    }
  }
  return (
    <>
      <header>
        <strong>Eval Harbor</strong>
        <span>Model quality / release review</span>
      </header>
      <main>
        <div className="eyebrow">Compare · inspect · decide</div>
        <h1>A better score needs context.</h1>
        <p>
          Compare a lexicon baseline with a negation-aware candidate on the same
          labeled cases.
        </p>
        <div className="stats">
          <Stat
            value={result ? percent(result.metrics.candidate.accuracy) : "—"}
            label="Candidate accuracy"
          />
          <Stat
            value={result ? percent(result.delta) : "—"}
            label="Paired accuracy difference"
          />
          <Stat
            value={result?.decision || "Ready"}
            label="Bootstrap release signal"
          />
        </div>
        <div className="grid">
          <section className="panel">
            <h2>Evaluation dataset</h2>
            <p>
              Try the fixture, then add your own labeled cases. Both classifiers
              run locally.
            </p>
            <label htmlFor="cases">Cases · JSON array</label>
            <textarea
              id="cases"
              value={casesText}
              onChange={(e) => setSource(e.target.value)}
            />
            <div className="row">
              <button disabled={busy || !state.cases} onClick={evaluate}>
                {busy ? "Evaluating…" : "Run comparison"}
              </button>
              <button className="secondary" onClick={() => setSource(null)}>
                Restore fixture
              </button>
            </div>
            <p className="muted">
              400 paired bootstrap samples · fixed seed 17
            </p>
          </section>
          <section className="panel">
            <h2>Slice review</h2>
            {result ? (
              <>
                <p>
                  95% interval: {percent(result.interval[0])} to{" "}
                  {percent(result.interval[1])}. Small fixtures are exploratory,
                  not release evidence.
                </p>
                <table>
                  <thead>
                    <tr>
                      <th>Slice</th>
                      <th>Cases</th>
                      <th>Baseline</th>
                      <th>Candidate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.slices.map((s) => (
                      <tr key={s.name}>
                        <td>{s.name}</td>
                        <td>{s.count}</td>
                        <td>{percent(s.baseline)}</td>
                        <td>{percent(s.candidate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <h2 style={{ marginTop: 24 }}>Prediction changes</h2>
                {result.disagreements.map((r) => (
                  <div className="passage" key={r.id}>
                    <span className="badge">
                      {r.id} · {r.slice}
                    </span>
                    <p>{r.text}</p>
                    <span className="muted">
                      {r.baseline} → {r.candidate} · expected {r.label}
                    </span>
                  </div>
                ))}
                <details>
                  <summary>Metrics and confusion counts</summary>
                  <pre>{JSON.stringify(result.metrics, null, 2)}</pre>
                </details>
              </>
            ) : (
              <p>
                Run a comparison to inspect regressions by slice and changed
                predictions.
              </p>
            )}
          </section>
        </div>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <footer>
          {state.history?.length || 0} runs this session. Results reset when the
          server restarts.
        </footer>
      </main>
    </>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
