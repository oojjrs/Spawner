import runpy
import sys
from pathlib import Path


folder = Path(__file__).resolve().parent / 'DrawnV11'
sys.dont_write_bytecode = True
sys.path.insert(0, str(folder))
runpy.run_path(str(folder / 'render.py'), None, '__main__')
