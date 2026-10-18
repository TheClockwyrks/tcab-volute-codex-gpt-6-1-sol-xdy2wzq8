"""One-time asset authoring. Requires the development asset tools, never the build."""
import json, math, pathlib, subprocess, colorsys
ROOT=pathlib.Path(__file__).resolve().parents[1]; OUT=ROOT/'public/assets'; OUT.mkdir(exist_ok=True,parents=True)
def run(*a):
 r=subprocess.run(list(map(str,a)),capture_output=True,text=True)
 if r.returncode: raise RuntimeError(r.stderr)
 return r.stdout
def render(name,w,h,ops,sheet=False):
 log=OUT/(name+'.art.json'); log.write_text(json.dumps(ops))
 run('draw-sheet' if sheet else 'draw','render','--actions',log,'--out',OUT/(name+'.png'),'--width',w,'--height',h,'--no-layers')
def px(x,y,c): return dict(op='set_pixel',x=x,y=y,color=c)
def rect(x,y,w,h,c): return dict(op='fill_rect',x=x,y=y,width=w,height=h,color=c)
def circ(x,y,r,c): return dict(op='fill_circle',cx=x,cy=y,r=r,color=c)
def line(x1,y1,x2,y2,c): return dict(op='line',x0=x1,y0=y1,x1=x2,y1=y2,color=c)
colors=['#66e6d7','#f3cb62','#7eafff','#f27683','#b6e879']; names=['halide','sulfur','cobalt','garnet','olivine']
for i,(name,col) in enumerate(zip(names,colors)):
 rgb=[int(col[j:j+2],16) for j in (1,3,5)]; ops=[]
 for y in range(28):
  for x in range(28):
   dx=x-13.5;dy=y-13.5;r=math.hypot(dx,dy)
   if r>13.8: continue
   light=.4 if r>12.3 else .72+(-dx-dy)/55 + .10*math.sin(math.floor(math.atan2(dy,dx)*3)*2)
   c='#'+''.join(f'{min(255,int(v*light)):02x}' for v in rgb)
   ops.append(px(x,y,c))
 ops += [line(7,5,16,3,'#e2fff0'),line(4,8,4,12,'#c5f4e2')]
 glyphs=[[(9,10,18,10),(9,17,18,17),(10,9,10,18),(17,9,17,18)],[(14,8,19,18),(19,18,8,18),(8,18,14,8)],[(8,14,14,8),(14,8,20,14),(20,14,14,20),(14,20,8,14)],[(9,9,19,19),(9,19,19,9)],[(8,14,20,14),(14,8,14,20)]]
 for l in glyphs[i]: ops.append(line(*l,'#18313a'))
 render(name,28,28,ops)
for idx,name in enumerate(['choke','backflow','bore','sightline']):
 ops=[circ(8,8,7,'#14252b'),circ(8,8,6,'#e7dec3')]
 shapes=[[(4,5,12,5),(4,10,12,10),(6,5,6,10),(10,5,10,10)],[(4,8,12,8),(4,8,7,5),(4,8,7,11)],[(4,4,12,12),(4,12,12,4),(8,3,8,13)],[(3,8,13,8),(8,3,8,13)]]
 for l in shapes[idx]:ops.append(line(*l,'#3a4641'))
 render(name,16,16,ops)
def base():
 ops=[circ(22,22,21,'#101b20'),circ(22,21,20,'#738581'),circ(22,22,17,'#2b4145'),circ(22,22,13,'#a58b59'),circ(22,22,10,'#16292f')]
 for x,y in [(8,8),(35,8),(8,35),(35,35)]:ops +=[circ(x,y,2,'#b6b6a0'),px(x,y,'#29383b')]
 return ops
render('injector-base',44,44,base())
def barrel(k=0):
 return [rect(8-k,4,32,12,'#101a20'),rect(9-k,3,29,12,'#77847a'),rect(12-k,6,26,8,'#3d5356'),rect(15-k,4,14,3,'#a8b3a1'),rect(32-k,2,7,16,'#bca271'),rect(36-k,5,6,10,'#25383d'),rect(18-k,9,12,3,'#57c5b6')]
render('injector-barrel',44,20,barrel())
for f,k in enumerate([6,4,2,0]):render(f'recoil-{f}',44,20,barrel(k),True)
def maw(opening=0):
 ops=[circ(32,32,31,'#101a20'),circ(32,31,29,'#68706a'),circ(32,32,25,'#303e40'),circ(32,32,20,'#af8956'),circ(32,32,16+opening,'#090f15')]
 for a in range(0,360,45):
  r=22; x=round(32+math.cos(a*math.pi/180)*r);y=round(32+math.sin(a*math.pi/180)*r)
  ops.append(circ(x,y,2,'#dac99f'))
 for a in range(0,360,90):
  x=round(32+math.cos(a*math.pi/180)*(12+opening));y=round(32+math.sin(a*math.pi/180)*(12+opening));ops.append(circ(x,y,3,'#74513e'))
 return ops
