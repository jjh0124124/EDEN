"""Compatibility entry point: BUILD18 replaces charged K with finite parry.
The current control/impact regression coverage is in overdrive_smoke.py.
"""
import runpy
from pathlib import Path
runpy.run_path(str(Path(__file__).with_name('overdrive_smoke.py')),run_name='__main__')
