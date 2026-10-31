# 紙娃娃的武器（Leo 2026-10-29「每個不同的武器樣子不同」；2026-10-31 Leo「武器真的太醜了」整個重畫）：196 把各自一張像素圖。
# 畫風照立繪：粗黑邊、Q 版比例（刃寬、頭大）、每塊零件四五層明暗＋左上受光的斜面、刃口亮邊、反光點。畫筆在 pix.py。
# 橫放、尖端朝右（弓直放、往右瞄）；1 格＝1 美術像素，最後放大 K 倍，跟立繪的顆粒一樣（doll.mjs SIZE＝1）。
# 輸出 www/assets/mud/wpn/sheet.png（圖集）＋ www/src/mud/wpn-data.mjs（每把的位置、握把、發光色）。
# 用法：cd scripts/doll && node -e '…列出武器…' | python3 weapons.py [--gallery 一覽圖.png]
import sys, math, json
import numpy as np
from PIL import Image
from pix import Cv, pal5, pal4w, ellipse, bez, band, mix
K = 3
O = (30, 22, 26)
# 金屬：亮、中、暗
MET = {
 'iron': ((206, 212, 220), (150, 158, 170), (96, 104, 118)),
 'bronze': ((240, 184, 120), (196, 128, 66), (128, 78, 40)),
 'steel': ((244, 247, 252), (178, 188, 204), (104, 114, 134)),
 'gold': ((255, 232, 130), (234, 178, 56), (160, 104, 24)),
 'plat': ((252, 252, 255), (214, 220, 236), (146, 154, 176)),
 'mith': ((226, 252, 255), (140, 214, 244), (66, 140, 196)),
 'dark': ((130, 130, 152), (76, 76, 96), (38, 38, 54)),
 'red': ((255, 182, 120), (230, 76, 52), (140, 30, 30)),
 'jade': ((190, 255, 210), (76, 196, 126), (30, 112, 72)),
 'crystal': ((236, 255, 255), (150, 232, 255), (70, 150, 222)),
 'bone': ((252, 244, 224), (222, 206, 172), (152, 132, 100)),
 'water': ((206, 250, 255), (84, 204, 232), (30, 112, 172)),
 'sky': ((255, 255, 236), (250, 226, 140), (204, 156, 56)),
 'purple': ((232, 196, 255), (164, 104, 224), (92, 50, 142)),
 'stone': ((190, 180, 164), (140, 130, 116), (90, 82, 72)),
 'wood': ((196, 140, 84), (150, 96, 50), (100, 60, 30)),
}
# 柄：亮、暗
WOOD = {'wood': ((176, 116, 62), (112, 66, 34)), 'dk': ((120, 80, 50), (70, 44, 26)), 'red': ((196, 66, 50), (120, 34, 30)),
        'black': ((78, 78, 90), (40, 40, 50)), 'white': ((240, 236, 226), (186, 180, 166)), 'gold': ((250, 204, 80), (176, 116, 32)),
        'blue': ((80, 130, 220), (40, 70, 140)), 'green': ((80, 170, 100), (36, 100, 56)), 'purple': ((150, 90, 200), (80, 44, 120)),
        'bone': ((236, 222, 192), (176, 156, 120))}
GEM = {'r': ((255, 150, 150), (220, 40, 50)), 'b': ((170, 220, 255), (40, 110, 230)), 'g': ((170, 255, 180), (30, 170, 70)),
       'p': ((230, 170, 255), (140, 60, 210)), 'y': ((255, 250, 170), (240, 190, 30)), 'c': ((210, 255, 255), (40, 200, 230)),
       'w': ((255, 255, 255), (200, 210, 230))}
GOLD = WOOD['gold']


def canvas(w, h): return np.zeros((h, w, 4), np.uint8)


def px(a, x, y, c):
    x, y = int(round(x)), int(round(y))
    if 0 <= y < a.shape[0] and 0 <= x < a.shape[1]: a[y, x] = (*c, 255)


O = (28, 20, 26)
WHITE = (255, 255, 255)


def M(mat): return pal5(*MET[mat])
def Wd(w): return pal4w(*WOOD[w])
def Gp(g): lt, dk = GEM[g]; return [mix(dk, O, .45), dk, mix(lt, dk, .45), lt, WHITE]
def Tc(c): return pal4w(c, mix(c, O, .45))


def rect(x0, y0, x1, y1): return [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]


def rrect(x0, y0, x1, y1, r):
    r = min(r, (x1 - x0) / 2, (y1 - y0) / 2)
    return [(x0 + r, y0), (x1 - r, y0), (x1, y0 + r), (x1, y1 - r), (x1 - r, y1), (x0 + r, y1), (x0, y1 - r), (x0, y0 + r)]


def gem(c, x, y, g, r=2.0):
    c.fill([ellipse(x, y, r, r, 18)], Gp(g), base=.42, amp=.75, bev=1.6)
    c.dots([(x - r * .4, y - r * .45)], WHITE)


def knob(c, x, y, r=2.0, col='gold'):
    c.fill([ellipse(x, y, r, r, 16)], Wd(col) if col in WOOD else M(col), base=.5, amp=.8, bev=1.5)


def hatch(c, m, col, step=3.0, w=1.0):
    sel = m & (((c.X - c.Y * .9) % step) < w)
    c.a[sel, :3] = col


def shaft(c, x0, x1, hw, wood, bands=None, every=12, start=8):
    m = c.fill([rrect(x0, -hw, x1, hw, .5)], Wd(wood), base=.52, amp=.75, bev=1.6)
    if bands:
        for x in np.arange(x0 + start, x1 - 4, every):
            c.fill([rrect(x - 1, -hw - .5, x + 1, hw + .5, .4)], Wd(bands), base=.55, amp=.8, bev=1.2)
    return m


class Scaled:
    """把零件以 (x0,0) 為中心放大 k 倍再畫（槍頭、杖頭做成 Q 版大頭）"""
    def __init__(s, c, x0, k): s.c, s.x0, s.k = c, x0, k
    def __getattr__(s, n): return getattr(s.c, n)
    def T(s, P): return [[(s.x0 + (x - s.x0) * s.k, y * s.k) for x, y in p] for p in P]
    def fill(s, polys, pal, **kw):
        if 'holes' in kw: kw['holes'] = s.T(kw['holes'])
        if 'split' in kw and kw['split']:
            (ax, ay), (bx, by), d = kw['split']; kw['split'] = ((s.x0 + (ax - s.x0) * s.k, ay * s.k), (s.x0 + (bx - s.x0) * s.k, by * s.k), d)
        return s.c.fill(s.T(polys), pal, **kw)
    def mask(s, polys, holes=()): return s.c.mask(s.T(polys), s.T(holes))
    def dots(s, pts, col): s.c.dots(s.T([pts])[0], col)


# ---------- 劍、小刀 ----------
def blade_poly(x0, L, w, shape, curve):
    N = max(10, int(L * 3)); top, bot = [], []
    sabre = curve > 0 or shape in ('cleaver', 'tusk', 'hook')
    tl = .12 if shape == 'cleaver' else .26 if sabre else .22
    for i in range(N + 1):
        t = i / N; x = x0 + L * t; yc = -curve * 1.0 * t * t
        hw = w / 2
        if shape == 'broad' and t > .15: hw += .9 * min(1, (t - .15) * 6)
        if shape == 'needle': hw = w / 2 if t < .08 else 1.25
        if shape == 'tusk': hw = w / 2 * (.75 + .9 * t ** 1.2)
        if shape == 'cleaver': hw = w / 2 + 2.4 * t ** 1.1
        if shape == 'kris': yc += math.sin(t * math.pi * 4.5) * 1.15
        ht = hb = hw
        if shape == 'flame': wv = .95 * math.sin(L * t * 1.15); ht += wv; hb -= wv * .8
        if shape == 'serrate' and .08 < t < 1 - tl and ((x - x0) % 3.2) < 1.3: hb -= 1.3
        tp, bt = yc - ht, yc + hb
        u = (t - (1 - tl)) / tl
        if u > 0:
            if sabre: tp = tp + (bt - tp) * .18 * u * u; bt = tp + (bt - tp) * (1 - u) ** 1.15
            else: k = (1 - u) ** .85; tp = yc - ht * k; bt = yc + hb * k
        top.append((x, tp)); bot.append((x, bt))
    return top + bot[::-1], top, bot, sabre


