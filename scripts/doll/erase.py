# 擦掉立繪上的兵器：spec 給幾何範圍（line/poly），範圍內的像素拿掉；落在身體裡面的（左右兩邊都有身體）用最近的身體像素補，外面的變透明
import sys,json
import numpy as np
from PIL import Image,ImageDraw
def mask_of(shape,W,H,spec):
  m=Image.new('L',(W,H),0);d=ImageDraw.Draw(m)
  for s in spec:
    if s[0]=='line':
      x1,y1,x2,y2,w=s[1];d.line([(x1,y1),(x2,y2)],fill=255,width=w);r=w/2
      for (x,y) in [(x1,y1),(x2,y2)]:d.ellipse([x-r,y-r,x+r,y+r],fill=255)
    elif s[0]=='poly':d.polygon([tuple(p) for p in s[1]],fill=255)
    elif s[0]=='keep':d.polygon([tuple(p) for p in s[1]],fill=0)
  return np.array(m)>0
def region(W,H,spec,kind):
  m=Image.new('L',(W,H),0);d=ImageDraw.Draw(m)
  for s in spec:
    if s[0]==kind:d.polygon([tuple(p) for p in s[1]],fill=255)
  return np.array(m)>0
def close(a,r):
  # 二值 closing：先膨脹再侵蝕（方形）
  def dil(b):
    o=b.copy()
    for dy in range(-r,r+1):
      for dx in range(-r,r+1):
        o|=np.roll(np.roll(b,dy,0),dx,1)
    return o
  return ~dil(~dil(a))
def erase(src,spec,r=5,shadowY=None):
  im=np.array(Image.open(src).convert('RGBA'));H,W=im.shape[:2]
  m=mask_of(None,W,H,spec)
  body=(im[...,3]>0)&~m
  inside=close(body,r)&m&(im[...,3]>0)
  inside=(inside|(region(W,H,spec,'fill')&m))&~region(W,H,spec,'clear')
  if shadowY is not None:  # 腳下半透明的影子不擦
    yy=np.arange(H)[:,None]+np.zeros((1,W),int);m&=~((yy>=shadowY)&(im[...,3]<200))
  out=im.copy();out[m]=0
  # 從外往內一圈一圈補：取已知鄰居的平均，再挑附近原本有的顏色（保持像素畫的色塊）
  todo=inside.copy();have=~m&(im[...,3]>0)
  cur=out.astype(float);src=im.copy()
  while todo.any():
    ys,xs=np.nonzero(todo);upd=[]
    for y,x in zip(ys,xs):
      acc=[];
      for dy,dx in ((0,-1),(0,1),(-1,0),(1,0),(-1,-1),(-1,1),(1,-1),(1,1)):
        yy,xx=y+dy,x+dx
        if 0<=yy<H and 0<=xx<W and have[yy,xx]:acc.append(cur[yy,xx])
      if len(acc)>=2 or (acc and not upd):upd.append((y,x,np.mean(acc,0)))
    if not upd:break
    for y,x,c in upd:cur[y,x]=c;have[y,x]=True;todo[y,x]=False
  # 補出來的顏色換成附近（半徑 8）沒被擦的像素裡最接近的那個
  known=~m&(im[...,3]>0)
  for y,x in zip(*np.nonzero(inside)):
    y0,y1,x0,x1=max(0,y-8),min(H,y+9),max(0,x-8),min(W,x+9)
    k=known[y0:y1,x0:x1];
    if not k.any():continue
    pal=src[y0:y1,x0:x1][k].astype(float)
    d=((pal[:,:3]-cur[y,x,:3])**2).sum(1);cur[y,x]=pal[d.argmin()]
  cur=cur.round().astype(np.uint8)
  # 擦完留下的小碎點（半透明邊）拿掉：不跟最大那塊相連、且小於 20 像素的
  a=cur[...,3]>0;lab=np.zeros(a.shape,int);n=0;sizes={}
  for y,x in zip(*np.nonzero(a)):
    if lab[y,x]:continue
    n+=1;st=[(y,x)];lab[y,x]=n;c=0
    while st:
      yy,xx=st.pop();c+=1
      for dy in (-1,0,1):
        for dx in (-1,0,1):
          y2,x2=yy+dy,xx+dx
          if 0<=y2<H and 0<=x2<W and a[y2,x2] and not lab[y2,x2]:lab[y2,x2]=n;st.append((y2,x2))
    sizes[n]=c
  big=max(sizes,key=sizes.get) if sizes else 0
  for k,c in sizes.items():
    if k!=big and c<20:cur[lab==k]=0
  return Image.fromarray(cur)
if __name__=='__main__':
  src,specf,out=sys.argv[1:4];spec=json.load(open(specf))
  erase(src,spec['shapes'],spec.get('r',5),spec.get('shadowY')).save(out)
