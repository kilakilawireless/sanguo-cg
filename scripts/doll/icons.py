# 武器以外的道具小圖示（2026-10-31 美術檢查第三輪：清單只有字）：防具、飾品、藥、魔石、材料、寶石、任務道具，共 500 多樣。
# 畫風跟武器一樣（pix.py：粗黑邊、左上受光、多層明暗）；照種類畫造型、照名字挑材質顏色，同類的也盡量不同色。
# 用法：cd scripts/doll && node -e '…列出道具…' > /tmp/items2.json && python3 icons.py /tmp/items2.json
# 輸出 www/assets/mud/icons/items.png（2 倍圖，每格 34 CSS 像素）＋ www/src/mud/icon-data.mjs（ITEM_ICON[id]＝[x,y]）
import sys, math, json, hashlib, re
import numpy as np
from PIL import Image
from pix import Cv, pal5, pal4w, ellipse, bez, band, mix, O
from weapons import MET, WOOD, GEM, M, Wd, Gp, gem, knob, rect, rrect, hatch, WHITE

S = 34; IK = 2
C = lambda: Cv(S, S, S / 2, S / 2)


def hsh(s, n): return int(hashlib.md5(s.encode()).hexdigest(), 16) % n


def hsv(h, s, v):
    import colorsys
    r, g, b = colorsys.hsv_to_rgb(h % 1, s, v); return (int(r * 255), int(g * 255), int(b * 255))


def palh(h, s=.6, v=.85):
    """一個色相 → 五層"""
    return pal5(hsv(h, s * .55, min(1, v * 1.12)), hsv(h, s, v * .82), hsv(h, min(1, s * 1.1), v * .5))


METKW = [('白金', 'plat'), ('秘銀', 'mith'), ('水龍', 'water'), ('天空', 'sky'), ('龍鱗', 'jade'), ('鋼騎', 'steel'), ('騎士', 'gold'), ('黃金', 'gold'), ('金', 'gold'),
         ('銀', 'plat'), ('鋼', 'steel'), ('鐵', 'iron'), ('銅', 'bronze'), ('黑', 'dark'), ('暗', 'dark'), ('惡魔', 'purple'), ('魔', 'purple'), ('骨', 'bone'), ('石', 'stone'),
         ('冰', 'crystal'), ('雪', 'crystal'), ('水晶', 'crystal'), ('火', 'red'), ('炎', 'red'), ('紅', 'red'), ('翠', 'jade'), ('綠', 'jade')]
MET_ROT = ['iron', 'steel', 'bronze', 'plat', 'gold', 'dark', 'mith', 'red', 'jade', 'purple']


def metal(it):
    for k, m in METKW:
        if k in it['name']: return M(m)
    if it['id'].endswith(('N', 'L')): return M('iron')
    return M(MET_ROT[hsh(it['id'], len(MET_ROT))])


CLOTHKW = [('龍鱗', .38, .55, .7), ('飛龍', .02, .65, .75), ('虎', .08, .8, .9), ('毛皮', .09, .45, .75), ('貂', .07, .5, .6), ('皮', .07, .6, .65), ('絲', .12, .08, .97),
           ('大賢者', .78, .55, .7), ('賢者', .12, .1, .95), ('星', .64, .6, .55), ('魔導', .76, .55, .65), ('天空', .13, .25, .98), ('水龍', .55, .6, .85),
           ('布', .1, .25, .85), ('麻', .11, .3, .8), ('可愛', .92, .45, .95), ('黑', .7, .2, .35), ('白', .1, .05, .97), ('紅', .99, .7, .8), ('藍', .6, .6, .8), ('綠', .33, .55, .7)]


def cloth(it, s_mul=1.0):
    for k, h, s, v in CLOTHKW:
        if k in it['name']: return palh(h, s * s_mul, v), h
    h = hsh(it['id'], 360) / 360; return palh(h, .55 * s_mul, .78), h


def trim(h): return palh(h + .5, .5, .9) if hsh(str(h), 2) else Wd('gold')


# ---------- 防具 ----------
def helm(c, it):
    P = metal(it)
    c.fill([ellipse(0, -1, 11, 11, 32, math.pi, 2 * math.pi) + [(11, 6), (8, 10), (4, 10), (4, 3), (-4, 3), (-4, 10), (-8, 10), (-11, 6)]], P, base=.55, amp=.6, bev=2.2)
    c.fill([rrect(-9, -1.5, 9, 1.5, .5)], P, base=.32, amp=.5, bev=1)               # 眉沿
    c.fill([rrect(-1.2, -11.5, 1.2, -1, .5)], P, base=.75, amp=.5, bev=1)            # 中脊
    lvl = it['lv']
    if lvl >= 4 or hsh(it['id'], 3) == 0:
        hue = hsh(it['id'] + 'p', 100) / 100
        c.fill([band(bez((0, -11), (5, -17), (12, -13)), 4.5, 1.5)], palh(hue if lvl < 8 else 0, .75, .9), base=.55, amp=.6, bev=1.4)
    c.dots([(-6, -6), (-5, -6)], WHITE)


