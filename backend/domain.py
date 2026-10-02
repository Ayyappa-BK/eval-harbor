import json
import random
import re
import threading
from collections import Counter
from pathlib import Path

DATA = Path(__file__).resolve().parents[1] / "data/cases.json"
LOCK = threading.Lock()
HISTORY = []
POSITIVE = {
    "great",
    "excellent",
    "love",
    "fast",
    "helpful",
    "good",
    "smooth",
    "perfect",
    "reliable",
}
NEGATIVE = {
    "bad",
    "slow",
    "broken",
    "hate",
    "crash",
    "poor",
    "terrible",
    "unhelpful",
    "awful",
}


def predict(text, model):
    words = re.findall(r"[a-z]+", text.lower())
    score = 0
    for index, word in enumerate(words):
        weight = int(word in POSITIVE) - int(word in NEGATIVE)
        if model == "context" and any(
            w in {"not", "never", "no"} for w in words[max(0, index - 2) : index]
        ):
            weight *= -1
        score += weight
    return "positive" if score > 0 else "negative" if score < 0 else "neutral"


def validate(cases):
    if not isinstance(cases, list) or not 2 <= len(cases) <= 5000:
        raise ValueError("Supply 2–5000 cases")
    ids = set()
    for case in cases:
        if not isinstance(case, dict):
            raise ValueError("Each case must be an object")
        if not isinstance(case.get("id"), str) or not case["id"] or case["id"] in ids:
            raise ValueError("Case IDs must be nonempty and unique")
        ids.add(case["id"])
        if not isinstance(case.get("text"), str) or not case["text"].strip():
            raise ValueError("Each case needs text")
        if not isinstance(case.get("label"), str) or case.get("label") not in {
            "positive",
            "negative",
            "neutral",
        }:
            raise ValueError("Labels: positive, negative, neutral")
        if not isinstance(case.get("slice", "general"), str):
            raise ValueError("Slice must be a string")


def evaluate(cases):
    validate(cases)
    rows = [
        {
            **c,
            "baseline": predict(c["text"], "lexicon"),
            "candidate": predict(c["text"], "context"),
        }
        for c in cases
    ]
    deltas = [
        int(r["candidate"] == r["label"]) - int(r["baseline"] == r["label"])
        for r in rows
    ]
    rng = random.Random(17)
    boot = sorted(
        sum(rng.choices(deltas, k=len(deltas))) / len(deltas) for _ in range(400)
    )
    metrics = {}
    for model in ("baseline", "candidate"):
        confusion = Counter((r["label"], r[model]) for r in rows)
        f1 = []
        for label in ("positive", "negative", "neutral"):
            tp = confusion[label, label]
            fp = sum(
                n
                for (actual, predicted), n in confusion.items()
                if predicted == label and actual != label
            )
            fn = sum(
                n
                for (actual, predicted), n in confusion.items()
                if actual == label and predicted != label
            )
            f1.append(2 * tp / (2 * tp + fp + fn) if 2 * tp + fp + fn else 0)
        metrics[model] = {
            "accuracy": sum(r[model] == r["label"] for r in rows) / len(rows),
            "macro_f1": sum(f1) / 3,
            "confusion": [
                {"actual": a, "predicted": p, "count": n}
                for (a, p), n in sorted(confusion.items())
            ],
        }
    slices = []
    for name in sorted({r.get("slice", "general") for r in rows}):
        group = [r for r in rows if r.get("slice", "general") == name]
        slices.append(
            {
                "name": name,
                "count": len(group),
                **{
                    m: sum(r[m] == r["label"] for r in group) / len(group)
                    for m in metrics
                },
            }
        )
    return {
        "count": len(rows),
        "metrics": metrics,
        "delta": sum(deltas) / len(deltas),
        "interval": [boot[9], boot[389]],
        "slices": slices,
        "disagreements": [r for r in rows if r["baseline"] != r["candidate"]],
        "decision": "candidate improves"
        if boot[9] > 0
        else "candidate regresses"
        if boot[389] < 0
        else "inconclusive",
    }


def snapshot():
    with LOCK:
        return {"cases": json.loads(DATA.read_text()), "history": list(HISTORY)}


def handle(path, body):
    if path != "/api/evaluate":
        raise ValueError("Unknown endpoint")
    result = evaluate(body.get("cases"))
    with LOCK:
        HISTORY.append(
            {
                "run": len(HISTORY) + 1,
                "count": result["count"],
                "delta": result["delta"],
                "decision": result["decision"],
            }
        )
        del HISTORY[:-20]
    return result
