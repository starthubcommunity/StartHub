"""Yayın akışında görsel kullanım kaydı: yazı eklenemezse hiçbir sayaç değişmez."""
import pytest

pytest.importorskip("supabase")

import publish  # noqa: E402


class FakeResult:
    def __init__(self, data):
        self.data = data


class FakeTable:
    def __init__(self, name, fail_insert):
        self.name = name
        self.fail_insert = fail_insert
        self.pending = None

    def insert(self, record):
        self.pending = ("insert", record)
        return self

    def update(self, record):
        self.pending = ("update", record)
        return self

    def select(self, *_a, **_k):
        return self

    def eq(self, *_a, **_k):
        return self

    def execute(self):
        if self.pending and self.pending[0] == "insert" and self.name == "posts" and self.fail_insert:
            raise RuntimeError("insert reddedildi")
        return FakeResult([{"id": 42}])


class FakeClient:
    def __init__(self, fail_insert):
        self.fail_insert = fail_insert

    def table(self, name):
        return FakeTable(name, self.fail_insert)


ARTICLE = {
    "slug": "test-yazi", "title_tr": "Başlık", "excerpt_tr": "Özet", "body_tr": ["Paragraf."],
    "category": "Teknoloji", "tag": "gundem",
}
MATCH = {"url": "https://example.test/x.webp", "alt_tr": "x", "id": 7, "usage_count": 3,
         "needs_review": False, "score": 5.0, "reason": {"mode": "test"}}


def _run(monkeypatch, fail_insert):
    calls = []
    monkeypatch.setattr(publish, "_client", lambda: FakeClient(fail_insert))
    monkeypatch.setattr(publish, "find_best_image", lambda article, client, dry_run=False: MATCH)
    monkeypatch.setattr(publish, "_record_image_usage", lambda match, post_id: calls.append((match["id"], post_id)))
    monkeypatch.setattr(publish, "_trigger_deploy_hook", lambda: None)
    row = publish.publish_article(dict(ARTICLE), dry_run=False, auto_publish=False)
    return row, calls


def test_usage_not_recorded_when_post_insert_fails(monkeypatch):
    row, calls = _run(monkeypatch, fail_insert=True)
    assert row is None
    assert calls == []


def test_usage_recorded_once_after_successful_insert(monkeypatch):
    row, calls = _run(monkeypatch, fail_insert=False)
    assert row == {"id": 42}
    assert calls == [(7, 42)]
