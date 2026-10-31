from pathlib import Path
import runpy
import sys
path=Path(__file__).with_name('render_spring_quantum_v9.py')
sys.argv=[str(path),str(path.parent.parent/'spring')]
runpy.run_path(sys.argv[0],None,'__main__')
