"""Unit tests for the shared raw_jobs persistence contract."""

from __future__ import annotations

import importlib.util
import unittest
from pathlib import Path
from typing import Any

MODULE_PATH = Path(__file__).parents[1] / "crawl_pipeline" / "utils" / "raw_jobs.py"
SPEC = importlib.util.spec_from_file_location("polaris_raw_jobs", MODULE_PATH)
if SPEC is None or SPEC.loader is None:  # pragma: no cover - import guard
    raise RuntimeError(f"Cannot load {MODULE_PATH}")
RAW_JOBS = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(RAW_JOBS)


class FakeConnection:
    def __init__(self) -> None:
        self.calls: list[tuple[str, Any]] = []

    def execute(self, statement: Any, params: Any = None) -> None:
        self.calls.append((str(statement), params))


class FakeTransaction:
    def __init__(self, connection: FakeConnection) -> None:
        self.connection = connection

    def __enter__(self) -> FakeConnection:
        return self.connection

    def __exit__(self, *_: Any) -> None:
        return None


class FakeEngine:
    def __init__(self) -> None:
        self.connection = FakeConnection()
        self.begin_count = 0

    def begin(self) -> FakeTransaction:
        self.begin_count += 1
        return FakeTransaction(self.connection)


class RawJobsPersistenceTests(unittest.TestCase):
    def test_empty_batch_does_not_open_a_transaction(self) -> None:
        engine = FakeEngine()

        self.assertEqual(RAW_JOBS.upsert_raw_jobs(engine, []), 0)
        self.assertEqual(engine.begin_count, 0)

    def test_batch_uses_one_transaction_and_preserves_delivery_invariants(self) -> None:
        engine = FakeEngine()
        record = {
            "id": "topcv-1",
            "title": "Data Engineer",
            "company": "Polaris",
            "location": "Hà Nội",
            "salary": "20 triệu",
            "experience": "3 năm",
            "description": "Build pipelines",
            "requirements": "SQL",
            "tags": "data",
            "source": "topcv",
            "url": "https://example.test/jobs/1",
            "crawled_at": "2026-07-16T00:00:00",
        }

        self.assertEqual(RAW_JOBS.upsert_raw_jobs(engine, [record]), 1)
        self.assertEqual(engine.begin_count, 1)
        self.assertEqual(len(engine.connection.calls), 2)

        upsert_sql, params = engine.connection.calls[1]
        self.assertIn("embedding = CASE", upsert_sql)
        self.assertIn("IS DISTINCT FROM", upsert_sql)
        self.assertIn(
            "crawled_at = COALESCE(raw_jobs.crawled_at, EXCLUDED.crawled_at)",
            upsert_sql,
        )
        self.assertEqual(params, [record])


if __name__ == "__main__":  # pragma: no cover
    unittest.main()