def cap(c, it):
    P, h = cloth(it)
    if '頭巾' in it['name'] or 'hood' in it['id']:
        c.fill([ellipse(0, 1, 11, 11, 32, math.pi, 2 * math.pi) + [(11, 1), (12, 9), (7, 12), (4, 3), (-4, 3), (-7, 12), (-12, 9), (-11, 1)]], P, base=.55, amp=.6, bev=2.2)
        return
    c.fill([ellipse(0, 5, 9.5, 14, 32, math.pi, 2 * math.pi) + [(9.5, 5), (-9.5, 5)]], P, base=.55, amp=.6, bev=2.2)
    c.fill([rrect(-13, 4, 13, 8.5, 2)], P, base=.4, amp=.6, bev=1.4)
    c.fill([rrect(-9.5, 1, 9.5, 4.2, .5)], trim(h), base=.5, amp=.6, bev=1)
    if hsh(it['id'], 2): c.fill([band(bez((4, -4), (10, -12), (13, -4)), 3, 1)], palh(h + .3, .6, .9), base=.6, amp=.6, bev=1.2)


def wizhat(c, it):
    P, h = cloth(it)
    c.fill([[(-9, 6), (-4, -4), (2, -11), (9, -13), (5, -8), (4, -2), (9, 6)]], P, base=.55, amp=.6, bev=2.0)
    c.fill([ellipse(0, 7, 15, 4, 30)], P, base=.42, amp=.6, bev=1.5)
    c.fill([band([(-8, 4), (8.5, 4)], 3)], trim(h), base=.55, amp=.6, bev=1)
    if it['lv'] >= 5: gem(c, 0, 4, 'bcypgr'[hsh(it['id'], 6)], 2.0)


def mail(c, it):
    P = metal(it)
    body = [(-8, -10), (-3, -8), (3, -8), (8, -10), (10, -3), (9, 6), (6, 12), (-6, 12), (-9, 6), (-10, -3)]
    c.fill([body], P, base=.52, amp=.6, bev=2.4)
    for sg in (-1, 1): c.fill([ellipse(sg * 9.5, -8.5, 4.8, 3.6, 22)], P, base=.6, amp=.6, bev=1.6)
    c.fill([band([(0, -7), (0, 6)], 1.4)], P, base=.82, flat=True, sep=False)
    c.fill([rrect(-8.5, 6, 8.5, 8.6, .5)], Wd('dk' if hsh(it['id'], 2) else 'red'), base=.5, amp=.6, bev=1)
    knob(c, 0, 7.3, 1.4)
    c.dots([(-5, -5), (-4, -5)], WHITE)


def tunic(c, it):
    P, h = cloth(it)
    body = [(-6, -11), (-2, -8), (2, -8), (6, -11), (13, -6), (11, -1), (8, -3), (8, 12), (-8, 12), (-8, -3), (-11, -1), (-13, -6)]
    c.fill([body], P, base=.55, amp=.6, bev=2.2)
    c.fill([[(-2.5, -8.5), (0, -3), (2.5, -8.5)]], P, base=.25, flat=True)
    c.fill([rrect(-8, 3, 8, 5.6, .5)], Wd('dk' if h > .2 else 'gold'), base=.5, amp=.6, bev=1)
    if '虎' in it['name']:
        for y in (-4, 0, 8): c.fill([band([(-7, y), (-3, y + 1.5)], 1.6)], palh(0, 0, .15), base=.2, flat=True, sep=False)


def robe(c, it):
    P, h = cloth(it)
    body = [(-5, -12), (5, -12), (9, -9), (15, 2), (11, 4), (8, -1), (10, 14), (-10, 14), (-8, -1), (-11, 4), (-15, 2), (-9, -9)]
    c.fill([body], P, base=.55, amp=.6, bev=2.2)
    T = trim(h)
    c.fill([band([(0, -11), (0, 13.5)], 2.6)], T, base=.55, amp=.6, bev=1)
    c.fill([rrect(-8.5, 0, 8.5, 2.6, .5)], T, base=.45, amp=.6, bev=1)
    c.fill([band([(-10, 13), (10, 13)], 2)], T, base=.6, flat=True, sep=False)
    if it['lv'] >= 6: gem(c, 0, 1.3, 'bcypgr'[hsh(it['id'], 6)], 1.8)


