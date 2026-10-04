"""
dry_run_matcher.py — Son yayınlanan N yazıya ESKİ ve YENİ görsel algoritmasını
sırayla uygular ve karşılaştırma raporu basar. DB'ye YAZMAZ (salt okuma).

Kullanım:  cd automation && python dry_run_matcher.py [N=50] [sınıflandırma.json]

Not: posts tablosunda kategori kolonu yok; makale kategorisi, kart arka
plan rengi (bg) üzerinden tahmin edilir (publish.CATEGORY_BG'nin tersi).
"""
import sys
from collections import Counter
from datetime import datetime, timezone

from supabase import create_client

import config
import image_matcher as im

BG_TO_CATEGORY = {
    "var(--green-light)": "Yatırım",
    "var(--purple-light)": "AI",
    "var(--blue-light)": "Teknoloji",
    "var(--orange-light)": "Teknoloji",
}


VISUAL_RULES = [
    (("el sikisma", "sozlesme", "imza"), "el_sikisma"),
    (("tablet", "laptop", "akilli telefon", "cihaz"), "cihaz_telefon"),
    (("robot", "yapay zeka", "ai"), "robot_ai"),
    (("cip", "islemci", "devre karti", "donanim"), "cip_donanim"),
    (("kod", "yazilim", "programlama", "kodlama"), "kod_ekran"),
    (("borsa", "grafik"), "grafik_borsa"),
    (("para", "finans", "fintech", "banka"), "para_finans"),
    (("veri", "big data", "sunucu", "veri merkezi"), "veri_merkezi"),
    (("ofis", "toplanti"), "ofis_toplanti"),
]


def draft_classify(img):
    """Yalnızca dry-run için bellekte taslak sınıflandırma (DB'ye yazmaz).
    visual_type/is_generic kolonları henüz canlıda yoksa kullanılır."""
    if img.get("visual_type") is not None:
        return img
    tags = [im._tag_norm(t) for t in (img.get("tags") or [])]
    joined = " ".join(tags)
    vt = "soyut_diger"
    for keys, t in VISUAL_RULES:
        if any(k in joined for k in keys):
            vt = t
            break
    generic = {im._tag_norm(g) for g in config.GENERIC_TAGS}
    is_generic = vt == "el_sikisma" or (tags and all(t in generic for t in tags))
    return dict(img, visual_type=vt, is_generic=bool(is_generic))


def _article_from_post(p):
    return {
        "title_tr": p.get("title_tr") or "",
        "excerpt_tr": p.get("excerpt_tr") or "",
        "body_tr": p.get("body_tr") or [],
        "category": BG_TO_CATEGORY.get(p.get("bg") or "", "Teknoloji"),
    }


def _parse_date(p):
    raw = p.get("published_at") or p.get("generated_at") or (p.get("date") and p["date"] + "T00:00:00+00:00")
    return im._parse_ts(raw) if raw else datetime.now(timezone.utc)


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 50
    client = create_client(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY)

    images = client.table("image_stock").select("*").order("id").execute().data or []
    if len(sys.argv) > 2:
        import json
        with open(sys.argv[2], encoding="utf8") as fh:
            cls = json.load(fh)
        images = [dict(i, **cls[str(i["id"])]) if str(i["id"]) in cls else i for i in images]
    images = [draft_classify(i) for i in images]
    posts = (client.table("posts").select("*").eq("status", "published")
             .order("date", desc=True).limit(n).execute().data or [])
    posts.reverse()  # eskiden yeniye simüle et

    by_id = {i["id"]: i for i in images}
    old_usage = {i["id"]: i.get("usage_count") or 0 for i in images}
    old_picks, new_picks = [], []
    new_history = []
    relax_hits = Counter()
    generic_picks = 0
    specific_new = Counter()

    for p in posts:
        article = _article_from_post(p)
        text = im.build_text(article)
        when = _parse_date(p)

        old = im._legacy_pick(text, article["category"], [dict(i, usage_count=old_usage[i["id"]]) for i in images])
        old_usage[old["id"]] = old_usage.get(old["id"], 0) + 1
        old_picks.append((p.get("slug", "?"), old["id"], article["category"]))

        hist = sorted(new_history, key=lambda h: h["used_at"], reverse=True)
        res = im.select_image(text, article["category"], images, hist, when)
        img = res["image"]
        new_history.append({"image_id": img["id"], "post_id": p.get("id"), "used_at": when})
        new_picks.append((p.get("slug", "?"), img["id"], article["category"], res))
        for f in res["reason"]["filters_relaxed"]:
            relax_hits[f] += 1
        if img.get("is_generic"):
            generic_picks += 1
        specific_new[img["id"]] += 1

    print(f"Yazı sayısı: {len(posts)} | Stok: {len(images)} görsel")
    print(f"Farklı görsel — ESKİ: {len(set(x[1] for x in old_picks))} | YENİ: {len(specific_new)}")

    print("\nEN ÇOK KULLANILAN 5 (YENİ):")
    for img_id, c in specific_new.most_common(5):
        i = by_id[img_id]
        print(f"  {c}× id={img_id} cat={i.get('category')} tip={i.get('visual_type')} generic={i.get('is_generic')}")

    el = [x for x in new_picks if x[3]["image"].get("visual_type") == "el_sikisma" or x[3]["image"].get("is_generic")]
    print(f"\nel_sıkışma/is_generic seçimi — YENİ: {len(el)} / {len(new_picks)}; generic seçim: {generic_picks}")
    eld = [x for x in old_picks if (by_id[x[1]].get("visual_type") == "el_sikisma") or (by_id[x[1]].get("is_generic"))]
    print(f"el_sıkışma/is_generic seçimi — ESKİ: {len(eld)} / {len(old_picks)}")

    print(f"\nFiltre gevşetme tetiklenme sayısı (YENİ): {dict(relax_hits) or 0}")

    print("\nKATEGORİ UYUM ORANI (YENİ; seçilen görsel makalenin kategorisi/alias'ı):")
    fit_by_cat = {}
    for (slug, _, cat, res) in new_picks:
        img = res["image"]
        ok = im._is_same_category(cat, img.get("category") or "")
        f, t = fit_by_cat.get(cat, (0, 0))
        fit_by_cat[cat] = (f + int(ok), t + 1)
    for cat, (f, t) in sorted(fit_by_cat.items()):
        print(f"  {cat}: {f}/{t} ({100 * f / t:.0f}%)")

    print("\nYATIRIM (bg=yeşil) yazılarında seçilen görseller:")
    dist = Counter()
    for (slug, _, cat, res) in new_picks:
        if cat == "Yatırım":
            img = res["image"]
            dist[(img.get("category"), img.get("visual_type"), bool(img.get("is_generic")))] += 1
    for (c, vt, g), n in dist.most_common():
        print(f"  {n}x kategori={c} tip={vt} klişe={g}")

    print("\nÖRNEK 10 YAZI — ESKİ vs YENİ:")
    for (slug, old_id, cat), (_, new_id, _, res) in list(zip(old_picks, new_picks))[-10:]:
        print(f"  [{cat}] {slug[:60]}")
        print(f"     ESKİ id={old_id} | YENİ id={new_id} skor={res['score']} gevşetilen={res['reason']['filters_relaxed']}")


if __name__ == "__main__":
    main()
