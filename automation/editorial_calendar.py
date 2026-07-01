"""
editorial_calendar.py — Google Sheets "Start-Hub Yayın Planı" editöryel takvim.

Sayfa sütunları (başlık satırı zorunlu):
    id | title | slug | category | planned_date | status | source_url | content_file | content

status akışı: draft -> approved -> published
- draft    : Gemini üretti, editör henüz görmedi
- approved : Editör onayladı, bir sonraki publish adımında Supabase'e yazar
- published: Supabase'e yazıldı

content sütunu: üretilen makalenin tam JSON'u — publish adımında buradan okunur.
"""
import json
import datetime
import gspread
from google.oauth2.service_account import Credentials
from config import SHEET_NAME, GOOGLE_SHEETS_CREDENTIALS

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
]


def _client():
    if not GOOGLE_SHEETS_CREDENTIALS or GOOGLE_SHEETS_CREDENTIALS.startswith("{\"type\":\"service_account\",\"project_id\":\".."):
        raise ValueError(
            "GOOGLE_SHEETS_CREDENTIALS ayarlanmamış. "
            ".env dosyasına servis hesabı JSON'unu ekle."
        )
    # Çok satırlı yapıştırma kontrolü — gerçek newline karakteri varsa .env formatı bozuktur
    if "\n" in GOOGLE_SHEETS_CREDENTIALS and GOOGLE_SHEETS_CREDENTIALS.strip().startswith("{"):
        raise ValueError(
            "GOOGLE_SHEETS_CREDENTIALS .env'de birden fazla satıra yayılmış.\n"
            "Düzeltmek için:\n"
            "  python -c \"import json,sys; print(json.dumps(json.load(open('service-account.json'))))\"\n"
            "çıktısını tek satır olarak .env'e şu formatta yaz:\n"
            "  GOOGLE_SHEETS_CREDENTIALS='{...tüm json tek satırda...}'"
        )
    try:
        info = json.loads(GOOGLE_SHEETS_CREDENTIALS)
    except json.JSONDecodeError as e:
        raise ValueError(
            f"GOOGLE_SHEETS_CREDENTIALS geçerli JSON değil: {e}\n"
            "En sık neden: .env'de değer birden fazla satıra yayılmış.\n"
            "Çözüm: değeri tek satıra sıkıştır ve tek tırnak içine al:\n"
            "  GOOGLE_SHEETS_CREDENTIALS='{\"type\":\"service_account\",...}'"
        ) from e
    # Env variable üzerinden geçen private_key'de \n literal olarak gelebilir.
    if "private_key" in info:
        info["private_key"] = info["private_key"].replace("\\n", "\n")
    creds = Credentials.from_service_account_info(info, scopes=SCOPES)
    return gspread.authorize(creds)


def _sheet():
    return _client().open(SHEET_NAME).sheet1


def add_draft(article: dict) -> None:
    """Yeni üretilen makaleyi takvime 'draft' olarak ekler."""
    ws = _sheet()
    rows = ws.get_all_records()
    next_id = (max([int(r.get("id", 0)) for r in rows], default=0) + 1) if rows else 1

    display_title = article.get("title_tr") or article.get("title", "")

    ws.append_row([
        next_id,
        display_title,                           # title — okunabilirlik için
        article["slug"],                         # slug
        article.get("category", "Teknoloji"),    # category
        datetime.date.today().isoformat(),       # planned_date
        "draft",                                 # status
        article.get("source_url", ""),           # source_url
        "",                                      # content_file (kullanılmıyor)
        json.dumps(article, ensure_ascii=False), # content — tam makale JSON
    ])
    print(f"[takvim] draft eklendi: {display_title}")


def get_approved() -> list[dict]:
    """status == 'approved' olan satırları döndürür."""
    ws = _sheet()
    return [r for r in ws.get_all_records()
            if str(r.get("status", "")).strip().lower() == "approved"]


def get_by_slug(slug: str) -> dict | None:
    """Verilen slug'a ait takvim satırını döndürür (yoksa None)."""
    ws = _sheet()
    for r in ws.get_all_records():
        if r.get("slug") == slug:
            return r
    return None


def update_draft(article: dict) -> bool:
    """Var olan taslağın içeriğini yeniden üretilen makaleyle günceller."""
    ws = _sheet()
    rows = ws.get_all_records()
    if not rows:
        return False
    header = list(rows[0].keys())
    for i, r in enumerate(rows, start=2):
        if r.get("slug") != article["slug"]:
            continue
        updates = {
            "title":    article.get("title_tr") or article.get("title", r.get("title", "")),
            "category": article.get("category", r.get("category", "Teknoloji")),
            "content":  json.dumps(article, ensure_ascii=False),
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
    for i, r in enumerate(rows, start=2):
        if r.get("slug") == slug:
            status_col = list(r.keys()).index("status") + 1
            ws.update_cell(i, status_col, "published")
            print(f"[takvim] published: {slug}")
            return
    print(f"[uyarı] slug takvimde bulunamadı: {slug}")