def boot(c, it):
    heavy = it.get('armor') and 'heavy' in it['armor'] and 'light' not in it['armor']
    P = metal(it) if (heavy or any(k in it['name'] for k in ('騎士', '鐵', '鋼', '白金', '秘銀'))) else cloth(it)[0]
    c.fill([[(-7, -13), (3, -13), (3, 3), (12, 6), (13, 11), (-8, 11), (-8, 2)]], P, base=.55, amp=.6, bev=2.2)
    c.fill([rrect(-8.5, -13.5, 4, -9.5, 1)], P, base=.72, amp=.5, bev=1.2)
    c.fill([rrect(-8.5, 9, 13.5, 12.5, 1)], Wd('dk'), base=.4, amp=.6, bev=1)
    c.dots([(-5, -7), (-5, -6)], WHITE)


def shield(c, it):
    P = metal(it); n = it['name']; h = hsh(it['id'] + 's', 100) / 100
    if '圓' in n or 'R' == it['id'][-1]:
        c.fill([ellipse(0, 0, 13, 13, 36)], P, base=.5, amp=.65, bev=2.4)
        c.fill([ellipse(0, 0, 9.5, 9.5, 32)], palh(h, .55, .7), base=.5, amp=.4, bev=1.4)
        knob(c, 0, 0, 3.2)
        return
    if '鳶' in n: pts = [(-11, -12), (11, -12), (11, -3), (0, 14), (-11, -3)]
    elif '塔' in n or '重' in n or '板' in n: pts = rrect(-11, -13, 11, 13, 3)
    else: pts = [(-12, -12), (12, -12), (12, 0)] + bez((12, 0), (10, 9), (0, 14), 8)[1:] + bez((0, 14), (-10, 9), (-12, 0), 8)[1:]
    c.fill([pts], P, base=.5, amp=.65, bev=2.4)
    inner = [(x * .72, y * .72 - .5) for x, y in pts]
    c.fill([inner], palh(h, .55, .72), base=.5, amp=.4, bev=1.4)
    c.fill([band([(0, -8), (0, 8)], 2.4)], Wd('gold'), base=.55, amp=.6, bev=1)
    c.fill([band([(-6, -3), (6, -3)], 2.4)], Wd('gold'), base=.55, amp=.6, bev=1)
    if it['lv'] >= 5: gem(c, 0, -3, 'rbcgyp'[hsh(it['id'], 6)], 2.0)


def acc(c, it):
    n = it['name']; h = hsh(it['id'], 100) / 100; P = palh(h, .6, .82)
    if '鼓' in n:
        c.fill([rrect(-11, -6, 11, 8, 3)], Wd('red' if h < .5 else 'dk'), base=.5, amp=.6, bev=2)
        c.fill([ellipse(0, -6, 11, 3.5, 26)], pal4w((248, 236, 210), (196, 176, 140)), base=.6, amp=.6, bev=1.4)
        for x in (-7, 0, 7): c.fill([band([(x, -3), (x + 3, 7)], 1.4)], Wd('gold'), base=.6, flat=True, sep=False)
    elif '包' in n:
        c.fill([ellipse(0, 3, 10, 9, 28)], P, base=.55, amp=.6, bev=2)
        c.fill([[(-5, -4), (5, -4), (3, -9), (-3, -9)]], P, base=.45, amp=.6, bev=1.2)
        c.fill([band([(-5, -4), (5, -4)], 1.8)], Wd('gold'), base=.6, flat=True, sep=False)
    elif '結晶' in n or '水晶' in n:
        for k in range(6):
            a = k * math.pi / 3
            c.fill([band([(0, 0), (11 * math.cos(a), 11 * math.sin(a))], 3.2, 1)], M('crystal'), base=.6, amp=.6, bev=1.2)
        c.fill([ellipse(0, 0, 3, 3, 14)], M('crystal'), base=.8, amp=.4, bev=1)
    elif '扇' in n:
        pts = [(0, 10)] + [(14 * math.cos(a), 10 - 14 * math.sin(a)) for a in np.linspace(.35, math.pi - .35, 14)]
        c.fill([pts], M('plat') if '銀' in n else P, base=.6, amp=.55, bev=1.6)
        for a in np.linspace(.45, math.pi - .45, 6): c.fill([band([(0, 10), (13 * math.cos(a), 10 - 13 * math.sin(a))], .9)], Wd('dk'), base=.3, flat=True, sep=False)
        knob(c, 0, 10, 1.8)
    elif '笛' in n:
        c.fill([ellipse(-2, 4, 8, 7, 24)], P, base=.5, amp=.6, bev=1.8)
        for i, (x, y) in enumerate(((2, -2), (6, -6), (9, -1))): c.fill([band([(x - 3, y + 4), (x + 2, y - 7)], 2.4)], Wd('dk'), base=.55, amp=.6, bev=1)
    elif '鈴' in n:
        c.fill([[(-8, 8)] + bez((-8, 8), (-8, -9), (0, -9), 8)[1:] + bez((0, -9), (8, -9), (8, 8), 8)[1:]], Wd('gold'), base=.55, amp=.6, bev=2)
        c.fill([ellipse(0, 9, 9, 2.5, 20)], Wd('gold'), base=.4, amp=.6, bev=1)
        knob(c, 0, 11, 1.8, 'dk')
    elif '符' in n:
        c.fill([rrect(-6, -12, 6, 12, 1)], pal4w((250, 236, 196), (210, 180, 120)), base=.6, amp=.5, bev=1.4)
        for y in (-7, -2, 3, 8): c.fill([band([(-3, y), (3, y + 1.5)], 1.4)], Wd('red'), base=.5, flat=True, sep=False)
    elif any(k in n for k in ('環', '戒', '指')):
        c.fill([ellipse(0, 3, 10, 8, 30)], Wd('gold') if hsh(it['id'], 2) else M('plat'), base=.55, amp=.7, bev=1.6, holes=[ellipse(0, 3, 6.5, 5, 26)])
        gem(c, 0, -5, 'rbgpcy'[hsh(it['id'], 6)], 3.2)
    else:  # 護身符：鍊子＋墜子
        c.fill([band([(-9, -12), (-6, -3), (0, 2)], 1.6)], Wd('gold'), base=.6, flat=True, sep=False)
        c.fill([band([(9, -12), (6, -3), (0, 2)], 1.6)], Wd('gold'), base=.6, flat=True, sep=False)
        c.fill([[(0, 0), (6, 6), (0, 13), (-6, 6)]], Wd('gold'), base=.55, amp=.6, bev=1.4)
        gem(c, 0, 6.5, 'rbgpcy'[hsh(it['id'], 6)], 2.8)


