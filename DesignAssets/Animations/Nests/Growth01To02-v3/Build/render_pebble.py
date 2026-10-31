from pathlib import Path
import runpy
import sys
path=Path(__file__).with_name('render_supported_v8.py')
sys.argv=[str(path),'pebble',str(path.parent.parent)]
runpy.run_path(sys.argv[0],None,'__main__')
