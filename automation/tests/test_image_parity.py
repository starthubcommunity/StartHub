"""Python ↔ JS parite testi: skorlar, sıralama, elenme nedenleri ve seçim, tests/fixtures/image_parity.json'a göre.

Aynı fixture src/admin/image-score.test.mjs tarafından da okunur. İki taraf da burada yazılı
beklentiyi vermeli; biri değişip diğeri değişmezse ikisi de kırılır.
"""
import json
import os
from datetime import datetime

import image_matcher as im

FIXTURE = os.path.join(os.path.dirname(__file__), "fixtures", "image_parity.json")
TOL = 0.011  # JS ve Python yuvarlamayı farklı yapabilir (banker's rounding); 2 ondalık tolerans


def _load():
    with open(FIXTURE, encoding="utf-8") as f:
        fx = json.load(f)
    now = datetime.fromisoformat(fx["now"])
    history = [dict(h, used_at=datetime.fromisoformat(h["used_at"])) for h in fx["history"]]
    return fx, now, history


def test_fixture_covers_enough_cases():
    fx, _, _ = _load()
    assert len(fx["articles"]) >= 6
    assert len(fx["images"]) >= 10


def test_scores_match_expected():
    fx, now, history = _load()
    for art in fx["articles"]:
        exp = fx["expected"][art["name"]]
        text = im.build_text(art)
        scored = im.score_all(text, art["category"], fx["images"], history, now)
        for img_id, expected in exp["scores"].items():
            got = scored[int(img_id)][0]
            assert abs(round(got, 2) - expected) <= TOL, (art["name"], img_id, got, expected)


def test_ranking_matches_expected():
    fx, now, history = _load()
    for art in fx["articles"]:
        exp = fx["expected"][art["name"]]
        rank = im.rank_all(im.build_text(art), art["category"], fx["images"], history, now)
        assert [i for i, _ in rank] == exp["ranking"], art["name"]


def test_flags_match_expected():
    fx, now, history = _load()
    for art in fx["articles"]:
        exp = fx["expected"][art["name"]]
        flags = im.image_flags(im.build_text(art), art["category"], fx["images"], history, now)
        got = {str(k): sorted(v) for k, v in flags.items()}
        assert got == exp["flags"], art["name"]


def test_pick_matches_expected():
    fx, now, history = _load()
    for art in fx["articles"]:
        exp = fx["expected"][art["name"]]
        res = im.select_image(im.build_text(art), art["category"], fx["images"], history, now)
        assert res["image"]["id"] == exp["pick"], art["name"]