# ---------- 藥、食物、任務道具 ----------
def bottle(c, liquid, big=False, shape='round'):
    k = 1.15 if big else 1.0
    glass = pal5((236, 248, 255), (190, 214, 230), (120, 140, 160))
    if shape == 'tall':
        body = rrect(-6 * k, -4, 6 * k, 13, 3)
    else:
        body = ellipse(0, 5, 9 * k, 8.5 * k, 30)
    c.fill([rrect(-3, -11, 3, -2, .5)], glass, base=.6, amp=.6, bev=1.2)
    c.fill([body], glass, base=.6, amp=.6, bev=1.8)
    m = c.mask([body]) & (c.Y > (-1 if shape == 'tall' else 1.5))
    c.fill([], liquid, base=.55, amp=.6, bev=1.8, m=m, sep=False)
    c.fill([rrect(-3.6, -14, 3.6, -10, 1)], Wd('wood'), base=.5, amp=.6, bev=1)
    c.dots([(-5 * k, 1), (-5 * k, 2), (-4 * k, 0)], WHITE)


def use_item(c, it):
    n, i = it['name'], it['id']
    if '麵包' in n:
        c.fill([ellipse(0, 3, 13, 8, 30)], pal5((250, 220, 150), (220, 150, 70), (150, 90, 40)), base=.55, amp=.7, bev=2.4)
        for x in (-5, 0, 5): c.fill([band([(x - 2, -1), (x + 2, 2)], 1.4)], pal5((250, 230, 180), (250, 230, 180), (250, 230, 180)), base=.9, flat=True, sep=False)
        return
    if '肉' in n:
        c.fill([band([(-11, 10), (-4, 3)], 3.2)], Wd('white'), base=.6, amp=.6, bev=1)
        knob(c, -12, 11, 2.4, 'white')
        c.fill([ellipse(3, -3, 10, 8, 28, )], pal5((240, 150, 110), (190, 80, 50), (120, 40, 30)), base=.55, amp=.7, bev=2.2)
        return
    if it.get('mp') and not it.get('hp'): liq = palh(.6, .7, .95)
    elif '特效' in n: liq = palh(.33, .7, .85)
    elif '靈' in n: liq = palh(.13, .75, 1)
    else: liq = palh(0, .75, .95)
    bottle(c, liq, big=('高級' in n or '靈' in n), shape='tall' if '特效' in n or '靈' in n else 'round')


