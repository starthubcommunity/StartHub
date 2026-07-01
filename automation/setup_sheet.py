"""
setup_sheet.py — Google Sheets editöryel takvimini sıfırdan kurar.

Yapılanlar:
  1. 1. satıra doğru sütun başlıklarını yazar
  2. Başlık satırını kalın + koyu arka plan yapar
  3. 1. satırı dondurur (freeze)
  4. Sütun genişliklerini ayarlar
  5. status sütununa koşullu biçimlendirme ekler
     draft=sarı, approved=yeşil, published=gri

Kullanım:
    python automation/setup_sheet.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

import editorial_calendar as ec

HEADERS = [
    "id",
    "title",
    "slug",
    "category",
    "planned_date",
    "status",
    "source_url",
    "content_file",
    "content",
]

# Sütun genişlikleri (piksel) — 0 tabanlı indeks
COL_WIDTHS = {
    0: 55,    # id
    1: 320,   # title
    2: 220,   # slug
    3: 110,   # category
    4: 120,   # planned_date
    5: 110,   # status
    6: 260,   # source_url
    7: 90,    # content_file
    8: 480,   # content
}


def setup_sheet():
    print("Google Sheets'e baglaniliyor...")
    ws = ec._sheet()
    ss = ws.spreadsheet
    sheet_id = ws.id
    print(f"  Baglanti OK — '{ws.title}' (sheetId={sheet_id})")

    # 1) Baslik satirini yaz
    ws.update(range_name="A1:I1", values=[HEADERS])
    print("  Basliklar yazildi.")

    # Tüm biçimlendirme + boyut ayarlarını tek batch ile gönder
    requests = []

    # 2) Başlık satırı biçimlendirme: kalın, beyaz yazı, lacivert zemin
    requests.append({
        "repeatCell": {
            "range": {
                "sheetId": sheet_id,
                "startRowIndex": 0, "endRowIndex": 1,
                "startColumnIndex": 0, "endColumnIndex": len(HEADERS),
            },
            "cell": {
                "userEnteredFormat": {
                    "textFormat": {
                        "bold": True,
                        "foregroundColor": {"red": 1.0, "green": 1.0, "blue": 1.0},
                    },
                    "backgroundColor": {"red": 0.13, "green": 0.24, "blue": 0.49},
                    "verticalAlignment": "MIDDLE",
                }
            },
            "fields": "userEnteredFormat(textFormat,backgroundColor,verticalAlignment)",
        }
    })

    # 3) Satır 1'i dondur
    requests.append({
        "updateSheetProperties": {
            "properties": {
                "sheetId": sheet_id,
                "gridProperties": {"frozenRowCount": 1},
            },
            "fields": "gridProperties.frozenRowCount",
        }
    })

    # 4) Sütun genişlikleri
    for col_idx, px in COL_WIDTHS.items():
        requests.append({
            "updateDimensionProperties": {
                "range": {
                    "sheetId": sheet_id,
                    "dimension": "COLUMNS",
                    "startIndex": col_idx,
                    "endIndex": col_idx + 1,
                },
                "properties": {"pixelSize": px},
                "fields": "pixelSize",
            }
        })

    # 5) status sütunu (F = index 5) koşullu biçimlendirme
    status_range = {
        "sheetId": sheet_id,
        "startRowIndex": 1,       # veri 2. satırdan başlar
        "startColumnIndex": 5,    # F sütunu
        "endColumnIndex": 6,
    }
    cond_rules = [
        # draft → sarı
        ("draft",     {"red": 1.0, "green": 0.95, "blue": 0.4}),
        # approved → yeşil
        ("approved",  {"red": 0.72, "green": 0.93, "blue": 0.70}),
        # published → açık gri
        ("published", {"red": 0.85, "green": 0.85, "blue": 0.85}),
    ]
    for i, (value, bg) in enumerate(cond_rules):
        requests.append({
            "addConditionalFormatRule": {
                "rule": {
                    "ranges": [status_range],
                    "booleanRule": {
                        "condition": {
                            "type": "TEXT_EQ",
                            "values": [{"userEnteredValue": value}],
                        },
                        "format": {"backgroundColor": bg},
                    },
                },
                "index": i,
            }
        })

    ss.batch_update({"requests": requests})
    print("  Bicimlendirme, dondurma, sutun genislikleri ve kosullu renkler uygulanidi.")
    print()
    print("Kurulum tamamlandi! Google Sheets'i ac ve kontrol et.")
    print(f"Sayfa adi: {ec.SHEET_NAME}")


if __name__ == "__main__":
    setup_sheet()
