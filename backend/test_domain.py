import unittest

from domain import evaluate, predict, validate


class EvaluationTests(unittest.TestCase):
    def test_negation_changes_prediction(self):
        self.assertEqual(predict("not good", "lexicon"), "positive")
        self.assertEqual(predict("not good", "context"), "negative")

    def test_paired_interval_and_slices(self):
        cases = [
            {"id": str(i), "text": "not bad", "label": "positive", "slice": "negation"}
            for i in range(10)
        ]
        result = evaluate(cases)
        self.assertEqual(result["delta"], 1)
        self.assertEqual(result["interval"], [1, 1])
        self.assertEqual(result["slices"][0]["count"], 10)
        self.assertEqual(result["metrics"]["candidate"]["macro_f1"], 1 / 3)

    def test_tie_is_inconclusive(self):
        cases = [{"id": str(i), "text": "great", "label": "positive"} for i in range(2)]
        self.assertEqual(evaluate(cases)["decision"], "inconclusive")

    def test_duplicate_ids_rejected(self):
        with self.assertRaises(ValueError):
            validate([{"id": "x", "text": "ok", "label": "neutral"}] * 2)
