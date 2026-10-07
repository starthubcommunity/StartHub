"""Görsel eşleştirme testleri — canlı DB gerektirmez, sahte stok ve kullanım geçmişi kullanır."""
from datetime import datetime, timedelta, timezone

import image_matcher as im

NOW = datetime(2026, 10, 4, 12, 0, tzinfo=timezone.utc)


def img(i, category="Teknoloji", tags=(), visual_type=None, is_generic=False, usage_count=0):
    return {
        "id": i,
        "url": f"https://example.test/{i}.webp",
        "alt_tr": f"görsel {i}",
        "category": category,
        "tags": list(tags),
        "visual_type": visual_type,
        "is_generic": is_generic,
        "usage_count": usage_count,
    }


def use(image_id, hours_ago):
    return {"image_id": image_id, "post_id": None, "used_at": NOW - timedelta(hours=hours_ago)}


def text(s):
    return im.normalize(s)


def test_tech_does_not_match_biotech_and_ai_does_not_match_inside_words():
    images = [img(1, tags=["tech", "ai"])]
    res = im.select_image(text("Biotech sirketi yeni aile plani acikladi"), "Teknoloji", images, [], NOW)
    assert res["reason"]["best"]["tags"] == []


def test_word_boundary_match_counts():
    images = [img(1, tags=["robot"]), img(2, tags=["yatirim"])]
    res = im.select_image(text("Robot sirketi yeni tur acti"), "Teknoloji", images, [], NOW)
    matched = [t["tag"] for t in res["reason"]["best"]["tags"]]
    assert matched == ["robot"]
    assert res["image"]["id"] == 1


def test_generic_image_not_picked_when_specific_match_is_strong():
    images = [
        img(1, category="Teknoloji", tags=["kripto", "blokzincir"], visual_type="kod_ekran"),
        img(2, category="Teknoloji", tags=["anlasma", "yatirim"], visual_type="el_sikisma", is_generic=True),
    ]
    res = im.select_image(text("Kripto ve blokzincir yatirim anlasmasi"), "Teknoloji", images, [], NOW)
    assert res["image"]["id"] == 1
    assert "generic_excluded" in res["reason"]["filters_applied"]


def test_handshake_image_can_win_on_partnership_topic():
    images = [
        img(1, category="Girişim", tags=["ortaklik", "anlasma"], visual_type="el_sikisma", is_generic=True),
        img(2, category="Girişim", tags=["ofis", "ekip", "toplanti"], visual_type="ofis_toplanti"),
    ]
    # img(2) aynı kategoride klişe olmayan bir aday olduğu için normalde el sıkışma elenirdi.
    # Haberde "ortaklık"/"anlaşma" geçtiği için artık elenmeden eşit şartlarda yarışıyor ve
    # kendi güçlü etiket eşleşmesiyle kazanıyor.
    res = im.select_image(
        text("İki şirket ortaklık anlaşması için toplantı yaptı"), "Girişim", images, [], NOW
    )
    assert res["image"]["id"] == 1
    assert "generic_excluded" not in res["reason"]["filters_applied"]


def test_handshake_image_still_excluded_on_unrelated_investment_topic():
    images = [
        img(1, category="Fon", tags=["ortaklik", "anlasma"], visual_type="el_sikisma", is_generic=True),
        img(2, category="Fon", tags=["grafik", "borsa", "hisse"], visual_type="grafik_borsa"),
    ]
    # Haberde ortaklık/anlaşma kelimeleri yok — "son çare" kuralı eskisi gibi çalışır, uygun
    # spesifik bir aday varken el sıkışma elenir.
    res = im.select_image(text("Borsa hisse grafik haberi"), "Yatırım", images, [], NOW)
    assert res["image"]["id"] == 2
    assert "generic_excluded" in res["reason"]["filters_applied"]


def test_handshake_excluded_even_with_low_score_alternative():
    images = [
        img(1, category="Fon", tags=[], visual_type="para_finans"),
        img(2, category="Fon", tags=["ortaklik", "anlasma"], visual_type="el_sikisma", is_generic=True),
    ]
    # "Arcee AI değerleme" tarzı bir haber: ortaklık/anlaşma kelimesi geçmiyor, img(1)'in konu
    # uyumu zayıf (yalnızca alias kategori puanı, hiç etiket eşleşmesi yok). Eski kuralda bu
    # düşük puan eşiği (MIN_SPECIFIC_SCORE) geçemediği için el sıkışma seçilebiliyordu. Artık
    # puana bakılmıyor — aynı kategoride klişe olmayan BİR aday var olması yeterli, el sıkışma
    # elenir.
    res = im.select_image(
        text("Arcee AI 1 milyar dolar değerleme açık ağırlıklı modeller"), "Yatırım", images, [], NOW
    )
    assert res["image"]["id"] == 1
    assert "generic_excluded" in res["reason"]["filters_applied"]