def guard(c, x, gh, style, gc='gold', blade_w=4):
    P = Wd(gc) if gc in WOOD else M(gc)
    if style == 'none': return
    if style == 'bar': c.fill([rrect(x - .3, -gh, x + 3.4, gh, 1.2)], P, base=.52, amp=.8, bev=1.4)
    elif style == 'cross':
        c.fill([rrect(x - .3, -gh + .6, x + 3.4, gh - .6, 1.0)], P, base=.52, amp=.8, bev=1.4)
        for sg in (-1, 1): c.fill([ellipse(x + 1.6, sg * (gh - .2), 2.4, 2.2, 14)], P, base=.55, amp=.8, bev=1.4)
    elif style == 'wing':
        for sg in (-1, 1):
            c.fill([band(bez((x, sg * 1.2), (x + 1, sg * gh * .8), (x + 5.5, sg * (gh + 1.2))), 3.4, 1.6)], P, base=.55, amp=.8, bev=1.4)
        c.fill([rrect(x - .5, -2.5, x + 3, 2.5, .8)], P, base=.5, amp=.8, bev=1.4)
    elif style == 'cup':
        c.fill([ellipse(x + 1, 0, 4.2, gh + .5, 24, -math.pi / 2, math.pi / 2)], P, base=.55, amp=.8, bev=1.8)
    elif style == 'tsuba':
        c.fill([ellipse(x + 1.5, 0, 2.0, gh + .3, 20)], M('dark'), base=.45, amp=.8, bev=1.3)
        c.dots([(x + 1, -gh + 1.2)], (190, 180, 150))
    elif style == 'ring':
        c.fill([ellipse(x + 1.5, 0, 2.6, gh, 20)], P, base=.55, amp=.8, bev=1.2, holes=[ellipse(x + 1.5, 0, 1.0, gh - 1.8, 16)])
    elif style == 'dragon':
        J = M('jade')
        c.fill([ellipse(x + 2, 0, 3.4, gh + 1, 22)], J, base=.5, amp=.8, bev=1.4, holes=[ellipse(x + 2, 0, 1.4, gh - 1.2, 16)])
        c.fill([band(bez((x + 2, -gh - .5), (x + 6, -gh - 2), (x + 8, -gh + 1)), 2.2, 1.0)], J, base=.6, amp=.8, bev=1.2)


def sword(s, dag=False):
    L = s.get('L', 30) * (1.0 if dag else 1.05); grip = s.get('grip', 6) * 1.15 + (1.5 if dag else 2.5)
    w = s.get('w', 2) + (2.4 if dag else 3.0); shape = s.get('shape', 'straight'); curve = s.get('curve', 0)
    gh = s.get('gh', 3) * 1.45 + (1.4 if dag else 2.2); mat = s.get('mat', 'steel')
    c = Cv(int(L + grip + 26), 46, 6, 23)
    gx0 = 1.5; gx1 = gx0 + grip
    # 柄
    hw = 1.9 if dag else 2.1
    m = c.fill([rrect(gx0, -hw, gx1 + 1, hw, .6)], Wd(s.get('wood', 'dk')), base=.5, amp=.75, bev=1.5)
    hatch(c, m, Wd(s.get('wrap') or s.get('wood', 'dk'))[0 if not s.get('wrap') else 2])
    # 柄頭
    pm = s.get('pommel', 'knob')
    if pm == 'knob': knob(c, gx0 - .3, 0, 2.3)
    elif pm == 'ring': c.fill([ellipse(gx0 - 2.5, 0, 3.0, 2.8, 20)], Wd('gold'), base=.55, amp=.8, bev=1.2, holes=[ellipse(gx0 - 2.5, 0, 1.2, 1.1, 12)])
    elif pm == 'gem': gem(c, gx0 - 1.2, 0, s.get('pg') or 'r', 2.4)
    elif pm == 'tassel':
        c.fill([band(bez((gx0 - 1, 0), (gx0 - 4, 3), (gx0 - 4, 8)), 2.6, 1.6)], Tc((210, 50, 50)), base=.55, amp=.7, bev=1.2)
        knob(c, gx0 - .3, 0, 2.1)
    # 刃
    x0 = gx1 + 1.5
    poly, top, bot, sabre = blade_poly(x0, L, w, shape, curve)
    if shape == 'flame':
        P = [(110, 18, 20), (196, 44, 30), (246, 116, 40), (255, 196, 84), (255, 248, 190)]
        bm = c.fill([poly], P, base=.55, amp=.55, bev=2.0, tf=lambda X, Y: .25 * np.clip((X - x0) / L, 0, 1))
    else:
        tip = top[-1]
        sp = None if sabre else ((x0, -curve * 0), (tip[0], tip[1]), .2)
        if not sabre and curve == 0: sp = ((x0, 0), (x0 + L, 0), .2)
        bm = c.fill([poly], M(mat), base=.56, amp=.55, bev=2.4, split=sp)
        if sabre:  # 刃口（外彎那邊）一條亮邊
            em = c.mask([band(bot[2:-3], 2.0 if dag else 2.6)]) & bm
            c.fill([], M(mat), base=.8, amp=.2, bev=1, m=em, sep=False)
    if shape == 'hook':
        tx, ty = top[-1]
        c.fill([band(bez((tx - 1, ty + 1), (tx + 1.5, ty - 3), (tx - 3, ty - 4.5)), 2.6, 1.2)], M(mat), base=.6, amp=.6, bev=1.4)
    if s.get('fuller'):
        n = len(top); fl = [((top[i][0]), (top[i][1] + bot[i][1]) / 2) for i in range(2, int(n * .62))]
        c.fill([band(fl, 1.3)], M(mat), base=.15, flat=True, sep=False)
    # 反光點
    if shape != 'flame':
        c.dots([(top[int(len(top) * .7)][0], top[int(len(top) * .7)][1] + .6), (top[int(len(top) * .7)][0] + 1, top[int(len(top) * .7)][1] + .6)], WHITE)
    guard(c, gx1 - .2, gh, s.get('guard', 'bar'), s.get('gc', 'gold'))
    if s.get('gem'): gem(c, gx1 + 1.3, 0, s['gem'], 1.9 if dag else 2.2)
    return c, (gx0 + grip / 2, 0)


