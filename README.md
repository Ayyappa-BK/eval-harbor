# Eval Harbor

Compare two text classifiers before promoting a change. Eval Harbor runs a lexicon baseline and a negation-aware candidate against the same labeled cases, then makes the changed predictions and slice-level regressions easy to inspect.

## Run locally

Use Python 3.11+ and Node.js 24 with npm. Python has no third-party dependencies. From the cloned repository root:

```sh
cd frontend
npm ci
npm run build
cd ..
python3 backend/server.py
```

Open http://localhost:8311. On Windows, use `py` in place of `python3`. The Python server serves both the compiled React app and the REST API. No API keys, downloaded model weights, or paid services are needed. The first npm install requires internet access.

For frontend development, keep the Python server running and use a second terminal:

```sh
cd frontend
npm run dev
```

Vite runs at http://localhost:8411 and proxies `/api` to the Python server. Set `PORT` to change the backend port; update `frontend/vite.config.ts` if you also use the development proxy. The backend binds to localhost by default.

## Try it

1. Run the bundled 24-case dataset.
2. Compare the standard, negation, mixed, and implicit slices. The candidate handles some negation, but both models miss implicit sentiment.
3. Add cases to the JSON editor and run again. Each case needs a unique `id`, `text`, and `label`; `slice` is optional.
4. Expand the metrics section to inspect macro F1 and confusion counts.

Labels are `positive`, `negative`, and `neutral`. The limit is 5,000 cases per run.

## How it works

`backend/domain.py` owns prediction, validation, and evaluation. Accuracy differences are bootstrapped as _paired_ observations: each resampled case retains both model results. The report uses 400 resamples with seed 17 and a percentile interval. Macro F1 averages all three labels, including absent labels as zero.

The release signal is deliberately conservative: an interval spanning zero is inconclusive. It is a demonstration, not a calibrated statistical release policy. The bundled labels are hand-authored fixtures; the models are deterministic rules, not trained neural models. Negation uses a two-token window and cannot reliably parse complex clauses.

Recent run summaries are held in memory, capped at 20. Restarting the server resets them. Evaluation is synchronous, which keeps the example small; a larger dataset should run as a background job with cancellation and stored artifacts.

The frontend is React and TypeScript; Vite builds static assets. The Python standard-library HTTP server validates JSON requests, limits payloads to 2 MB, and emits request-duration logs. Errors appear inline in the interface. React renders user text as text rather than HTML.

## API

`GET /api/health` returns a liveness check. `GET /api/state` returns the current dashboard state.

```text
POST /api/evaluate
{"cases":[{"id":"a","text":"not bad","label":"positive","slice":"negation"},{"id":"b","text":"slow","label":"negative"}]}
```

POST endpoints expect `Content-Type: application/json`. Invalid inputs return HTTP 400 with an `error` field. Oversized requests return 413. These endpoints have no authentication and are intended for local use; the standard-library server is not a production ingress server.

## Checks

```sh
python3 -m unittest discover -s backend -p 'test_*.py' -v
cd frontend
npm ci
npm run build
```

Tests exercise domain behavior and HTTP validation. The frontend build includes strict TypeScript checking. GitHub Actions runs both on pushes and pull requests.

## Docker

```sh
docker build -t eval-harbor .
docker run --rm -p 127.0.0.1:8311:8311 eval-harbor
```

The image builds the frontend and serves it from Python under a non-root user. Docker is optional.

## Platform engineering focus

The interface and API demonstrate model evaluation integration, reproducible quality checks, and internal developer tooling. A useful next extension is an adapter for a trained classifier with versioned prediction artifacts.

## Layout

```text
backend/                 API server, domain logic, and tests
frontend/src/            React interface and styles
frontend/package-lock.json  Reproducible dependency installation
data/                    Bundled fixtures
.github/workflows/       Build and test checks
```

MIT licensed. See `LICENSE`.
