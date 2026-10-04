import os
import sys

AUTOMATION_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if AUTOMATION_DIR not in sys.path:
    sys.path.insert(0, AUTOMATION_DIR)
