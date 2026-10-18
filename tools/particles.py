import json,subprocess,pathlib
out=pathlib.Path(__file__).resolve().parents[1] / 'public/assets'
for name,count,life,speed,cone,color in [('burst',22,320,100,180,'#baffec'),('bore',65,650,160,180,'#ffbe74'),('swallow',18,460,65,25,'#d58b6d'),('pickup',16,600,45,30,'#fff4bd')]:
 (out/'effects'/name).mkdir(parents=True,exist_ok=True)
 p=pathlib.Path('/tmp/particles-'+name+'.json');p.write_text(json.dumps(dict(width=128,height=128,duration_ms=800,fps=30,seed=42,actions='/tmp/p-'+name+'.json',preview='/tmp/p-'+name+'.gif',system=str(out/'effects'/name/'system.json'))))
 def run(*a):subprocess.run(['particle-2d','--config',str(p),*map(str,a)],check=True,capture_output=True)
 run('init');run('add-emitter','--name','sparks','--shape','point','--x',64,'--y',64,'--burst',count,'--lifetime',life,'--lifetime-spread',70,'--speed',speed,'--speed-spread',20,'--cone-angle',cone,'--dir-y',-1 if name=='swallow' else 1)
 run('set-particle','--emitter','sparks','--size-from',1.5 if name=='bore' else .8,'--size-to',0,'--opacity-from',1,'--opacity-to',0,'--color-gradient',color+'@0,#4d8581@1')
 run('set-forces','--gravity',-35,'--drag',1.5);run('render')