def key_item(c, it):
    n = it['name']
    if '藥' in n:
        for x, y, h in ((-4, 2, .0), (4, -2, .58)):
            c.fill([band([(x - 4, y + 3), (x + 4, y - 3)], 6)], palh(h, .6, .95), base=.55, amp=.7, bev=1.8)
        return
    if '信' in n:
        c.fill([rrect(-13, -8, 13, 9, 1)], pal4w((250, 240, 214), (210, 190, 150)), base=.6, amp=.5, bev=1.4)
        c.fill([band([(-13, -8), (0, 2), (13, -8)], 1.4)], pal4w((180, 160, 120), (150, 130, 90)), base=.4, flat=True, sep=False)
        c.fill([ellipse(0, 2, 3.2, 3.2, 16)], Wd('red'), base=.5, amp=.7, bev=1.2)
        return
    if '徽章' in n or '證' in n:
        c.fill([ellipse(0, -1, 10, 10, 30)], Wd('gold'), base=.55, amp=.7, bev=2)
        c.fill([[(-6, 6), (-9, 14), (-3, 11), (0, 14), (0, 8)]], Wd('red'), base=.5, amp=.6, bev=1)
        c.fill([[(6, 6), (9, 14), (3, 11), (0, 14), (0, 8)]], Wd('red'), base=.45, amp=.6, bev=1)
        gem(c, 0, -1, 'r', 3)
        return
    # 卷軸
    c.fill([rrect(-9, -11, 9, 11, 1)], pal4w((250, 240, 214), (210, 190, 150)), base=.6, amp=.5, bev=1.4)
    for y in (-11, 11): c.fill([rrect(-11, y - 2, 11, y + 2, 1.5)], Wd('wood'), base=.5, amp=.7, bev=1.2)
    for y in (-5, -1, 3): c.fill([band([(-6, y), (6, y)], 1.2)], Wd('dk'), base=.3, flat=True, sep=False)


# ---------- 魔石、材料、寶石 ----------
def crystal_cluster(c, P, n=3, size=1.0):
    spikes = [(0, -1, 13, 0), (-6, 3, 9, -.45), (6, 3, 9, .45), (-3, 6, 6, -.9), (4, 7, 6, .9)][:n]
    for x, y, L, a in sorted(spikes, key=lambda s: -s[2]):
        L *= size; w = L * .42
        dx, dy = math.sin(a), -math.cos(a)
        tip = (x + dx * L, y + dy * L); nx, ny = -dy, dx
        pts = [(x + nx * w / 2, y + ny * w / 2), (x + nx * w / 2 + dx * L * .7, y + ny * w / 2 + dy * L * .7), tip,
               (x - nx * w / 2 + dx * L * .7, y - ny * w / 2 + dy * L * .7), (x - nx * w / 2, y - ny * w / 2)]
        c.fill([pts], P, base=.55, amp=.6, bev=1.6, split=((x, y), tip, .2))
    c.fill([ellipse(0, 9, 10 * size, 3, 20)], pal5((150, 140, 130), (110, 100, 90), (70, 64, 58)), base=.5, amp=.6, bev=1)


def crystal_item(c, it):
    tiers = ['crystalS', 'crystalM', 'crystalL', 'crystalXL', 'crystalXXL', 'crystalX3']
    t = tiers.index(it['id']) if it['id'] in tiers else 2
    crystal_cluster(c, palh(.75 - t * .06, .6, .9), n=min(5, 2 + t), size=.85 + t * .05)


GEMC = {'garnet': .97, 'yellow': .14, 'green': .36, 'blue': .6, 'amethyst': .78, 'knight': .58, 'tektite': .3, 'tin': .08, 'jet': .7, 'iolite': .68,
        'deepblue': .64, 'spinel': .93, 'zircon': .15, 'citrine': .1, 'andalusite': .02, 'peridot': .24, 'quartz': .55, 'pearl': .1, 'opal': .9, 'catseye': .2,
        'ruby': .0, 'mouse': .6, 'pure': .55, 'tungsten': .6, 'dragonGem': .55, 'iceCrystal': .52, 'holyStone': .14, 'desertStar': .02, 'meteor': .08}
GEMSV = {'jet': (.2, .35), 'tin': (.35, .6), 'quartz': (.08, .98), 'pearl': (.06, .98), 'opal': (.18, .98), 'pure': (.05, 1), 'tungsten': (.12, .7), 'knight': (.3, .9),
         'zircon': (.35, 1), 'mouse': (.08, .6), 'tektite': (.6, .45), 'meteor': (.5, .45)}


def cut_gem(c, P, r, sparkle=0, shape='oval'):
    if shape == 'round':
        c.fill([ellipse(0, 0, r, r, 30)], P, base=.55, amp=.7, bev=r * .45)
        c.dots([(-r * .4, -r * .45), (-r * .4 + 1, -r * .45)], WHITE); return
    if shape == 'star':
        pts = []
        for k in range(10):
            a = -math.pi / 2 + k * math.pi / 5; rr = r if k % 2 == 0 else r * .45
            pts.append((rr * math.cos(a), rr * math.sin(a)))
        c.fill([pts], P, base=.6, amp=.6, bev=1.8); return
    w, hgt = r, r * .85
    pts = [(-w * .55, -hgt), (w * .55, -hgt), (w, -hgt * .35), (0, hgt), (-w, -hgt * .35)]
    c.fill([pts], P, base=.55, amp=.55, bev=1.6)
    c.fill([[(-w * .55, -hgt), (w * .55, -hgt), (w * .35, -hgt * .35), (-w * .35, -hgt * .35)]], P, base=.82, amp=.3, bev=1, sep=False)
    c.fill([band([(-w * .35, -hgt * .35), (0, hgt * .9)], 1.0)], P, base=.35, flat=True, sep=False)
    c.fill([band([(w * .35, -hgt * .35), (0, hgt * .9)], 1.0)], P, base=.35, flat=True, sep=False)
    if sparkle:
        for x, y in ((w * .7, -hgt * 1.0), (-w * .9, hgt * .4))[:sparkle]:
            c.later([band([(x - 2, y), (x + 2, y)], 1), band([(x, y - 2), (x, y + 2)], 1)], WHITE)


