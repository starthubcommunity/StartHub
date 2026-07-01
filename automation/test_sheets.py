"""
test_sheets.py — Google Sheets bağlantısını Gemini'ye dokunmadan test eder.
Kullanım: python automation/test_sheets.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

import editorial_calendar as ec

try:
    ws = ec._sheet()
    rows = ws.get_all_records()
    print(f"[OK] Baglanti basarili -- '{ws.title}' sayfasi okundu, {len(rows)} satir var.")
except Exception as e:
    print(f"[HATA] Baglanti basarisiz: {e}")
