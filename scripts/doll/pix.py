# 手繪像素兵器（橫放、尖端朝右），1 格＝1 美術像素，最後放大 K 倍。回傳圖和握把位置（美術像素）
from PIL import Image
import numpy as np,json
K=3
O=(30,22,26);SL=(240,244,250);SM=(176,186,200);SD=(104,114,132);WL=(176,116,62);WD=(112,66,34)
GL=(250,204,80);GD=(176,116,32);RD=(206,44,44);RL=(250,96,80);BL=(110,190,255);BW=(220,245,255);LT=(60,40,30)
def canvas(w,h):return np.zeros((h,w,4),np.uint8)
def px(a,x,y,c):
  if 0<=y<a.shape[0] and 0<=x<a.shape[1]:a[y,x]=(*c,255)
def hline(a,x1,x2,y,c):
  for x in range(x1,x2+1):px(a,x,y,c)
def outline(a):
  op=a[...,3]>0;p=np.pad(op,1);nb=p[:-2,1:-1]|p[2:,1:-1]|p[1:-1,:-2]|p[1:-1,2:]
  a[nb&~op]=(*O,255);return a
def shaft(a,x1,x2,y,light=WL,dark=WD):
  hline(a,x1,x2,y,light);hline(a,x1,x2,y+1,dark)
def sword():
  a=canvas(40,9);y=4
  shaft(a,2,6,y-1,WD,LT);px(a,1,y-1,GD);px(a,1,y,GD)                      # 握把、柄頭
  for yy in range(y-3,y+3):px(a,7,yy,GL);px(a,8,yy,GD)                    # 護手
  for x in range(9,35):px(a,x,y-1,SL);px(a,x,y,SM)
  px(a,35,y-1,SL)                                                          # 劍尖
  return outline(a),(4,y)
def dagger():
  a=canvas(25,8);y=4
  shaft(a,2,5,y-1,WD,LT);px(a,1,y-1,GD)
  for yy in range(y-2,y+2):px(a,6,yy,GL)
  for x in range(7,19):px(a,x,y-1,SL);px(a,x,y,SM) if x<18 else None
  px(a,19,y-2,SL);px(a,20,y-2,SL)
  return outline(a),(3,y)
def axe():
  a=canvas(48,20);y=9
  shaft(a,1,42,y)
  for x in (11,12):px(a,x,y,GL);px(a,x,y+1,GD)                             # 握把纏繩
  # 斧頭：x 33~42，刃口是往外凸的弧、上下兩角翹起
  for x in range(33,44):
    t=(x-33)/10;half=2+t*5.5
    for yy in range(int(y-half),int(y+half)+2):
      c=SL if yy<y-1 else SM if yy<=y+2 else SD
      px(a,x,yy,c)
  for yy in range(y-7,y+9):px(a,44,yy,SL)                                  # 刃口亮邊
  px(a,45,y-1,SL);px(a,45,y,SL);px(a,45,y+1,SL);px(a,45,y+2,SL)
  for yy in range(y-1,y+3):px(a,31,yy,SD);px(a,32,yy,SD)                   # 斧背
  px(a,30,y,SD);px(a,30,y+1,SD)
  return outline(a),(12,y)
def spear():
  a=canvas(82,12);y=5
  shaft(a,1,66,y)
  px(a,1,y,GD);px(a,1,y+1,GD)
  for yy in range(y-1,y+3):px(a,66,yy,GL)
  for x,(t,b) in zip(range(63,67),[(1,2),(2,3),(3,4),(3,5)]):                # 紅纓（往後飄）
    for yy in range(y-t+1,y+b+1):px(a,x,yy,RL if (x+yy)%2 else RD)
  for i,w in enumerate([1,2,3,3,3,2,2,1,1,0]):                               # 槍頭：葉形
    x=67+i
    for yy in range(y-w,y+w+2):px(a,x,yy,SL if yy<=y else SM if yy==y+1 else SD)
  return outline(a),(26,y)
def staff():
  a=canvas(70,16);y=7
  shaft(a,1,56,y)
  for x in (15,16):px(a,x,y,GL);px(a,x,y+1,GD)
  for x in (55,56):
    for yy in range(y-1,y+3):px(a,x,yy,GL if yy<=y else GD)
  # 杖頭：一圈金色彎爪抱著藍寶珠
  cx,cy,r=62,y+.5,4.5
  for x in range(56,70):
    for yy in range(y-7,y+9):
      d=((x-cx)**2+(yy-cy)**2)**.5
      if r-1.6<=d<=r+.4 and not (x>cx+2 and abs(yy-cy)<2.5):px(a,x,yy,GL if yy<cy else GD)
      elif d<2.6:px(a,x,yy,BW if (x<cx and yy<cy) else BL)
  return outline(a),(18,y)
def bow():
  # 弓直放：握把在中間，往右彎的反曲弓；弦在左。回傳的「尖端」方向是右（箭飛的方向）
  a=canvas(12,48);cx=3;cy=24
  for yy in range(2,47):
    t=(yy-cy)/22;x=int(round(cx+5*(1-t*t)))
    if abs(t)>.85:x-= int((abs(t)-.85)*14)                               # 弓梢往回翹
    px(a,x,yy,WL);px(a,x+1,yy,WD)
  for yy in range(cy-2,cy+3):px(a,cx+5,yy,GL);px(a,cx+6,yy,GD)            # 握把
  for yy in range(4,45):px(a,cx-1,yy,(230,226,210))                        # 弦
  a=outline(a);return a,(cx+5,cy)
OUT={}
for n,f in [('sword',sword),('dagger',dagger),('axe',axe),('spear',spear),('staff',staff),('bow',bow)]:
  a,(gx,gy)=f();im=Image.fromarray(a).resize((a.shape[1]*K,a.shape[0]*K),Image.NEAREST)
  im.save('p_%s.png'%n);OUT[n]={'w':im.width,'h':im.height,'gx':gx*K+K//2,'gy':gy*K+K//2}
json.dump(OUT,open('p_meta.json','w'));print(OUT)