def shards(c, P, n):
    for k, (x, y, s, a) in enumerate([(-5, 3, 5, .3), (5, 0, 5.5, -.4), (0, -6, 4.5, .9), (-2, 9, 3.5, -.2)][:n]):
        pts = [(x + s * math.cos(a + t), y + s * .8 * math.sin(a + t)) for t in (0, 2.0, 3.6, 5.0)]
        c.fill([pts], P, base=.55, amp=.6, bev=1.4)


def gem_item(c, it):
    i = it['id']; parts = i.split('_')
    if parts[1] == 'pet':
        hue = {'earth': .1, 'water': .58, 'fire': .02, 'wind': .35}[parts[2]]; lv = int(parts[3])
        cut_gem(c, palh(hue, .7, .95), 6 + 1.3 * lv, 0, 'round'); return
    g = parts[1]; lv = int(parts[2]) if len(parts) > 2 and parts[2].isdigit() else 6
    if g in ('partO', 'partQ'):
        c.fill([ellipse(0, 0, 11, 11, 24)], M('steel'), base=.55, amp=.7, bev=2, holes=[ellipse(0, 0, 4, 4, 14)])
        for k in range(8):
            a = k * math.pi / 4; c.fill([rrect(-2, -14, 2, -9, .5)] if False else [[(9 * math.cos(a - .25), 9 * math.sin(a - .25)), (13.5 * math.cos(a - .15), 13.5 * math.sin(a - .15)), (13.5 * math.cos(a + .15), 13.5 * math.sin(a + .15)), (9 * math.cos(a + .25), 9 * math.sin(a + .25))]], M('steel'), base=.6, amp=.6, bev=1)
        return
    hue = GEMC.get(g, hsh(g, 100) / 100); s, v = GEMSV.get(g, (.75, .95))
    P = palh(hue, s, v)
    if g == 'star' or g == 'desertStar': cut_gem(c, P if g == 'desertStar' else palh(.13, .7, 1), 6 + lv * .7, shape='star'); return
    if g == 'pearl': cut_gem(c, P, 4 + lv * .7, shape='round'); return
    if g == 'meteor':
        c.fill([[(-9, -4), (-3, -10), (6, -8), (10, 0), (5, 9), (-6, 9), (-11, 2)]], palh(.08, .4, .5), base=.5, amp=.6, bev=2)
        c.later([ellipse(2, 0, 2.2, 2.2, 12)], (255, 200, 120)); return
    if lv <= 2: shards(c, P, 3 if lv == 1 else 2); return
    r = 6.5 + lv * .78
    cut_gem(c, P, r, sparkle=(1 if lv >= 7 else 0) + (1 if lv >= 9 else 0))
    if lv <= 5:  # 破損：一條裂痕
        c.fill([band([(-r * .3, -r * .7), (r * .05, -r * .1), (-r * .15, r * .5)], 1.1)], P, base=.08, flat=True, sep=False)


ORE = {'copper': 'bronze', 'ironOre': 'iron', 'silver': 'plat', 'goldOre': 'gold', 'platinum': 'plat', 'mithril': 'mith', 'knightOre': 'steel'}
WOODS = {'pine': (.08, .55, .7), 'oak': (.07, .6, .55), 'cypress': (.05, .45, .65), 'ebony': (.05, .3, .3), 'ancientWood': (.1, .4, .5), 'divineWood': (.12, .5, .85), 'pu': (.09, .5, .62)}
HIDES = {'hide': (.07, .55, .6), 'marten': (.06, .45, .45), 'tigerSkin': (.08, .85, .9), 'wyvernHide': (.0, .6, .65), 'dragonScale': (.38, .55, .65)}


