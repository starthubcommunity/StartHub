"""
editorial_calendar.py — Google Sheets "Start-Hub Yayın Planı" ile editöryel takvim.

Sayfa sütunları (başlık satırı zorunlu, bu sırayla):
    id | title_tr | slug | category | tag | planned_date | status | source | source_url | uygunluk | content_json

status akışı:  draft → approved → published
Sistem SADECE status == 'approved' satırları yayınlar.
content_json: tam makale dict'i (JSON string) — publish adımında Supabase'e aktarılır.
"""
import json
import datetime
import gspread
from google.oauth2.service_account import Credentials
from config import SHEET_NAME, GOOGLE_SHEETS_CREDENTIALS

SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]

COLUMNS = ["id", "title_tr", "slug", "category", "tag",
           "planned_date", "status", "source", "source_url",
           "uygunluk", "content_json"]


def _client():
    info = json.loads(GOOGLE_SHEETS_CREDENTIALS)
    creds = Credentials.from_service_account_info(info, scopes=SCOPES)
    return gspread.authorize(creds)


def _sheet():
    return _client().open(SHEET_NAME).sheet1


def add_draft(article: dict) -> None:
    """Yeni üretilen makaleyi takvime 'draft' olarak ekler."""
    ws = _sheet()
    rows = ws.get_all_records()
    next_id = (max([int(r.get("id", 0)) for r in rows if str(r.get("id", "")).isdigit()],
                   default=0) + 1) if rows else 1

    ws.append_row([
        next_id,
        article.get("title_tr", ""),
        article.get("slug", ""),
        article.get("category", "Teknoloji"),
        article.get("tag", "gundem"),
        datetime.date.today().isoformat(),
        "draft",
        article.get("source", ""),
        article.get("source_url", ""),
        article.get("uygunluk_skoru", ""),
        json.dumps(article, ensure_ascii=False),   # tam veri — publish'te kullanılır
    ])
    print(f"[takvim] draft eklendi: {article.get('title_tr', article.get('slug'))}")


def get_approved() -> list[dict]:
    """status == 'approved' olan satırları döndürür; content_json parse edilmiş halde."""
    ws = _sheet()
    approved = []
    for r in ws.get_all_records():
        if str(r.get("status", "")).strip().lower() != "approved":
            continue
        # content_json'dan tam makaleyi geri yükle
        try:
            full = json.loads(r.get("content_json") or "{}")
        except json.JSONDecodeError:
            full = {}
        # Sheets'teki alanlar JSON'dan önceliklidir (editör düzenlemiş olabilir)
        full.update({
            "slug":     r.get("slug", full.get("slug", "")),
            "title_tr": r.get("title_tr", full.get("title_tr", "")),
            "category": r.get("category", full.get("category", "Teknoloji")),
            "tag":      r.get("tag", full.get("tag", "gundem")),
            "source":   r.get("source", full.get("source", "")),
            "source_url": r.get("source_url", full.get("source_url", "")),
        })
        approved.append(full)
    return approved


def get_by_slug(slug: str) -> dict | None:
    """Verilen slug'a ait takvim satırını döndürür (yoksa None)."""
    ws = _sheet()
    for r in ws.get_all_records():
        if r.get("slug") == slug:
            return r
    return None


def update_draft(article: dict) -> bool:
    """
    Var olan bir taslağın içeriğini yeniden üretilen makaleyle günceller.
    'regenerate' modunda kullanılır.
    """
    ws = _sheet()
    rows = ws.get_all_records()
    if not rows:
        return False
    header = list(rows[0].keys())
    for i, r in enumerate(rows, start=2):
        if r.get("slug") != article["slug"]:
            continue
        updates = {
            "title_tr":    article.get("title_tr", r.get("title_tr", "")),
            "category":    article.get("category", r.get("category", "Teknoloji")),
            "tag":         article.get("tag", r.get("tag", "gundem")),
            "uygunluk":    article.get("uygunluk_skoru", r.get("uygunluk", "")),
            "content_json": json.dumps(article, ensure_ascii=False),
        }
        for col_name, val in updates.items():
            if col_name in header:
                ws.update_cell(i, header.index(col_name) + 1, val)
        print(f"[takvim] taslak yeniden üretildi: {article['slug']}")
        return True
    print(f"[uyarı] yeniden üretilecek slug takvimde bulunamadı: {article['slug']}")
    return False


def mark_published(slug: str) -> None:
    """İlgili slug satırının status'unu 'published' yapar."""
    ws = _sheet()
    rows = ws.get_all_records()
    if not rows:
        return
    header = list(rows[0].keys())
    for i, r in enumerate(rows, start=2):
        if r.get("slug") == slug:
            if "status" in header:
                ws.update_cell(i, header.index("status") + 1, "published")
            print(f"[takvim] published: {slug}")
            return
    print(f"[uyarı] slug takvimde bulunamadı: {slug}")