def test_generic_image_allowed_when_no_specific_match():
    images = [
        img(1, category="Teknoloji", tags=["robot"], visual_type="robot_ai"),
        img(2, category="Fon", tags=["yatirim"], visual_type="el_sikisma", is_generic=True),
    ]
    res = im.select_image(text("Yatirim turu acildi"), "Yatırım", images, [], NOW)
    assert res["image"]["id"] == 2
    assert res["reason"]["generic_allowed"] is True


def test_recent_post_image_is_excluded_and_relaxes_when_no_alternative():
    images = [img(1, tags=["robot"]), img(2, tags=["robot"])]
    res = im.select_image(text("robot haberi"), "Teknoloji", images, [use(1, 1)], NOW)
    assert res["image"]["id"] == 2
    assert "recent_posts" in res["reason"]["filters_applied"]

    only = [img(1, tags=["robot"])]
    res2 = im.select_image(text("robot haberi"), "Teknoloji", only, [use(1, 1)], NOW)
    assert res2["image"]["id"] == 1
    assert "recent_posts" in res2["reason"]["filters_relaxed"]
    assert res2["relaxed_count"] >= 1


def test_category_fit_beats_stronger_off_category_image():
    images = [
        img(1, category="Teknoloji", tags=["xyz"]),
        img(2, category="Genel", tags=["robot", "yapay zeka"]),
    ]
    res = im.select_image(text("Robot ve yapay zeka haberi"), "Teknoloji", images, [], NOW)
    assert res["image"]["id"] == 1
    assert "category_fit" in res["reason"]["filters_applied"]


def test_category_fit_relaxes_when_no_fitting_image_exists():
    images = [img(1, category="Genel", tags=["robot"]), img(2, category="Fon", tags=["yatirim"])]
    res = im.select_image(text("robot haberi"), "Teknoloji", images, [], NOW)
    assert res["image"]["id"] == 1
    assert "category_fit" in res["reason"]["filters_relaxed"]


def test_visual_window_scales_with_stock_size():
    assert im.visual_window(47) == 3
    assert im.visual_window(70) == 4
    assert im.visual_window(150) == 6


def test_same_visual_type_not_repeated_within_window():
    images = [
        img(1, tags=["robot"], visual_type="el_sikisma"),
        img(2, tags=["robot"], visual_type="el_sikisma"),
        img(3, tags=["robot"], visual_type="grafik_borsa"),
    ]
    history = [use(1, h) for h in range(1, 7)]
    res = im.select_image(text("robot haberi"), "Teknoloji", images, history, NOW)
    assert res["image"]["visual_type"] != "el_sikisma"
    assert res["image"]["id"] == 3


def test_same_input_gives_same_result():
    images = [img(i, tags=["robot", "yapay zeka"], visual_type="robot_ai", usage_count=i) for i in range(1, 6)]
    history = [use(2, 5), use(4, 30)]
    a = im.select_image(text("yapay zeka robot haberi"), "AI", images, history, NOW)
    b = im.select_image(text("yapay zeka robot haberi"), "AI", images, history, NOW)
    assert a == b


def test_tie_break_prefers_least_recently_used_then_id():
    images = [img(1, tags=["robot"]), img(2, tags=["robot"])]
    history = [use(1, 200)]
    res = im.select_image(text("robot haberi"), "Teknoloji", images, history, NOW)
    assert res["image"]["id"] == 2


def test_teknoloji_articles_accept_saas_ecommerce_saglik_images_as_alias():
    for alias_category in ("SaaS", "E-Ticaret", "Sağlık"):
        images = [img(1, category=alias_category, tags=["xyz"])]
        res = im.select_image(text("teknoloji haberi"), "Teknoloji", images, [], NOW)
        assert res["image"]["id"] == 1
        assert "category_fit" not in res["reason"]["filters_relaxed"]
        assert res["reason"]["best"]["category"] == im.config.CATEGORY_ALIAS_BONUS


def test_generic_kept_when_strong_specific_is_in_other_category():
    images = [
        img(1, category="Teknoloji", tags=["kripto", "blokzincir"], visual_type="kod_ekran"),
        img(2, category="Fon", tags=["yatirim"], visual_type="el_sikisma", is_generic=True),
    ]
    res = im.select_image(text("Kripto ve blokzincir yatirim haberi"), "Yatırım", images, [], NOW)
    assert "generic_excluded" not in res["reason"]["filters_applied"]
    assert res["reason"]["generic_allowed"] is True