def material(c, it):
    i, n = it['id'], it['name']
    if i.startswith('gem_'): return gem_item(c, it)
    if i in ORE or '礦' in n:
        rock = [(-11, 2), (-8, -6), (-1, -10), (7, -8), (11, -1), (9, 8), (-2, 10), (-9, 8)]
        c.fill([rock], pal5((170, 160, 150), (120, 110, 100), (74, 66, 60)), base=.5, amp=.6, bev=2)
        Mt = M(ORE.get(i, 'steel'))
        for x, y, r in ((-3, -3, 3.2), (4, 2, 2.6), (-5, 5, 2.0), (5, -5, 1.8)): c.fill([[(x - r, y), (x, y - r), (x + r, y), (x, y + r)]], Mt, base=.6, amp=.6, bev=1)
        return
    if i in WOODS or '木' in n:
        h, s, v = WOODS.get(i, (.08, .5, .6)); P = palh(h, s, v)
        c.fill([[(-12, -1), (8, -9), (12, -2), (-8, 7)]], P, base=.5, amp=.6, bev=2)
        c.fill([ellipse(10, -5.5, 3.6, 4.6, 20)], palh(h + .02, s * .6, min(1, v * 1.3)), base=.55, amp=.5, bev=1.2)
        c.fill([ellipse(10, -5.5, 1.4, 1.8, 10)], P, base=.3, flat=True, sep=False)
        return
    if i in HIDES or '皮' in n and 'rag' not in i:
        h, s, v = HIDES.get(i, (.07, .5, .6)); P = palh(h, s, v)
        c.fill([[(-6, -12), (6, -12), (8, -6), (13, -8), (11, 0), (8, 2), (9, 12), (3, 9), (-3, 9), (-9, 12), (-8, 2), (-11, 0), (-13, -8), (-8, -6)]], P, base=.55, amp=.6, bev=2)
        if 'tiger' in i:
            for y in (-6, -1, 4): c.fill([band([(-5, y), (5, y + 1)], 1.6)], palh(0, 0, .15), base=.2, flat=True, sep=False)
        if 'dragon' in i or 'wyvern' in i:
            for x, y in ((-3, -5), (3, -5), (0, 0), (-3, 5), (3, 5)): c.fill([ellipse(x, y, 2.2, 1.6, 10, 0, math.pi)], P, base=.75, amp=.4, bev=1, sep=False)
        return
    if i in ('herb', 'ginseng', 'lingzhi') or '草' in n or '香' in n:
        c.fill([band(bez((-2, 13), (0, 2), (2, -10)), 1.6)], palh(.3, .6, .5), base=.5, flat=True)
        for x, y, a in ((-6, -4, -.6), (6, -7, .6), (-5, 4, -.4), (6, 2, .5)):
            c.fill([ellipse(x, y, 5, 2.6, 16)], palh({'herb': .3, 'ginseng': .25, 'lingzhi': .4}.get(i, .3), .6, .75), base=.55, amp=.6, bev=1.2)
        return
    if i == 'meat': return use_item(c, {'name': '肉', 'id': i})
    if i == 'antler' or '角' in n:
        P = pal5((252, 244, 224), (222, 206, 172), (152, 132, 100)) if i == 'antler' else palh(.14, .6, 1)
        c.fill([band(bez((-8, 12), (-4, -2), (6, -12)), 4, 1.5)], P, base=.55, amp=.6, bev=1.4)
        c.fill([band(bez((-5, 3), (2, 2), (8, -2)), 2.6, 1)], P, base=.55, amp=.6, bev=1.2)
        return
    if i.startswith('rusty') or i.startswith('rag'):
        rust = pal5((200, 150, 110), (150, 90, 60), (90, 54, 40)) if i.startswith('rusty') else palh(.09, .25, .6)
        kind = i[5:] if i.startswith('rusty') else i[3:]
        if kind in ('Sword', 'Dagger', 'Spear', 'Staff', 'Axe', 'Bow'):
            c.fill([band([(-12, 12), (-6, 6)], 3)], Wd('dk'), base=.5, amp=.6, bev=1.2)
            c.fill([[(-5, 3), (9, -11), (12, -12), (11, -9), (-3, 5)]], rust, base=.5, amp=.6, bev=1.6)
            c.fill([band([(-9, 3), (-3, 9)], 3)], rust, base=.4, amp=.6, bev=1)
            for x, y in ((2, -4), (6, -8)): c.fill([ellipse(x, y, 1.2, 1.2, 8)], palh(.05, .7, .45), base=.4, flat=True, sep=False)
        elif kind == 'Shield': shield(c, {'name': '圓', 'id': 'R', 'lv': 0}); c.a[c.a[..., 3] > 0, :3] = (c.a[c.a[..., 3] > 0, :3] * np.array([1.0, .75, .55])).astype(np.uint8)
        elif kind == 'Helm': helm(c, {'name': '銅', 'id': i, 'lv': 0})
        elif kind == 'Mail': mail(c, {'name': '銅', 'id': i, 'lv': 0})
        elif kind == 'Hat': cap(c, {'name': '麻', 'id': i, 'lv': 0})
        elif kind == 'Cloth': tunic(c, {'name': '麻', 'id': i, 'lv': 0})
        elif kind == 'Robe': robe(c, {'name': '麻', 'id': i, 'lv': 0})
        else: boot(c, {'name': '皮', 'id': i, 'lv': 0, 'armor': None})
        if i.startswith('rag'):  # 補丁
            c.fill([rrect(-3, -1, 3, 4, .5)], palh(.6, .3, .6), base=.5, flat=True, sep=False)
        return
    if 'Crystal' in i or '水晶' in n:
        crystal_cluster(c, palh(.8 if 'demon' in i else .52, .65, .85 if 'demon' not in i else .6), n=3 if 'Shard' not in i else 2, size=.8 if 'Shard' not in i else .6)
        return
    if 'Bar' in i or '鋼' in n:
        P = M('sky') if 'sky' in i else palh(.75, .3, .85)
        c.fill([[(-12, 4), (-6, -5), (12, -5), (6, 4)]], P, base=.7, amp=.5, bev=1.4)
        c.fill([[(-12, 4), (6, 4), (6, 9), (-12, 9)]], P, base=.45, amp=.5, bev=1.4)
        c.fill([[(6, 4), (12, -5), (12, 0), (6, 9)]], P, base=.25, amp=.5, bev=1.4)
        return
    if '砂' in n:
        c.fill([ellipse(0, 5, 12, 7, 26, math.pi, 2 * math.pi) + [(12, 6), (-12, 6)]], palh(.62, .5, .7), base=.55, amp=.6, bev=2)
        for x, y in ((-5, 0), (2, -2), (5, 3), (-2, 4), (0, -5)): c.later([[(x, y - 1.2), (x + 1.2, y), (x, y + 1.2), (x - 1.2, y)]], (255, 250, 200))
        return
    if '羽' in n:
        c.fill([band(bez((-9, 12), (-2, -2), (10, -12)), 1.4)], Wd('white'), base=.6, flat=True)
        c.fill([[(-6, 6)] + bez((-6, 6), (-8, -8), (10, -12), 10)[1:] + bez((10, -12), (6, 4), (-6, 6), 10)[1:]], palh(.52, .25, 1), base=.6, amp=.6, bev=1.8)
        return
    if '核' in n:
        c.fill([ellipse(0, 0, 10, 10, 30)], palh(.13, .5, 1), base=.6, amp=.7, bev=3)
        for k in range(4):
            a = k * math.pi / 2 + .4; c.later([band([(12 * math.cos(a), 12 * math.sin(a)), (14.5 * math.cos(a), 14.5 * math.sin(a))], 1)], (255, 250, 210))
        return
    if '徽章' in n: return key_item(c, it)
    # 其他：小布袋
    acc(c, {'name': '包', 'id': i, 'lv': 0})


