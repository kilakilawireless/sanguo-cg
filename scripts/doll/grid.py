import sys
from PIL import Image,ImageDraw
src,out=sys.argv[1],sys.argv[2];k=int(sys.argv[3]) if len(sys.argv)>3 else 3
im=Image.open(src).convert('RGBA');W,H=im.size
bg=Image.new('RGBA',(W,H),(40,44,52,255));bg.alpha_composite(im)
bg=bg.resize((W*k,H*k),Image.NEAREST);d=ImageDraw.Draw(bg)
for x in range(0,W,10): d.line([(x*k,0),(x*k,H*k)],fill=(255,255,255,70) if x%50 else (255,80,80,160))
for y in range(0,H,10): d.line([(0,y*k),(W*k,y*k)],fill=(255,255,255,70) if y%50 else (255,80,80,160))
for x in range(0,W,50):
  for y in range(0,H,50): d.text((x*k+2,y*k+2),'%d,%d'%(x,y),fill=(255,255,0,255))
bg.save(out)
