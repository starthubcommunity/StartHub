"""
check_recent_matches.py — Son N gerçek (backfill olmayan) görsel seçimini tablo olarak yazdırır.
Salt okuma: DB'ye hiçbir şey yazmaz.

Kullanım:  cd automation && python check_recent_matches.py [N=10]
"""
import sys

sys.stdout.reconfigure(encoding="utf-8")

from supabase import create_client

import config


def main():
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 10
    client = create_client(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY)

    usage = (client.table("image_usage")
             .select("image_id, post_id, used_at, score, reason")
             .order("used_at", desc=True)
             .limit(n * 5)
             .execute().data or [])
    usage = [u for u in usage if (u.get("reason") or {}).get("backfill") is not True][:n]

    if not usage:
        print("Backfill olmayan kayıt yok — henüz gerçek bir otomatik seçim yapılmamış.")
        return

    image_ids = sorted({u["image_id"] for u in usage})
    post_ids = sorted({u["post_id"] for u in usage if u.get("post_id")})
    images = {r["id"]: r for r in (client.table("image_stock")
              .select("id, url, category, visual_type, is_generic").in_("id", image_ids)
              .execute().data or [])}
    posts = {r["id"]: r for r in (client.table("posts")
             .select("id, slug, needs_review").in_("id", post_ids).execute().data or [])} if post_ids else {}

    header = ("used_at", "post", "image", "kategori", "tip", "klişe", "skor", "gevşeme", "manuel", "needs_review")
    rows = []
    for u in usage:
        reason = u.get("reason") or {}
        img = images.get(u["image_id"], {})
        post = posts.get(u.get("post_id"), {})
        rows.append((
            str(u.get("used_at", ""))[:16],
            (post.get("slug") or str(u.get("post_id")))[:28],
            f"#{u['image_id']}",
            img.get("category") or "—",
            img.get("visual_type") or "—",
            "evet" if img.get("is_generic") else "hayır",
            f"{u.get('score')}" if u.get("score") is not None else "—",
            ",".join(reason.get("filters_relaxed") or []) or "—",
            "evet" if reason.get("manual") else "hayır",
            "EVET" if post.get("needs_review") else "hayır",
        ))

    widths = [max(len(str(x)) for x in col) for col in zip(header, *rows)]
    fmt = "  ".join("{:<" + str(w) + "}" for w in widths)
    print(fmt.format(*header))
    print(fmt.format(*["-" * w for w in widths]))
    for r in rows:
        print(fmt.format(*r))

    print("\nİlk aday ayrıntısı (son kayıt):")
    last = usage[0].get("reason") or {}
    print(f"  en iyi: {last.get('best')}")
    print(f"  ilk 3: {last.get('top3')}")


if __name__ == "__main__":
    main()