def draw(it):
    c = C(); slot, kind, arm = it.get('slot'), it.get('kind'), it.get('armor') or ''
    if slot == 'head':
        if arm == 'heavy': helm(c, it)
        elif arm == 'robe' or (arm and 'robe' in arm and 'light' not in arm) or 'hat' in it['id'].lower() and ('法' in it['name'] or '魔' in it['name'] or '賢' in it['name'] or '水龍' in it['name']): wizhat(c, it)
        else: cap(c, it)
    elif slot == 'body':
        if arm == 'heavy': mail(c, it)
        elif arm == 'robe': robe(c, it)
        else: tunic(c, it)
    elif slot == 'feet': boot(c, it)
    elif slot == 'shield': shield(c, it)
    elif slot == 'acc': acc(c, it)
    elif kind == 'use': use_item(c, it)
    elif kind == 'crystal': crystal_item(c, it)
    elif kind == 'key': key_item(c, it)
    else: material(c, it)
    return c.done()


if __name__ == '__main__':
    items = json.load(open(sys.argv[1]))
    cols = 24; rows = (len(items) + cols - 1) // cols
    sheet = np.zeros((rows * S, cols * S, 4), np.uint8); table = {}
    for k, it in enumerate(items):
        a = draw(it); x, y = k % cols * S, k // cols * S
        sheet[y:y + S, x:x + S] = a; table[it['id']] = [x, y]
    import os
    os.makedirs('../../www/assets/mud/icons', exist_ok=True)
    Image.fromarray(sheet).resize((sheet.shape[1] * IK, sheet.shape[0] * IK), Image.NEAREST).save('../../www/assets/mud/icons/items.png', optimize=True)
    with open('../../www/src/mud/icon-data.mjs', 'w') as f:
        f.write('// scripts/doll/icons.py 產生的，別手改：武器以外的道具小圖示在 assets/mud/icons/items.png（%d 倍圖），每格 %d×%d CSS 像素，[x,y]＝位置（CSS 像素）\n' % (IK, S, S))
        f.write('export const ITEM_ICON_W=%d,ITEM_ICON=' % sheet.shape[1] + json.dumps(table, ensure_ascii=False, separators=(',', ':')) + ';\n')
    print(len(items), sheet.shape)