render('maw',64,64,maw())
for f,o in enumerate([0,2,5,4,2,0]):render(f'swallow-{f}',64,64,maw(o),True)
for f in range(6):
 ops=[];r=4+f*3
 for a in range(0,360,30):
  dx=math.cos(a*math.pi/180);dy=math.sin(a*math.pi/180)
  ops.append(line(round(24+dx*r),round(24+dy*r),round(24+dx*(r+5-f/2)),round(24+dy*(r+5-f/2)),'#e7fff3'))
 if f<3:ops.append(circ(24,24,7-f*2,'#eefff5'))
 render(f'flash-{f}',48,48,ops,True)
ops=[rect(0,0,64,64,'#26393d'),rect(1,1,62,62,'#2a3e42')]
for y in range(64):
 for x in range(64):
  if (x*37+y*53)%79==0:ops.append(px(x,y,'#34474a'))
ops += [line(0,0,63,0,'#52615c'),line(0,63,63,63,'#14292e'),circ(5,5,2,'#182a30'),px(5,4,'#7a8170')]
render('plate',64,64,ops)
render('cell',24,24,[rect(6,3,12,19,'#14262c'),rect(8,2,8,3,'#b6baa0'),rect(7,5,10,15,'#8ca99a'),rect(9,7,6,10,'#73d9bd'),line(10,8,10,15,'#c9ffe2')])
render('pressure',24,24,[circ(12,12,10,'#72817a'),circ(12,12,8,'#1c333b'),line(12,12,16,6,'#f0c17b'),circ(12,12,2,'#e8d6a8')])
def config(tool,name,duration):
 p=pathlib.Path('/tmp/volute-'+name+'.json');p.write_text(json.dumps(dict(sample_rate=22050,channels='mono',max_duration_ms=duration,seed=42,sample_pack='combat-core',instrument_bank='synthwave',actions='/tmp/volute-'+name+'-ops.json',preview='/tmp/volute-'+name+'.png',wav=str(OUT/(name+'.wav')),mid=str(OUT/(name+'.mid')))))
 run(tool,'--config',p,'init');return [tool,'--config',p]
for i,name in enumerate(['fire','seat','swap','denied','machinery']):
 cmd=config('sfx-synth',name,500)
 run(*cmd,'add-voice','--name','body','--wave',['noise','sine','triangle','square','sine'][i],'--freq',[170,240,720,90,880][i],'--dur',[65,85,60,120,230][i],'--gain',-16)
 run(*cmd,'set-envelope','--voice','body','--env','pluck')
 run(*cmd,'render')
for i,name in enumerate(['extract-1','extract-2','extract-3','extract-4','extract-5','intake','level-clear','cell-lost']):
 cmd=config('sfx-sample',name,1800)
 run(*cmd,'add-sample','--name',('impact_metal_dry' if i<5 else ['boom_sub_rumble','clang_metal','cannon_body_heavy'][i-5]),'--t',0,'--gain',-12 if i<7 else -7,'--pitch',i*3 if i<5 else 0,'--fade-out',80)
 if i<5:run(*cmd,'add-sample','--name','debris_glass','--t',15,'--gain',-24,'--pitch',i*3,'--trim','0,250','--fade-out',80)
 run(*cmd,'render')
for danger in [False,True]:
 name='danger-loop' if danger else 'hall-loop'; cmd=config('music',name,8000)
 run(*cmd,'set-tempo','--bpm',120)
 for track,inst,gain in [('bass','sub_bass',.0),('pulse','pluck',.0),('drum','kick_808',.0)]:
  run(*cmd,'define-track','--name',track,'--instrument',inst)
 for b in range(16):
  run(*cmd,'add-note','--track','bass','--pitch',[36,36,31,34][b//4],'--t',b,'--dur',.6,'--velocity',45)
  if b%2==0 or danger:run(*cmd,'add-note','--track','pulse','--pitch',[60,67,70,62][b%4]+(12 if danger else 0),'--t',b+.5,'--dur',.22,'--velocity',28 if not danger else 40)
  if b%4==0 or danger and b%2==0:run(*cmd,'add-note','--track','drum','--pitch',36,'--t',b,'--dur',.2,'--velocity',42)
 run(*cmd,'render')
print('Sprites, animation and sound produced.')
# Master the produced PCM cues once; the runtime only plays committed WAVs.
import wave, struct
for path in OUT.glob('*.wav'):
 with wave.open(str(path),'rb') as source:
  params=source.getparams(); data=list(struct.unpack('<'+'h'*source.getnframes()*source.getnchannels(),source.readframes(source.getnframes())))
 gain=4 if path.stem.startswith('extract-') else 2.5 if path.stem=='cell-lost' else 2 if path.stem=='level-clear' else 1
 fade=max(1,int(params.framerate*.002))
 for i,value in enumerate(data):
  envelope=min(1,i/fade,(len(data)-1-i)/fade)
  data[i]=int(max(-30000,min(30000,value*gain*envelope)))
 with wave.open(str(path),'wb') as target:
  target.setparams(params);target.writeframes(struct.pack('<'+'h'*len(data),*data))