# ---------- 斧 ----------
def crescent(c, cx, R, D, mat, side=1, horn=.56, back=.66, beard=0, edge=True, base=.42):
    """斧刃：腰細、兩角外翹、刃口外凸；side＝往哪邊長（1＝+y）、beard＞0 後角往柄尾拖"""
    s = side
    nl, nr = (cx - 3.0, s * .4), (cx + 3.0, s * .4)
    hy = D * horn
    hl = (cx - R - 2.4 - beard, s * (hy * .5 + beard * .5)); hr = (cx + R + 2.4, s * (hy * .5))
    arc = []
    for i in range(25):
        a = math.pi * i / 24; k = (1 - a / math.pi) ** 2
        arc.append((cx - (R + 1.2) * math.cos(a) - beard * k, s * (hy + (D - hy) * math.sin(a) ** .7 + beard * .5 * k)))
    poly = [nl] + bez(nl, (cx - 2.4, s * D * back), hl, 10)[1:] + arc + bez(hr, (cx + 2.4, s * D * back), nr, 10)[1:]
    m = c.fill([poly], M(mat), base=base, amp=.6, bev=2.2)
    if edge:
        em = c.mask([band(arc[1:-1], 4.6)]) & m
        c.fill([], M(mat), base=.72, amp=.35, bev=1.2, m=em, sep=False)
        mid = arc[len(arc) // 2 - 4]
        c.dots([(mid[0], mid[1] - s * 1.0), (mid[0] + 1, mid[1] - s * 1.0)], WHITE)
    return m, arc


def axe(s):
    sz = s.get('size', 1.0); kind = s.get('kind', 'crescent'); mat = s.get('mat', 'steel')
    Ls = s.get('L', 44) * 1.05; gxp = s.get('gx', 11) * 1.05
    c = Cv(int(Ls + 40), 90, 8, 45)
    shaft(c, 0, Ls, 1.8, s.get('wood', 'wood'))
    m = c.fill([rrect(gxp - 2, -2.1, gxp + 2.5, 2.1, .6)], Wd(s.get('wrap', 'gold')), base=.5, amp=.75, bev=1.3)
    hatch(c, m, Wd(s.get('wrap', 'gold'))[1])
    knob(c, -.5, 0, 2.2)
    cx = Ls - 7.5 * sz
    if s.get('spike') or kind in ('huge', 'mino', 'exec'):
        c.fill([[(Ls - 2, -2.2), (Ls + 7 * sz, 0), (Ls - 2, 2.2)]], M(mat), base=.55, amp=.6, bev=1.6, split=((Ls - 2, 0), (Ls + 7, 0), .18))
    else: knob(c, Ls + .3, 0, 2.2)
    if kind == 'crescent': crescent(c, cx, 10 * sz, 17 * sz, mat)
    elif kind == 'hand': crescent(c, cx + 1, 7.5 * sz, 12.5 * sz, mat)
    elif kind == 'beard': crescent(c, cx, 9 * sz, 15 * sz, mat, beard=6)
    elif kind == 'double':
        crescent(c, cx, 9 * sz, 14 * sz, mat); crescent(c, cx, 9 * sz, 14 * sz, mat, side=-1)
    elif kind == 'moon': crescent(c, cx - 1, 13 * sz, 17 * sz, mat, horn=.72, back=.5)
    elif kind == 'huge':
        crescent(c, cx, 12 * sz, 21 * sz, mat)
        c.fill([[(cx - 3, -1.5), (cx - 1, -7 * sz), (cx + 3, -1.5)]], M(mat), base=.5, amp=.6, bev=1.5)
    elif kind == 'exec':
        poly = [(cx - 4, .5), (cx - 8, 5), (cx - 8.5, 19)] + [(cx - 8.5 + 17 * i / 10, 19 + 1.2 * math.sin(math.pi * i / 10)) for i in range(11)] + [(cx + 8.5, 4), (cx + 4, .5)]
        m = c.fill([poly], M(mat), base=.48, amp=.55, bev=2.4)
        em = c.mask([band([(cx - 8.5 + 17 * i / 10, 19 + 1.2 * math.sin(math.pi * i / 10)) for i in range(11)], 4.4)]) & m
        c.fill([], M(mat), base=.78, amp=.3, bev=1, m=em, sep=False)
        c.fill([ellipse(cx, 9, 2.0, 2.0, 14)], M('dark'), base=.25, flat=True)
    elif kind == 'claw':
        m, arc = crescent(c, cx, 9 * sz, 14 * sz, mat)
        for k in (5, 12, 19):
            x, y = arc[k]
            c.fill([[(x - 2, y - 1), (x + 3.5, y + 5), (x + 1.5, y - .5)]], M(mat), base=.6, amp=.6, bev=1.3)
    elif kind == 'ox':
        crescent(c, cx, 12 * sz, 17 * sz, mat)
        for sg in (-1, 1):
            c.fill([band(bez((cx + sg * 2, -1), (cx + sg * 8, -4), (cx + sg * 7, -11)), 3.4, 1.0)], M('bone'), base=.55, amp=.7, bev=1.5)
    elif kind == 'mino':
        crescent(c, cx, 12 * sz, 19 * sz, mat); crescent(c, cx, 12 * sz, 19 * sz, mat, side=-1)
    elif kind == 'wing':
        crescent(c, cx, 11 * sz, 16 * sz, mat)
        for i, (dx, ln) in enumerate(((-6, 9), (-2, 11), (2, 9))):
            c.fill([band(bez((cx + dx, -1), (cx + dx - 1, -ln * .6), (cx + dx - 4, -ln)), 3.2, .8)], M('sky'), base=.6, amp=.7, bev=1.3)
    c.fill([rrect(cx - 3.5, -2.8, cx + 3.5, 2.8, .8)], Wd('gold'), base=.5, amp=.8, bev=1.4)
    if s.get('gem'): gem(c, cx, 0, s['gem'], 2.0)
    return c, (gxp, 0)


# ---------- 槍 ----------
def leaf(c, x0, L, W, mat, base_w=2.0, y=0, back=False):
    sg = -1 if back else 1
    pts = [(x0, y - base_w)] + bez((x0, y - base_w), (x0 + sg * L * .3, y - W * 1.25), (x0 + sg * L, y), 10)[1:] + bez((x0 + sg * L, y), (x0 + sg * L * .3, y + W * 1.25), (x0, y + base_w), 10)[1:]
    m = c.fill([pts], M(mat), base=.56, amp=.55, bev=2.0, split=((x0, y), (x0 + sg * L, y), .22) if not back else ((x0 + sg * L, y), (x0, y), -.22))
    c.dots([(x0 + sg * L * .45, y - W * .55)], WHITE)
    return m


def spear_head(c, x0, mat, kind, sz):
    if kind == 'leaf': leaf(c, x0, 16 * sz, 4.4 * sz, mat)
    elif kind == 'pike': leaf(c, x0, 21 * sz, 2.7, mat, 1.8)
    elif kind == 'broad': leaf(c, x0, 17 * sz, 6.2 * sz, mat, 2.4)
    elif kind == 'double': leaf(c, x0, 16, 4.6, mat)
    elif kind == 'crude':
        c.fill([[(x0, -3), (x0 + 4, -5), (x0 + 9, -3.5), (x0 + 13, -.5), (x0 + 9, 3.5), (x0 + 4, 4.5), (x0, 3)]], M('stone'), base=.5, amp=.6, bev=2.0)
        c.dots([(x0 + 4, -3.5), (x0 + 8, 1)], M('stone')[1])
    elif kind == 'glaive':
        k = sz
        edge = bez((x0, -2.5), (x0 + 9 * k, -14 * k), (x0 + 25 * k, -7 * k), 16)
        back = bez((x0 + 25 * k, -7 * k), (x0 + 14 * k, 1), (x0 + 1, 3), 14)
        m = c.fill([edge + back[1:]], M(mat), base=.52, amp=.55, bev=2.4)
        em = c.mask([band(edge[1:], 4.4)]) & m
        c.fill([], M(mat), base=.8, amp=.3, bev=1, m=em, sep=False)
        c.fill([[(x0 + 6 * k, 1.5), (x0 + 9 * k, 4.5 * k), (x0 + 10 * k, 1)]], M(mat), base=.5, amp=.6, bev=1.3)
        c.dots([(x0 + 13 * k, -8.5 * k), (x0 + 14 * k, -8.5 * k)], WHITE)
    elif kind == 'halberd':
        crescent(c, x0 + 3, 5, 10, mat, horn=.45)
        c.fill([[(x0 + 1, -1.5), (x0 + 3, -7), (x0 + 5, -1.5)]], M(mat), base=.55, amp=.6, bev=1.4)
        leaf(c, x0 + 3, 16, 2.8, mat, 1.8)
    elif kind in ('fork', 'trident'):
        P = M(mat); h = 6.5 if kind == 'trident' else 5
        c.fill([rrect(x0, -h, x0 + 3, h, 1.2)], P, base=.5, amp=.7, bev=1.5)
        prongs = (-1, 0, 1) if kind == 'trident' else (-1, 1)
        for p in prongs:
            if p == 0: pts = [(x0 + 2, 0), (x0 + 18, 0)]; w0 = 2.8
            else: pts = bez((x0 + 2, p * (h - 1.5)), (x0 + 10, p * (h - .5)), (x0 + 14, p * (h - 2.5)), 8); w0 = 2.4
            c.fill([band(pts, w0, .9)], P, base=.58, amp=.6, bev=1.4)
            tx, ty = pts[-1]; c.fill([[(tx - 1, ty - 2.2), (tx + 3, ty), (tx - 1, ty + 2.2)]], P, base=.6, amp=.6, bev=1.2)
    elif kind == 'scorpion':
        leaf(c, x0, 12, 3.4, mat)
        c.fill([band(bez((x0 + 4, -2), (x0 + 6, -10), (x0 - 1, -9)), 2.8, 1.0)], M(mat), base=.55, amp=.6, bev=1.4)
    elif kind == 'winged':
        for sg in (-1, 1): c.fill([[(x0 + 1, sg * 1.5), (x0 + 4, sg * 2), (x0 - 1, sg * 8), (x0 - 2.5, sg * 6.5)]], M(mat), base=.55, amp=.6, bev=1.5)
        leaf(c, x0 + 2, 15, 4.2, mat)
    elif kind == 'hook':
        leaf(c, x0, 15, 3.4, mat)
        c.fill([band(bez((x0 + 3, 2), (x0 + 6, 8), (x0 + 11, 6.5)), 2.6, 1.0)], M(mat), base=.55, amp=.6, bev=1.4)
    elif kind == 'snake':
        pts = [(x0 + i, math.sin(i / 2.6) * 2.0) for i in range(22)]
        c.fill([band(pts, 4.4, 1.0)], M(mat), base=.56, amp=.6, bev=1.8)
        c.dots([(x0 + 7, -1.2)], WHITE)
    elif kind == 'lance':
        c.fill([[(x0, -5.2), (x0 + 24, 0), (x0, 5.2)]], M(mat), base=.55, amp=.55, bev=2.4, split=((x0, 0), (x0 + 24, 0), .22))
        c.fill([ellipse(x0, 0, 2.4, 7.5, 22)], M(mat), base=.48, amp=.7, bev=1.6)
        c.dots([(x0 + 8, -2.5)], WHITE)
    elif kind == 'sky':
        for sg in (-1, 1): c.fill([band(bez((x0 + 1, sg * 1.5), (x0 + 2, sg * 8), (x0 - 6, sg * 10)), 3.2, .9)], M('sky'), base=.6, amp=.7, bev=1.4)
        leaf(c, x0 + 1, 19, 4.8, mat)


def spear(s):
    sz = s.get('sz', 1.0); kind = s.get('kind', 'leaf'); mat = s.get('mat', 'steel')
    Ls = s.get('L', 66) * 1.15
    c = Cv(int(Ls + 46), 60, 14, 30)
    shaft(c, 0, Ls, 1.6, s.get('wood', 'wood'), s.get('bands'), 14, 9)
    knob(c, .5, 0, 2.0)
    if kind == 'double' or s.get('back'): leaf(c, -.5, 11, 3.6, mat, 1.8, back=True)
    if s.get('tassel', True) and kind != 'lance':
        tc = s.get('tc', (206, 44, 44)); x = Ls - 1
        pts = [(x + 1.5, -1.8), (x - 2, -4.2), (x - 7, -4.5), (x - 11, -1.5), (x - 13, 2.5), (x - 10, 5.5), (x - 6, 6.2), (x - 2.5, 4), (x + 1.5, 2)]
        m = c.fill([pts], Tc(tc), base=.5, amp=.7, bev=1.6)
        sel = m & (((c.Y * 1.0 + c.X * .35) % 2.6) < .9) & (c.X < x - 2)
        c.a[sel, :3] = Tc(tc)[1]
    c.fill([rrect(Ls - .5, -2.4, Ls + 4, 2.4, .8)], Wd('gold') if mat not in ('dark', 'purple') else M('dark'), base=.5, amp=.8, bev=1.4)
    spear_head(Scaled(c, Ls + 3.5, 1.2), Ls + 3.5, mat, kind, sz)
    if s.get('gem'): gem(c, Ls + 1.8, 0, s['gem'], 1.9)
    return c, (Ls * .38, 0)


# ---------- 杖 ----------
def staff_head(c, x0, kind, g, mat):
    P = M(mat); gg = g or 'b'
    if kind == 'orb':
        c.fill([ellipse(x0 + 6.5, 0, 6.8, 6.8, 30)], P, base=.55, amp=.75, bev=1.6, holes=[ellipse(x0 + 6.5, 0, 4.4, 4.4, 24)])
        c.fill([rect(x0 + 11.5, -1.6, x0 + 14, 1.6)], [(0, 0, 0)] * 5, flat=True, sep=False); c.a[c.pid == c.n] = 0
        gem(c, x0 + 6.5, 0, gg, 3.4)
    elif kind == 'crystal':
        for sg in (-1, 1): c.fill([band(bez((x0, sg * 1.5), (x0 + 3, sg * 5.5), (x0 + 6, sg * 4)), 2.0, 1.0)], P, base=.55, amp=.7, bev=1.2)
        c.fill([[(x0 + 1, -2), (x0 + 5, -5), (x0 + 11, -3.5), (x0 + 15, 0), (x0 + 11, 3.5), (x0 + 5, 5), (x0 + 1, 2)]], Gp(gg), base=.5, amp=.6, bev=2.0, split=((x0, 0), (x0 + 15, 0), .2))
        c.dots([(x0 + 6, -2.5), (x0 + 7, -2.5)], WHITE)
    elif kind == 'crook':
        pts = [(x0 + 6 * math.sin(a), -6 * (1 - math.cos(a))) for a in (i / 20 * math.pi * 1.45 for i in range(21))]
        c.fill([band(pts, 3.4, 2.4)], P, base=.55, amp=.75, bev=1.5)
        if g: gem(c, x0 + 1.5, -6.5, g, 2.2)
    elif kind == 'star':
        pts = []
        for k in range(10):
            a = -math.pi / 2 + k * math.pi / 5; r = 7.2 if k % 2 == 0 else 3.0
            pts.append((x0 + 6.5 + r * math.cos(a), r * math.sin(a)))
        c.fill([pts], P, base=.58, amp=.7, bev=1.8)
        gem(c, x0 + 6.5, 0, gg, 2.2)
    elif kind == 'sun':
        for k in range(8):
            a = k * math.pi / 4
            c.fill([[(x0 + 6.5 + 3.5 * math.cos(a - .35), 3.5 * math.sin(a - .35)), (x0 + 6.5 + 8 * math.cos(a), 8 * math.sin(a)), (x0 + 6.5 + 3.5 * math.cos(a + .35), 3.5 * math.sin(a + .35))]], Wd('gold'), base=.58, amp=.7, bev=1.3)
        gem(c, x0 + 6.5, 0, gg, 4.2)
    elif kind == 'moon':
        c.fill([ellipse(x0 + 6, 0, 7, 7, 30)], P, base=.6, amp=.7, bev=1.8, holes=[ellipse(x0 + 9.5, -1, 6, 6, 28)])
        if g: gem(c, x0 + 3, 0, g, 2.0)
    elif kind == 'wing':
        for sg in (-1, 1):
            for j, (ln, dx) in enumerate(((11, 0), (8.5, 2.5), (6, 5))):
                c.fill([band(bez((x0 + 3 + dx * .3, sg * 2), (x0 + 1 - dx * .2, sg * ln * .7), (x0 - 3 + dx, sg * ln)), 3.6, 1.2)], pal5((255, 255, 255), (214, 224, 240), (150, 164, 196)), base=.6, amp=.6, bev=1.3)
        gem(c, x0 + 5, 0, gg, 3.4)
    elif kind == 'horn':
        for sg in (-1, 1):
            c.fill([band(bez((x0 + 2, sg * 2), (x0 + 3, sg * 9), (x0 + 12, sg * 7.5)), 3.6, 1.0)], pal5((236, 220, 200), (150, 70, 70), (80, 26, 34)), base=.5, amp=.7, bev=1.4, tf=lambda X, Y: .3 * np.clip((X - x0 - 4) / 8, 0, 1))
        gem(c, x0 + 4.5, 0, gg, 3.2)
    elif kind == 'hammer':
        c.fill([rrect(x0, -7, x0 + 10, 7, 1.5)], P, base=.52, amp=.7, bev=2.2)
        for x, y in ((x0 + 5, -7), (x0 + 5, 7), (x0 + 10, 0)):
            dx, dy = (0, -1) if y < 0 else (0, 1) if y > 0 else (1, 0)
            c.fill([[(x - 2 * abs(dy) , y - 2 * abs(dx)), (x + 4 * dx, y + 4 * dy), (x + 2 * abs(dy), y + 2 * abs(dx))]], P, base=.6, amp=.6, bev=1.2)
        c.fill([rect(x0 + 2, -7.5, x0 + 3.5, 7.5)], Wd('gold'), base=.5, amp=.7, bev=1)
    elif kind == 'hand':
        gem(c, x0 + 6.5, 0, gg, 4.0)
        for sg in (-1, 1):
            for j, a in enumerate((.6, 1.3)):
                c.fill([band(bez((x0 + 1, sg * 1.5), (x0 + 3 + 3 * j, sg * 7), (x0 + 9 + 2 * j, sg * (5.5 - 3 * j))), 2.4, .9)], Wd('gold'), base=.55, amp=.7, bev=1.2)
    elif kind == 'crown':
        pts = [(x0, -4), (x0 + 3, -4), (x0 + 3.5, -7), (x0 + 5.5, -4.5), (x0 + 7.5, -7.5), (x0 + 8, -4), (x0 + 8, 4), (x0 + 7.5, 7.5), (x0 + 5.5, 4.5), (x0 + 3.5, 7), (x0 + 3, 4), (x0, 4)]
        c.fill([pts], Wd('gold'), base=.55, amp=.7, bev=1.6)
        for y in (-6.5, 6.5): gem(c, x0 + 7.5, y, 'r' if gg != 'r' else 'b', 1.2)
        gem(c, x0 + 11, 0, gg, 3.2)
    elif kind == 'knob':
        c.fill([ellipse(x0 + 3.5, 0, 4.6, 3.6, 24)], P, base=.55, amp=.75, bev=1.8)
        c.dots([(x0 + 2, -1.8)], WHITE)
    elif kind == 'branch':
        Wb = pal5(*MET['wood'])
        c.fill([band(bez((x0 - 1, 0), (x0 + 5, -1), (x0 + 11, -6)), 3.2, 1.6)], Wb, base=.55, amp=.7, bev=1.4)
        c.fill([band(bez((x0 + 3, 0), (x0 + 7, 2), (x0 + 11, 5)), 2.6, 1.2)], Wb, base=.55, amp=.7, bev=1.4)
        for x, y, r in ((x0 + 11, -8, 2.6), (x0 + 13, -4.5, 2.2), (x0 + 12.5, 6.5, 2.4), (x0 + 8, -8.5, 2.0)):
            c.fill([ellipse(x, y, r * 1.2, r * .8, 14)], pal5((170, 240, 140), (80, 180, 90), (30, 110, 60)), base=.55, amp=.7, bev=1.2)
        if g: gem(c, x0 + 9, -2, g, 2.0)
    elif kind == 'ring':
        c.fill([ellipse(x0 + 6.5, 0, 7, 7, 30)], P, base=.58, amp=.75, bev=1.6, holes=[ellipse(x0 + 6.5, 0, 5, 5, 26)])
        for y in (-7, 7): knob(c, x0 + 6.5, y, 1.6)
        gem(c, x0 + 6.5, 0, gg, 2.4)
    elif kind == 'sky':
        for sg in (-1, 1):
            c.fill([band(bez((x0 + 3, sg * 2.5), (x0 + 2, sg * 10), (x0 - 6, sg * 11)), 3.6, 1.0)], M('sky'), base=.6, amp=.7, bev=1.4)
            c.fill([band(bez((x0 + 2, sg * 2), (x0 - 1, sg * 7), (x0 - 7, sg * 7)), 2.8, .8)], M('sky'), base=.5, amp=.7, bev=1.3)
        c.fill([[(x0 + 8, -2), (x0 + 17, 0), (x0 + 8, 2)]], M('sky'), base=.6, amp=.6, bev=1.3)
        gem(c, x0 + 5.5, 0, gg, 3.6)


def staff(s):
    Ls = s.get('L', 56) * 1.12; kind = s.get('kind', 'orb')
    c = Cv(int(Ls + 36), 50, 6, 25)
    shaft(c, 0, Ls, 1.55, s.get('wood', 'wood'), s.get('bands'), 12, 11)
    knob(c, .3, 0, 1.9)
    m = c.fill([rrect(14, -1.9, 19, 1.9, .5)], Wd('gold'), base=.5, amp=.75, bev=1.2)
    hatch(c, m, Wd('gold')[1])
    c.fill([rrect(Ls - 2, -2.4, Ls + 1.5, 2.4, .8)], Wd('gold'), base=.52, amp=.8, bev=1.3)
    staff_head(Scaled(c, Ls + 1, 1.4), Ls + 1, kind, s.get('gem', 'b'), s.get('mat', 'gold'))
    return c, (16.5, 0)


# ---------- 弓（直放，往右瞄） ----------
def bow(s):
    kind = s.get('kind', 'simple'); wood = s.get('wood', 'wood')
    if kind == 'crossbow':
        c = Cv(56, 50, 10, 25)
        m = c.fill([[(-1, -2.2), (30, -2.2), (32, -1), (32, 1.8), (-1, 2.6), (-3, 4.5), (-6, 4.5), (-4, 1)]], Wd(wood), base=.5, amp=.75, bev=1.6)
        for sg in (-1, 1):
            c.fill([band(bez((26, sg * 1), (28, sg * 8), (24, sg * 15)), 3.4, 2.0)], M(s.get('mat', 'iron')), base=.55, amp=.7, bev=1.4)
        c.fill([rrect(24, -3, 29, 3, .8)], M(s.get('mat', 'iron')), base=.5, amp=.75, bev=1.3)
        c.fill([[(8, 2), (10, 2), (9, 6.5), (7.5, 6.5)]], M('dark'), base=.5, amp=.6, bev=1)
        for sg in (-1, 1): c.later([band([(24, sg * 15), (12, sg * .6)], 1.0 / c.k)], (232, 226, 206))
        if s.get('gem'): gem(c, 31, 0, s['gem'], 1.8)
        return c, (9, 0)
    H = s.get('H', 44) * 1.12; bend = s.get('bend', 5) * 1.35
    c = Cv(40, int(H + 30), 12, int(H / 2 + 15))
    curl = kind in ('recurve', 'composite', 'ornate', 'moon', 'sky')
    if kind == 'big': bend *= 1.3

    def lx(t, off=0):
        x = bend * (1 - t * t) + off
        if curl and abs(t) > .76: x += (abs(t) - .76) ** 1.4 * 22
        return x
    def limb(sg, off=0, P=None):
        pts = [(lx(sg * i / 20, off), sg * i / 20 * H / 2) for i in range(21)]
        c.fill([band(pts, 5.2, 2.6)], P or Wd(wood), base=.52, amp=.75, bev=1.6)
        return pts
    up = limb(-1); dn = limb(1)
    if kind == 'double': limb(-1, 4.5); limb(1, 4.5)
    tips = (up[-1], dn[-1])
    if kind in ('composite', 'ornate', 'sky'):
        bc = WOOD[s.get('bands', 'gold')] and s.get('bands', 'gold')
        for f in (-.5, .5): c.fill([band([(lx(f) - 0.2, f * H / 2 - 1.2), (lx(f) + .1, f * H / 2 + 1.2)], 5.0)], Wd(bc), base=.55, amp=.75, bev=1.2)
    if kind == 'moon':
        for sg in (-1, 1):
            pts = [(lx(sg * i / 20) + 2.6, sg * i / 20 * H / 2) for i in range(2, 15)]
            c.fill([band(pts, 1.6, .8)], pal5((240, 248, 255), (190, 214, 255), (120, 150, 220)), base=.8, flat=True, sep=False)
    if kind == 'sky':
        for t in tips:
            sg = 1 if t[1] > 0 else -1
            c.fill([band(bez((t[0] - 1, t[1] - sg * 4), (t[0] + 6, t[1] - sg * 3), (t[0] + 8, t[1] - sg * 9)), 3.0, .8)], M('sky'), base=.6, amp=.7, bev=1.3)
    for t in tips: knob(c, t[0] - .4, t[1], 1.6, 'bone' if kind in ('simple', 'big', 'double') else 'gold')
    m = c.fill([rrect(bend - 2.6, -4.5, bend + 2.6, 4.5, 1.0)], Wd(s.get('grip', 'gold')), base=.5, amp=.75, bev=1.4)
    hatch(c, m, Wd(s.get('grip', 'gold'))[1])
    if kind in ('ornate', 'sky', 'moon') or s.get('gem'):
        g = s.get('gem', 'c')
        gem(c, bend + 2.4, 0, g, 1.9)
        for f in (-.33, .33): gem(c, lx(f), f * H / 2, g, 1.4)
    sx = tips[0][0] - .2
    c.later([band([(tips[0][0] - .5, tips[0][1] + 1), (bend - 6.5, 0), (tips[1][0] - .5, tips[1][1] - 1)], 1.0 / c.k)], (236, 230, 212))
    return c, (bend, 0)


# ---------- 小刀 ----------
def dagger(s):
    kind = s.get('kind', 'straight')
    if kind == 'shuriken':
        c = Cv(30, 30, 15, 15); pts = []
        for k in range(8):
            a = k * math.pi / 4 + .3; r = 9 if k % 2 == 0 else 2.6
            pts.append((r * math.cos(a), r * math.sin(a)))
        c.fill([pts], M(s.get('mat', 'steel')), base=.55, amp=.7, bev=1.8, holes=[ellipse(0, 0, 1.2, 1.2, 10)])
        return c, (0, 0)
    if kind == 'disc':
        c = Cv(32, 32, 16, 16)
        c.fill([ellipse(0, 0, 8, 8, 32)], M(s.get('mat', 'steel')), base=.5, amp=.7, bev=2.0, holes=[ellipse(0, 0, 3.5, 3.5, 20)])
        em = c.mask([ellipse(0, 0, 8, 8, 32)]) & ~c.mask([ellipse(0, 0, 6.6, 6.6, 32)])
        c.fill([], M(s.get('mat', 'steel')), base=.82, amp=.3, bev=1, m=em, sep=False)
        c.fill([rrect(-7.5, -1.6, -2.5, 1.6, .5)], Wd('dk'), base=.5, amp=.7, bev=1.2)
        return c, (-5, 0)
    s = dict(s); s.setdefault('L', 16); s.setdefault('grip', 4); s.setdefault('guard', 'bar'); s.setdefault('gh', 2)
    shp = {'straight': 'straight', 'curved': 'straight', 'kris': 'kris', 'broad': 'broad', 'cleaver': 'cleaver', 'fang': 'tusk', 'ornate': 'straight',
           'kunai': 'straight', 'ear': 'straight', 'tanto': 'straight', 'needle': 'needle', 'serrate': 'serrate', 'hook': 'hook'}[kind]
    s['shape'] = shp
    if kind == 'curved': s['curve'] = s.get('curve', 3)
    if kind == 'tanto': s['curve'] = s.get('curve', .6)
    if kind == 'kunai': s['pommel'] = 'ring'; s['guard'] = 'none'
    if kind == 'ear': s['pommel'] = 'none'
    c, g = _sword_raw(s, dag=True)
    if kind == 'ear':
        for dy in (-3.2, 3.2): knob(c, .2, dy, 1.7)
    return c, g


def finish(fn):
    def run(s):
        c, (gx, gy) = fn(s)
        a = c.done()
        return a, (int(math.floor(gx + c.ox)), int(math.floor(gy + c.oy)))
    return run


def crop(a, gx, gy):
    ys, xs = np.nonzero(a[..., 3])
    x0, y0 = xs.min(), ys.min()
    return a[y0:ys.max() + 1, x0:xs.max() + 1], gx - x0, gy - y0


_sword_raw = sword
sword, axe, spear, staff, bow, dagger = (finish(f) for f in (sword, axe, spear, staff, bow, dagger))


DRAW = {'sword': sword, 'axe': axe, 'spear': spear, 'staff': staff, 'bow': bow, 'dagger': dagger}

# ---------- 每把的樣子 ----------
# 基本款 N／C／I／S／G／P／X：國民、銅、鐵、鋼、金（騎士）、白金、秘銀
TIER = {'N': dict(mat='iron', wood='wood'), 'C': dict(mat='bronze', wood='wood'), 'I': dict(mat='iron', wood='dk'), 'S': dict(mat='steel', wood='dk'),
        'G': dict(mat='gold', wood='red', gem='r'), 'P': dict(mat='plat', wood='white', gem='b'), 'X': dict(mat='mith', wood='blue', gem='c', glow='#7fe6ff')}
SPEC = {}
for t in 'NCISGPX':
    T = TIER[t]
    SPEC['sword' + t] = dict(T, L=30 + 'NCISGPX'.index(t), guard='cross' if t in 'GPX' else 'bar')
    SPEC['axe' + t] = dict(T, kind='crescent' if t not in 'G' else 'huge', size=1.0 + .05 * 'NCISGPX'.index(t))
    SPEC['spear' + t] = dict(T, kind='leaf' if t in 'NCIS' else 'winged' if t == 'P' else 'lance' if t == 'G' else 'broad')
    SPEC['dagger' + t] = dict(T, kind='straight' if t in 'NCIS' else 'ornate' if t != 'G' else 'kris')
SPEC['daggerG'] = dict(mat='dark', wood='black', kind='straight', guard='none', glow='#7a5cff')  # 影刃
SPEC.update({
 'bowN': dict(kind='simple'), 'bowW': dict(kind='simple', wood='dk'), 'bowH': dict(kind='recurve', grip='dk'), 'bowC': dict(kind='composite', bands='bone'),
 'bowG': dict(kind='simple', H=50, bend=4), 'bowP': dict(kind='composite', wood='dk', bands='gold', H=50), 'bowX': dict(kind='branch' if False else 'ornate', wood='green', gem='g', glow='#9cff9c', H=50),
 'staffN': dict(kind='knob', mat='wood'), 'staffS': dict(kind='knob', mat='iron', L=44), 'staffO': dict(kind='knob', mat='wood', wood='dk', bands='green'),
 'staffJ': dict(kind='crystal', gem='c', glow='#9ff'), 'staffG': dict(kind='star', mat='gold', gem='y'), 'staffP': dict(kind='orb', gem='p', wood='white'),
 'staffX': dict(kind='branch', wood='dk', gem='g', glow='#9cff9c'),
 # 劍
 'cg_sword_1': dict(L=32), 'cg_sword_2': dict(L=28, w=3, shape='broad'), 'cg_sword_3': dict(L=34, w=1, guard='cup', shape='needle', wood='black'),
 'cg_sword_4': dict(L=30, w=3, shape='flame', mat='red', glow='#ff8040'), 'cg_sword_5': dict(L=28, w=3, shape='serrate', mat='bronze'),
 'cg_sword_6': dict(L=36, w=3, grip=10, guard='cross', gh=4), 'cg_sword_7': dict(L=32, w=3, fuller=True, guard='cross'),
 'cg_sword_8': dict(L=30, w=2, shape='serrate', mat='dark', wood='black'), 'cg_sword_9': dict(L=26, w=3, guard='wing', wrap='red'),
 'cg_sword_10': dict(L=32, guard='wing', gh=5, wood='blue'), 'cg_sword_11': dict(L=34, w=2, curve=2.5, guard='tsuba', mat='dark', wood='black', wrap='white', pommel='none'),
 'cg_sword_12': dict(L=28, w=2, shape='tusk', curve=3, mat='bone', wood='dk', guard='bar', gc='wood'), 'cg_sword_13': dict(L=32, w=4, fuller=True, guard='cross', gh=4),
 'cg_sword_14': dict(L=40, w=4, grip=9, guard='cross', gh=5, fuller=True), 'cg_sword_15': dict(L=34, w=2, curve=3, guard='cup', wood='red'),
 'cg_sword_16': dict(L=22, w=2, guard='cross', gem='g'), 'cg_sword_17': dict(L=24, w=1, guard='bar', wood='black', grip=8),
 'cg_sword_18': dict(L=38, w=2, fuller=True, grip=8, guard='cross', mat='plat'), 'cg_sword_19': dict(L=32, w=2, shape='cleaver', curve=1.5, guard='dragon', mat='jade', wood='green', glow='#80ff9c'),
 'cg_sword_20': dict(L=32, w=2, curve=5, guard='bar', wood='red', wrap='gold'), 'cg_sword_21': dict(L=30, w=2, shape='hook', guard='wing', mat='dark'),
 'cg_sword_22': dict(L=34, w=3, fuller=True, guard='cross', gh=4, mat='plat', wood='gold', gem='r'), 'cg_sword_23': dict(L=42, w=4, grip=9, guard='cross', gh=5, mat='dark', wood='black', gem='r'),
 'dragonSword': dict(L=34, w=3, fuller=True, guard='wing', gh=4, mat='water', wood='blue', gem='c', glow='#4fd8ff'),
 'skySword': dict(L=38, w=2, curve=2.5, guard='tsuba', mat='sky', wood='white', wrap='gold', pommel='none', glow='#fff0a0'),
 # 斧
 'cg_axe_1': dict(kind='hand', L=30), 'cg_axe_2': dict(kind='crescent', mat='bronze', gem='r'), 'cg_axe_3': dict(kind='hand', L=32, size=1.3),
 'cg_axe_4': dict(kind='beard', L=36), 'cg_axe_5': dict(kind='hand', L=34, size=1.4, wrap='red'), 'cg_axe_6': dict(kind='crescent', mat='steel'),
 'cg_axe_7': dict(kind='crescent', L=56, gx=18), 'cg_axe_8': dict(kind='double'), 'cg_axe_9': dict(kind='claw'), 'cg_axe_10': dict(kind='huge', size=.9),
 'cg_axe_11': dict(kind='crescent', mat='purple', wood='black', gem='p', glow='#c080ff'), 'cg_axe_12': dict(kind='moon', L=50, gx=15),
 'cg_axe_13': dict(kind='huge'), 'cg_axe_14': dict(kind='double', size=1.2), 'cg_axe_15': dict(kind='huge', size=1.15, mat='gold', wood='red', gem='r'),
 'cg_axe_16': dict(kind='moon', mat='plat'), 'cg_axe_17': dict(kind='mino', mat='dark', wood='black', spike=True), 'cg_axe_18': dict(kind='claw', mat='plat', wood='black'),
 'cg_axe_19': dict(kind='exec', mat='iron', wood='black', spike=True), 'cg_axe_20': dict(kind='hand', L=36, size=1.3, mat='mith', wood='blue'),
 'cg_axe_21': dict(kind='huge', size=1.2, mat='dark', wood='black', spike=True), 'cg_axe_22': dict(kind='moon', L=58, gx=18, mat='steel', wood='dk'),
 'cg_axe_23': dict(kind='exec', mat='dark', wood='red'),
 'dragonAxe': dict(kind='double', mat='water', wood='blue', gem='c', glow='#4fd8ff', size=1.1), 'skyAxe': dict(kind='wing', mat='sky', wood='white', glow='#fff0a0'),
 'skyOx': dict(kind='ox', mat='bone', wood='dk', glow='#ffd080'),
 # 槍
 'cg_spear_1': dict(kind='leaf', L=50), 'cg_spear_2': dict(kind='lance', L=60, wood='dk'), 'cg_spear_3': dict(kind='pike'), 'cg_spear_4': dict(kind='leaf', wood='black', mat='iron', tassel=False),
 'cg_spear_5': dict(kind='glaive', sz=.8), 'cg_spear_6': dict(kind='pike', L=74), 'cg_spear_7': dict(kind='leaf', tc=(240, 240, 240)), 'cg_spear_8': dict(kind='fork'),
 'cg_spear_9': dict(kind='winged', bands='gold'), 'cg_spear_10': dict(kind='lance', mat='plat', wood='white'), 'cg_spear_11': dict(kind='glaive', mat='steel', wood='green', tc=(60, 170, 90)),
 'cg_spear_12': dict(kind='broad', sz=1.2), 'cg_spear_13': dict(kind='pike', L=80), 'cg_spear_14': dict(kind='scorpion', mat='dark', wood='black'), 'cg_spear_15': dict(kind='double', back=True),
 'cg_spear_16': dict(kind='broad', sz=1.3, mat='plat'), 'cg_spear_17': dict(kind='snake', wood='red', tc=(250, 220, 80)), 'cg_spear_18': dict(kind='hook', mat='dark'),
 'cg_spear_19': dict(kind='trident', mat='gold', wood='red', gem='r'), 'cg_spear_20': dict(kind='halberd', mat='steel', wood='black'), 'cg_spear_21': dict(kind='pike', L=80, mat='mith', wood='blue', glow='#7fe6ff'),
 'cg_spear_22': dict(kind='crude', wood='dk', tassel=False), 'cg_spear_23': dict(kind='snake', mat='purple', wood='black', glow='#c080ff'),
 'dragonSpear': dict(kind='trident', mat='water', wood='blue', gem='c', glow='#4fd8ff'), 'skySpear': dict(kind='sky', mat='sky', wood='white', tc=(250, 230, 150), glow='#fff0a0'),
 # 弓
 'cg_bow_1': dict(kind='simple', H=38), 'cg_bow_2': dict(kind='recurve', H=38, wood='dk'), 'cg_bow_3': dict(kind='recurve', H=40, grip='red'), 'cg_bow_4': dict(kind='recurve'),
 'cg_bow_5': dict(kind='composite', bands='bone', bend=6), 'cg_bow_6': dict(kind='composite', grip='red', bands='red'), 'cg_bow_7': dict(kind='simple', H=52, bend=3, wood='black'),
 'cg_bow_8': dict(kind='composite', H=52, bend=4, wood='black', bands='gold'), 'cg_bow_9': dict(kind='recurve', H=52, wood='red'), 'cg_bow_10': dict(kind='composite', bend=7, bands='gold', wood='dk'),
 'cg_bow_11': dict(kind='ornate', wood='green', gem='g', glow='#9cff9c'), 'cg_bow_12': dict(kind='big', H=56, wood='dk'), 'cg_bow_13': dict(kind='composite', H=54, bands='red'),
 'cg_bow_14': dict(kind='ornate', wood='white', gem='y', glow='#fff0a0'), 'cg_bow_15': dict(kind='moon', wood='white', gem='b', H=52, glow='#c0d8ff'), 'cg_bow_16': dict(kind='big', H=50, wood='black', bend=6),
 'cg_bow_17': dict(kind='double'), 'cg_bow_18': dict(kind='ornate', wood='blue', gem='y', H=52, glow='#ffe080'), 'cg_bow_19': dict(kind='ornate', wood='green', gem='w', H=50),
 'cg_bow_20': dict(kind='moon', wood='purple', gem='p', H=54, glow='#c080ff'), 'cg_bow_21': dict(kind='crossbow', wood='dk', mat='stone'), 'cg_bow_22': dict(kind='ornate', wood='purple', gem='c', glow='#9ff'),
 'cg_bow_23': dict(kind='crossbow', wood='black', mat='dark', gem='r', glow='#ff6060'),
 'dragonBow': dict(kind='composite', wood='blue', bands='white', gem='c', H=52, glow='#4fd8ff'), 'skyBow': dict(kind='sky', wood='white', bands='gold', gem='y', H=54, glow='#fff0a0'),
 # 杖
 'cg_staff_1': dict(kind='knob', mat='iron', L=44), 'cg_staff_2': dict(kind='crown', gem='r', L=46), 'cg_staff_3': dict(kind='orb', mat='bronze', gem='y', wood='dk'), 'cg_staff_4': dict(kind='crown', gem='b', wood='blue', L=46),
 'cg_staff_5': dict(kind='crook', mat='dark', wood='black', gem='p'), 'cg_staff_6': dict(kind='horn', wood='black', gem='p', L=50), 'cg_staff_7': dict(kind='crook', mat='wood', wood='dk', gem='g'),
 'cg_staff_8': dict(kind='crown', gem='g', wood='white', L=48), 'cg_staff_9': dict(kind='orb', gem='y', mat='bronze'), 'cg_staff_10': dict(kind='crown', gem='y', L=48),
 'cg_staff_11': dict(kind='crystal', gem='p', wood='black', glow='#c080ff'), 'cg_staff_12': dict(kind='ring', gem='r', mat='plat', bands='blue'), 'cg_staff_13': dict(kind='orb', gem='w', mat='plat', wood='white', glow='#ffffff'),
 'cg_staff_14': dict(kind='crystal', gem='r', wood='red'), 'cg_staff_15': dict(kind='crook', mat='stone', wood='dk'), 'cg_staff_16': dict(kind='star', gem='w', wood='white', L=44, glow='#ffffc0'),
 'cg_staff_17': dict(kind='horn', gem='r', wood='black', glow='#ff4040'), 'cg_staff_18': dict(kind='sun', gem='y', L=44, glow='#ffd060'), 'cg_staff_19': dict(kind='wing', gem='c', wood='white', glow='#e0f8ff'),
 'cg_staff_20': dict(kind='ring', gem='w', mat='gold', wood='white', glow='#fff0a0'), 'cg_staff_21': dict(kind='star', gem='c', mat='plat', wood='blue', L=44, glow='#a0f0ff'),
 'cg_staff_22': dict(kind='hand', gem='p', wood='purple', glow='#c080ff'), 'cg_staff_23': dict(kind='hammer', mat='steel', wood='dk'),
 'dragonStaff': dict(kind='orb', gem='c', mat='water', wood='blue', glow='#4fd8ff'),
 'skyStaff_earth': dict(kind='sky', gem='y', wood='white', glow='#e8c060'), 'skyStaff_water': dict(kind='sky', gem='b', wood='white', glow='#60b0ff'),
 'skyStaff_fire': dict(kind='sky', gem='r', wood='white', glow='#ff7050'), 'skyStaff_wind': dict(kind='sky', gem='g', wood='white', glow='#70ff90'),
 # 小刀
 'cg_dagger_1': dict(kind='straight'), 'cg_dagger_2': dict(kind='straight', L=18, mat='steel'), 'cg_dagger_3': dict(kind='disc'), 'cg_dagger_4': dict(kind='kunai', L=14),
 'cg_dagger_5': dict(kind='curved', curve=2), 'cg_dagger_6': dict(kind='tanto', L=18, guard='tsuba', wood='black'), 'cg_dagger_7': dict(kind='ear', L=16),
 'cg_dagger_8': dict(kind='straight', guard='cross', L=18, wood='blue'), 'cg_dagger_9': dict(kind='straight', guard='ring', L=17), 'cg_dagger_10': dict(kind='broad', w=2, guard='cross'),
 'cg_dagger_11': dict(kind='shuriken'), 'cg_dagger_12': dict(kind='broad', w=3), 'cg_dagger_13': dict(kind='hook', mat='dark', guard='wing'), 'cg_dagger_14': dict(kind='curved', curve=4, mat='gold', wood='red'),
 'cg_dagger_15': dict(kind='serrate', mat='dark', wood='black'), 'cg_dagger_16': dict(kind='cleaver', w=3, guard='none'), 'cg_dagger_17': dict(kind='kris', mat='bronze', wood='dk'),
 'cg_dagger_18': dict(kind='ornate', mat='gold', wood='purple', gem='p', guard='wing'), 'cg_dagger_19': dict(kind='hook', mat='steel', L=14, pommel='ring', guard='none'),
 'cg_dagger_20': dict(kind='needle', mat='mith', w=2, glow='#7fe6ff'), 'cg_dagger_21': dict(kind='fang', mat='dark', wood='red', curve=3, glow='#ff4040'), 'cg_dagger_22': dict(kind='serrate', mat='red', wood='black'),
 'cg_dagger_23': dict(kind='shuriken', mat='dark'),
 'dragonDagger': dict(kind='kris', mat='water', wood='blue', gem='c', glow='#4fd8ff'), 'skyDagger': dict(kind='curved', mat='sky', wood='white', curve=2, glow='#fff0a0'),
})
# 這些在 dagger() 裡要 'ornate' 帶寶石
for k, v in SPEC.items():
    if v.get('kind') == 'ornate' and not k.startswith('cg_bow') and 'bow' not in k: v.setdefault('gem', 'r'); v.setdefault('guard', 'wing')


def build(items):
    """items: [(id,type)] → 圖集 ndarray（美術像素）、表"""
    cells = []
    for wid, t in items:
        s = dict(SPEC.get(wid, {}))
        if t == 'bow' and s.get('kind') == 'branch': s['kind'] = 'ornate'
        a, (gx, gy) = DRAW[t](s)
        a, gx, gy = crop(a, gx, gy)
        cells.append((wid, t, a, gx, gy, s.get('glow')))
    # 一排一排塞（寬 512 美術像素）
    Wd = 400; x = y = rowh = 0; pos = []
    for c in cells:
        h, w = c[2].shape[:2]
        if x + w > Wd: x = 0; y += rowh + 1; rowh = 0
        pos.append((x, y)); x += w + 1; rowh = max(rowh, h)
    sheet = np.zeros((y + rowh + 1, Wd, 4), np.uint8)
    table = {}
    for (wid, t, a, gx, gy, glow), (x0, y0) in zip(cells, pos):
        h, w = a.shape[:2]; sheet[y0:y0 + h, x0:x0 + w] = a
        table[wid] = [int(v) for v in (x0 * K, y0 * K, w * K, h * K, gx * K + K // 2, gy * K + K // 2)] + ([glow] if glow else [])
    return sheet, table, cells


ICON = 34          # 圖示一格（美術像素），網頁上 1 美術像素＝1 CSS 像素
IK = 2             # 圖示圖檔放大倍數（手機 2 倍螢幕剛好清楚）


def icons(items, cells):
    """每把武器斜放（尖朝右上）的小圖示：照大圖的長寬算縮放，零件轉、縮之後重新點陣化"""
    import pix
    out = []
    for (wid, t), c in zip(items, cells):
        h, w = c[2].shape[:2]
        k = min(1.0, (ICON - 3) / ((w + h) / math.sqrt(2)))
        pix.MODE.update(rot=-math.pi / 4, k=k, size=92)
        try:
            a, _ = DRAW[t](dict(SPEC.get(wid, {})) if not (t == 'bow' and SPEC.get(wid, {}).get('kind') == 'branch') else dict(SPEC[wid], kind='ornate'))
        finally:
            pix.MODE.clear()
        a, _, _ = crop(a, 0, 0)
        cell = np.zeros((ICON, ICON, 4), np.uint8)
        ah, aw = a.shape[:2]; ah, aw = min(ah, ICON), min(aw, ICON)
        y0, x0 = (ICON - ah) // 2, (ICON - aw) // 2
        cell[y0:y0 + ah, x0:x0 + aw] = a[:ah, :aw]
        out.append(cell)
    cols = 16; rows = (len(out) + cols - 1) // cols
    sheet = np.zeros((rows * ICON, cols * ICON, 4), np.uint8); table = {}
    for i, ((wid, t), cell) in enumerate(zip(items, out)):
        x, y = i % cols * ICON, i // cols * ICON
        sheet[y:y + ICON, x:x + ICON] = cell; table[wid] = [x, y]
    return sheet, table


if __name__ == '__main__':
    items = json.loads(open('/dev/stdin').read())
    sheet, table, cells = build(items)
    Image.fromarray(sheet).resize((sheet.shape[1] * K, sheet.shape[0] * K), Image.NEAREST).save('../../www/assets/mud/wpn/sheet.png', optimize=True)
    isheet, itable = icons(items, cells)
    Image.fromarray(isheet).resize((isheet.shape[1] * IK, isheet.shape[0] * IK), Image.NEAREST).save('../../www/assets/mud/wpn/icons.png', optimize=True)
    with open('../../www/src/mud/wpn-data.mjs', 'w') as f:
        f.write('// scripts/doll/weapons.py 產生的，別手改：每把武器在 assets/mud/wpn/sheet.png 的 [x,y,寬,高,握把x,握把y,發光色?]（立繪像素）\n')
        f.write('export const WPN_ART=' + json.dumps(table, ensure_ascii=False, separators=(',', ':')) + ';\n')
        f.write('// 斜放的小圖示：assets/mud/wpn/icons.png（%d 倍圖），每格 %d×%d CSS 像素，[x,y]＝在圖上的位置（CSS 像素）\n' % (IK, ICON, ICON))
        f.write('export const WPN_ICON_SIZE=%d,WPN_ICON_W=%d,WPN_ICON=' % (ICON, isheet.shape[1]) + json.dumps(itable, separators=(',', ':')) + ';\n')
    if '--gallery' in sys.argv:
        out = sys.argv[sys.argv.index('--gallery') + 1]
        # 一覽圖：每種一列
        cols = 12; cw = 110; ch = 70
        rows = {}
        for c in cells: rows.setdefault(c[1], []).append(c)
        H = sum((len(v) + cols - 1) // cols for v in rows.values()) * ch
        g = Image.new('RGBA', (cols * cw, H), (52, 46, 40, 255)); yy = 0
        for t, lst in rows.items():
            for i, (wid, _, a, gx, gy, glow) in enumerate(lst):
                im = Image.fromarray(a).resize((a.shape[1] * 2, a.shape[0] * 2), Image.NEAREST)
                if im.width > cw - 6: im = im.resize((cw - 6, max(1, int(im.height * (cw - 6) / im.width))), Image.NEAREST)
                if im.height > ch - 6: im = im.resize((max(1, int(im.width * (ch - 6) / im.height)), ch - 6), Image.NEAREST)
                g.alpha_composite(im, ((i % cols) * cw + (cw - im.width) // 2, yy + (i // cols) * ch + (ch - im.height) // 2))
            yy += (len(lst) + cols - 1) // cols * ch
        g.save(out)
