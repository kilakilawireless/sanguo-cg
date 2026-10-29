# 紙娃娃的武器（Leo 2026-10-29「每個不同的武器樣子不同」）：196 把各自一張像素圖。
# 橫放、尖端朝右（弓直放、往右瞄）；1 格＝1 美術像素，最後放大 K 倍，跟立繪的顆粒一樣。
# 輸出 www/assets/mud/wpn/sheet.png（圖集）＋ www/src/mud/wpn-data.mjs（每把的位置、握把、發光色）。
# 用法：cd scripts/doll && python3 weapons.py [--gallery 一覽圖.png]
import sys, math, json
import numpy as np
from PIL import Image
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


def outline(a):
    op = a[..., 3] > 0; p = np.pad(op, 1)
    nb = p[:-2, 1:-1] | p[2:, 1:-1] | p[1:-1, :-2] | p[1:-1, 2:]
    a[nb & ~op] = (*O, 255); return a


def crop(a, gx, gy):
    ys, xs = np.nonzero(a[..., 3])
    x0, y0 = xs.min(), ys.min()
    return a[y0:ys.max() + 1, x0:xs.max() + 1], gx - x0, gy - y0


def gem(a, x, y, g, big=False):
    lt, dk = GEM[g]
    pts = [(0, 0), (1, 0), (0, 1), (1, 1)] if big else [(0, 0)]
    for dx, dy in pts: px(a, x + dx, y + dy, dk)
    px(a, x, y, lt)


# ---------- 柄 ----------
def handle(a, x0, x1, y, wood, wrap=None, pommel='knob', pg=None):
    lt, dk = WOOD[wood]
    for x in range(x0, x1 + 1):
        c1, c2 = (lt, dk)
        if wrap and (x - x0) % 2 == 0: c1, c2 = WOOD[wrap][0], WOOD[wrap][1]
        px(a, x, y, c1); px(a, x, y + 1, c2)
    if pommel == 'knob': px(a, x0 - 1, y, GOLD[0]); px(a, x0 - 1, y + 1, GOLD[1])
    elif pommel == 'ring':
        for dx, dy in ((-1, -1), (-2, -1), (-3, 0), (-3, 1), (-2, 2), (-1, 2)): px(a, x0 + dx, y + dy, GOLD[1])
    elif pommel == 'gem': gem(a, x0 - 2, y, pg or 'r', True)
    elif pommel == 'tassel':
        px(a, x0 - 1, y, GOLD[0]); px(a, x0 - 1, y + 1, GOLD[1])
        for i in range(4): px(a, x0 - 2 - i // 2, y + 2 + i, (210, 50, 50))


def guard(a, x, y, style, h=3, col=GOLD):
    lt, dk = col
    if style == 'none': return
    if style == 'bar':
        for yy in range(y - h + 1, y + h + 1): px(a, x, yy, lt); px(a, x + 1, yy, dk)
    elif style == 'cross':
        for yy in range(y - h, y + h + 2): px(a, x, yy, lt); px(a, x + 1, yy, dk)
        px(a, x - 1, y - h, lt); px(a, x - 1, y + h + 1, dk)
    elif style == 'wing':  # 往前翹的護手
        for i in range(h + 1): px(a, x + i // 2, y - i, lt); px(a, x + i // 2, y + 1 + i, dk)
        px(a, x, y, lt); px(a, x, y + 1, dk)
    elif style == 'cup':  # 杯形護手
        for yy in range(y - 3, y + 5):
            d = abs(yy - y - .5)
            px(a, x + (0 if d > 2.5 else 1 if d > 1.5 else 2), yy, lt if yy <= y else dk)
            px(a, x, yy, dk)
    elif style == 'tsuba':  # 圓鍔
        for yy in range(y - 2, y + 4): px(a, x, yy, (60, 56, 64)); px(a, x + 1, yy, (110, 100, 90))
    elif style == 'ring':
        for yy in range(y - 2, y + 4): px(a, x, yy, lt)
        px(a, x + 1, y - 2, dk); px(a, x + 1, y + 3, dk)
    elif style == 'dragon':  # 青龍刀的龍環
        for yy in range(y - 3, y + 5): px(a, x, yy, (60, 170, 90)); px(a, x + 1, yy, (30, 100, 60))
        px(a, x - 1, y - 3, (60, 170, 90)); px(a, x + 2, y + 4, (30, 100, 60))


# ---------- 刃（劍、小刀） ----------
def blade(a, x0, L, y, mat, w=2, shape='straight', curve=0.0, fuller=False):
    """刃：每一欄算上緣、下緣（浮點），中間填色；上緣亮、下緣暗。curve＞0 往上彎"""
    lt, md, dk = MET[mat]
    for i in range(L):
        x = x0 + i; t = i / max(1, L - 1); tip = L - 1 - i
        top = y + .5 - w / 2 - curve * t * t
        wd = float(w)
        if shape == 'broad' and t > .25: wd += 1
        if shape in ('tusk', 'cleaver'): wd += 3.2 * t ** 1.3          # 刀腹越往前越寬
        if shape == 'flame': wd += .9 * math.sin(i * 1.3) + .4
        if shape == 'kris': top += math.sin(i / 2.2) * .9
        if shape == 'needle' and t > .12: wd = 1
        # 刃尖：刃的下緣往上收到上緣（尖在背那邊）；青龍刀斜切得快
        n = 5 if shape == 'cleaver' else 3
        if tip < n and shape != 'needle': wd = max(1, wd * (tip + 1) / (n + 1))
        r0 = int(math.floor(top + .5)); r1 = int(math.floor(top + wd + .5)) - 1
        if r1 < r0: r1 = r0
        for r in range(r0, r1 + 1):
            k = r - r0; last = r == r1
            col = lt if k == 0 else dk if last and r1 > r0 else md
            if fuller and r1 - r0 >= 2 and r == (r0 + r1) // 2 + (0 if (r1 - r0) % 2 else 0) and tip > 4: col = dk
            if shape == 'flame':
                col = (255, 236, 150) if k == 0 else (240, 120, 50) if not last else (190, 40, 30)
            if shape == 'serrate' and last and r1 > r0 and i % 3 == 0: continue
            px(a, x, r, col)
        if i == L - 1 and shape == 'hook':  # 劍尖往回勾
            for k in range(1, 4): px(a, x - k + 1, r0 - k, lt)


def sword(s):
    L = s.get('L', 30); grip = s.get('grip', 6); w = s.get('w', 2)
    a = canvas(L + grip + 16, 30); y = 13; gx = 3 + grip // 2
    handle(a, 3, 3 + grip, y, s.get('wood', 'dk'), s.get('wrap'), s.get('pommel', 'knob'), s.get('pg'))
    gs = s.get('guard', 'bar')
    blade(a, 6 + grip, L, y, s.get('mat', 'steel'), w, s.get('shape', 'straight'), s.get('curve', 0), s.get('fuller', False))
    guard(a, 4 + grip, y, gs, s.get('gh', 3), WOOD[s.get('gc', 'gold')])
    if s.get('gem'): gem(a, 4 + grip, y, s['gem'], True)
    return outline(a), (gx, y)


# ---------- 斧 ----------
def axe_head(a, cx, y, mat, kind, size=1.0):
    lt, md, dk = MET[mat]
    def crescent(cx, R, depth, dip, side=1, horn=2.5):
        for x in range(int(cx - R), int(cx + R) + 1):
            dx = x - cx; q = abs(dx) / R
            if q > 1: continue
            u = max(0, (abs(dx) - 2) / (R - 2))
            yb = 3 + depth * (1 - q * q) ** .5
            yt = 2 + horn * u + dip * math.sin(math.pi * u) ** .7
            for d in range(int(round(yt)), int(round(yb)) + 1):
                col = lt if d >= yb - 1.6 else dk if d < 5 else md
                px(a, x, y + side * d + (1 if side > 0 else 0), col)
    if kind == 'crescent': crescent(cx, 11 * size, 10 * size, 5 * size)
    elif kind == 'hand': crescent(cx, 6 * size, 7 * size, 2)
    elif kind == 'beard':  # 下緣往柄尾拖長
        crescent(cx, 9 * size, 9 * size, 4)
        for i in range(6): px(a, cx - 8 - i, y + 10 - i // 2, lt); px(a, cx - 8 - i, y + 9 - i // 2, md)
    elif kind == 'double': crescent(cx, 9 * size, 9 * size, 4, 1); crescent(cx, 9 * size, 9 * size, 4, -1)
    elif kind == 'moon': crescent(cx, 13 * size, 12 * size, 8, 1, 1.5)
    elif kind == 'huge': crescent(cx, 13 * size, 14 * size, 6)
    elif kind == 'exec':  # 處刑斧：方形大刃
        for x in range(cx - 7, cx + 8):
            for d in range(2, 15):
                col = lt if d >= 13 else dk if d < 5 else md
                px(a, x, y + 1 + d, col)
        for x in range(cx - 7, cx + 8, 3): px(a, x, y + 4, dk)
    elif kind == 'claw':  # 鉤爪：刃口外面長出三根往前勾的爪
        crescent(cx, 8 * size, 8 * size, 3)
        for k in (-5, 0, 5):  # 三根往前斜的尖牙
            base = y + 3 + 8 * size * (1 - (k / (8 * size)) ** 2) ** .5
            for i in range(5):
                w = 2 - i // 2
                for j in range(-w, w + 1): px(a, cx + k + j + i // 2, base + i, lt if j < 0 else md if j == 0 else dk)
    elif kind == 'ox':  # 牛斧：大骨刃＋背上一對牛角
        crescent(cx, 12 * size, 12 * size, 5)
        for sd in (-1, 1):
            for i in range(9):
                t = i / 8; xx = cx + sd * (2 + int(6 * t)); yy = y - 2 - int(7 * math.sin(t * 2.0))
                px(a, xx, yy, (250, 244, 224) if t > .6 else (222, 206, 172)); px(a, xx, yy + 1, (152, 132, 100))
    elif kind == 'mino': crescent(cx, 13 * size, 14 * size, 5, 1); crescent(cx, 13 * size, 14 * size, 5, -1)
    elif kind == 'wing':  # 帕魯凱斯之斧：翅膀形刃
        crescent(cx, 12 * size, 11 * size, 6)
        for i in range(8): px(a, cx - 4 + i, y - 2 - i // 2, lt); px(a, cx - 4 + i, y - 1 - i // 2, md)
    # 斧頭箍
    for x in range(cx - 2, cx + 3):
        for yy in (y - 1, y, y + 1, y + 2): px(a, x, yy, GOLD[1] if yy in (y - 1, y + 2) else GOLD[0])


def axe(s):
    L = s.get('L', 44); a = canvas(L + 16, 46); y = 21
    lt, dk = WOOD[s.get('wood', 'wood')]
    for x in range(1, L + 1): px(a, x, y, lt); px(a, x, y + 1, dk)
    px(a, L + 1, y, GOLD[0]); px(a, L + 1, y + 1, GOLD[1])
    gxp = s.get('gx', 11)
    for x in (gxp, gxp + 1): px(a, x, y, WOOD[s.get('wrap', 'gold')][0]); px(a, x, y + 1, WOOD[s.get('wrap', 'gold')][1])
    axe_head(a, L - 6, y, s.get('mat', 'steel'), s.get('kind', 'crescent'), s.get('size', 1.0))
    if s.get('spike'):
        for i in range(4): px(a, L + 2 + i, y, MET[s.get('mat', 'steel')][0]); px(a, L + 2 + i, y + 1, MET[s.get('mat', 'steel')][2])
    if s.get('gem'): gem(a, L - 6, y, s['gem'], True)
    return outline(a), (gxp, y)


# ---------- 槍 ----------
def spear_head(a, x0, y, mat, kind, sz=1.0):
    lt, md, dk = MET[mat]
    def leaf(x0, n, wmax, yy=y):
        for i in range(n):
            t = i / max(1, n - 1); w = max(0, round(wmax * math.sin(math.pi * min(1, t * 1.25 + .1)) ** .8))
            if i >= n - 2: w = 0
            for r in range(yy - w, yy + w + 2): px(a, x0 + i, r, lt if r <= yy else md if r == yy + 1 else dk)
    if kind == 'leaf': leaf(x0, int(11 * sz), 3)
    elif kind == 'pike': leaf(x0, int(14 * sz), 1)
    elif kind == 'broad': leaf(x0, int(13 * sz), 4)
    elif kind == 'crude':  # 石頭槍頭
        for i in range(8):
            w = 3 - i // 3
            for r in range(y - w, y + w + 2): px(a, x0 + i, r, MET['stone'][0] if r <= y else MET['stone'][2])
    elif kind == 'glaive':  # 偃月刀：大彎刃往上
        for i in range(16):
            t = i / 15; top = y - 1 - int(6 * math.sin(t * math.pi * .9)) - int(t * 2); bot = y + 1 - int(t * 3)
            for r in range(top, bot + 1): px(a, x0 + i, r, lt if r == top else md if r < bot else dk)
        for r in range(y + 1, y + 4): px(a, x0 + 1, r, md)  # 下面的小鉤
    elif kind == 'halberd':
        leaf(x0 + 4, 9, 1)
        for d in range(2, 10):
            for x in range(x0 + 1, x0 + 7 - d // 3): px(a, x, y + 1 + d, lt if d >= 8 else md)
        for d in range(2, 5): px(a, x0 + 2, y - d, md)
    elif kind in ('fork', 'trident'):
        prongs = (-3, 0, 3) if kind == 'trident' else (-2, 3)
        for x in range(x0, x0 + 3):
            for r in range(y - 3, y + 5): px(a, x, r, md)
        for p in prongs:
            for i in range(10 if p == 0 else 8): px(a, x0 + 3 + i, y + p, lt); px(a, x0 + 3 + i, y + p + 1, dk)
            px(a, x0 + 3 + (10 if p == 0 else 8), y + p, lt)
    elif kind == 'scorpion':  # 蠍尾：往上翹回來的鉤
        leaf(x0, 8, 2)
        for i in range(8):
            ang = i / 7 * math.pi * .9; px(a, x0 + 3 - int(4 * math.cos(ang)) + 4, y - 2 - int(5 * math.sin(ang)), lt)
    elif kind == 'winged':
        leaf(x0 + 2, 11, 3)
        for d in range(2, 6): px(a, x0 + 1 - d // 2, y - d, md); px(a, x0 + 1 - d // 2, y + 1 + d, dk)
    elif kind == 'hook':
        leaf(x0, 11, 2)
        for i in range(5): px(a, x0 + 2 + i, y + 3 + i // 2, md)
        px(a, x0 + 7, y + 5, lt); px(a, x0 + 8, y + 4, lt)
    elif kind == 'snake':  # 蛇形長刃
        for i in range(16):
            c = y + .5 + math.sin(i / 2.0) * 1.5; w = 2 if i < 13 else 1
            r0 = int(round(c - w / 2))
            for k in range(w): px(a, x0 + i, r0 + k, lt if k == 0 else md)
    elif kind == 'double':  # 雙刃槍：兩頭都有刃 → 前面一個大葉
        leaf(x0, 12, 3)
    elif kind == 'lance':  # 騎士槍：圓錐
        for i in range(16):
            w = int(4 * (1 - i / 16))
            for r in range(y - w, y + w + 2): px(a, x0 + i, r, lt if r <= y - w + 1 else md if r <= y + 1 else dk)
        for r in range(y - 5, y + 7): px(a, x0 - 1, r, GOLD[0])
    elif kind == 'sky':
        leaf(x0, 14, 3)
        for d in range(2, 7): px(a, x0 + 2 + d // 2, y - d, MET['sky'][0]); px(a, x0 + 2 + d // 2, y + 1 + d, MET['sky'][1])


def spear(s):
    L = s.get('L', 66); a = canvas(L + 30, 36); y = 16
    lt, dk = WOOD[s.get('wood', 'wood')]
    for x in range(1, L + 1): px(a, x, y, lt); px(a, x, y + 1, dk)
    px(a, 1, y, GOLD[1]); px(a, 1, y + 1, GOLD[1])
    if s.get('bands'):
        for x in range(8, L, 14): px(a, x, y, WOOD[s['bands']][0]); px(a, x, y + 1, WOOD[s['bands']][1])
    if s.get('tassel', True) and s.get('kind') not in ('lance',):
        tc = s.get('tc', (206, 44, 44))
        for x, (t, b) in zip(range(L - 3, L + 1), [(1, 2), (2, 3), (3, 4), (3, 5)]):
            for r in range(y - t + 1, y + b + 1): px(a, x, r, tc)
    for r in range(y - 1, y + 3): px(a, L, r, GOLD[0])
    spear_head(a, L + 1, y, s.get('mat', 'steel'), s.get('kind', 'leaf'), s.get('sz', 1.0))
    if s.get('kind') == 'double' or s.get('back'):
        lt2, md2, dk2 = MET[s.get('mat', 'steel')]
        for i in range(5): px(a, 1 - i if 1 - i >= 0 else 0, y, lt2)
    if s.get('gem'): gem(a, L, y, s['gem'], True)
    return outline(a), (int(L * .38), y)


# ---------- 杖 ----------
def staff_head(a, x0, y, kind, g, mat):
    lt, md, dk = MET[mat]
    gl, gd = GEM[g] if g else GEM['b']
    def orb(cx, cy, r):
        for x in range(int(cx - r - 1), int(cx + r + 2)):
            for yy in range(int(cy - r - 1), int(cy + r + 2)):
                d = ((x - cx) ** 2 + (yy - cy) ** 2) ** .5
                if d <= r: px(a, x, yy, gl if (x < cx and yy < cy) else gd)
    cy = y + .5
    if kind == 'orb':
        for x in range(x0, x0 + 12):
            for yy in range(y - 7, y + 9):
                d = ((x - x0 - 6) ** 2 + (yy - cy) ** 2) ** .5
                if 4 <= d <= 5.6 and not (x > x0 + 8 and abs(yy - cy) < 2.5): px(a, x, yy, lt if yy < cy else dk)
        orb(x0 + 6, cy, 2.6)
    elif kind == 'crystal':
        for i in range(9):
            w = int(3 * math.sin(math.pi * i / 8)) + (1 if 2 < i < 6 else 0)
            for r in range(int(cy - w), int(cy + w) + 1): px(a, x0 + 1 + i, r, gl if r < cy else gd)
        for r in range(y - 2, y + 4): px(a, x0, r, lt)
    elif kind == 'crook':  # 彎頭
        for i in range(14):
            ang = i / 13 * math.pi * 1.4
            px(a, x0 + int(5 * math.sin(ang)), y - int(5 * (1 - math.cos(ang))), lt); px(a, x0 + 1 + int(5 * math.sin(ang)), y - int(5 * (1 - math.cos(ang))), dk)
        if g: gem(a, x0 + 1, y - 5, g, True)
    elif kind == 'star':
        for k in range(5):
            ang = -math.pi / 2 + k * 2 * math.pi / 5
            for r in range(6): px(a, x0 + 5 + r * math.cos(ang), cy + r * math.sin(ang), lt if r > 3 else md)
        orb(x0 + 5, cy, 1.6)
    elif kind == 'sun':
        orb(x0 + 6, cy, 3.2)
        for k in range(8):
            ang = k * math.pi / 4
            for r in range(5, 8): px(a, x0 + 6 + r * math.cos(ang), cy + r * math.sin(ang), GOLD[0] if r < 7 else GOLD[1])
    elif kind == 'moon':
        for x in range(x0, x0 + 12):
            for yy in range(y - 7, y + 9):
                d1 = ((x - x0 - 5) ** 2 + (yy - cy) ** 2) ** .5; d2 = ((x - x0 - 8) ** 2 + (yy - cy) ** 2) ** .5
                if d1 <= 6 and d2 > 5: px(a, x, yy, lt if yy < cy else md)
        if g: gem(a, x0 + 5, y, g, True)
    elif kind == 'wing':
        orb(x0 + 4, cy, 2.4)
        for side in (1, -1):
            for i in range(9):
                for j in range(3 - i // 4):
                    px(a, x0 + 2 - i // 2 + j, cy + side * (3 + i), (250, 250, 255) if j == 0 else (200, 210, 230))
    elif kind == 'horn':
        orb(x0 + 4, cy, 2.4)
        for side in (1, -1):
            for i in range(9):
                t = i / 8; px(a, x0 + 3 + int(7 * t), cy + side * (2 + int(5 * math.sin(t * 2.6))), (110, 40, 50) if i < 6 else (200, 190, 180))
                px(a, x0 + 3 + int(7 * t), cy + side * (3 + int(5 * math.sin(t * 2.6))), (60, 20, 30))
    elif kind == 'hammer':  # 星錘
        for x in range(x0 + 1, x0 + 9):
            for yy in range(y - 4, y + 6): px(a, x, yy, lt if yy < y - 1 else md if yy < y + 3 else dk)
        for x, yy in ((x0 + 5, y - 6), (x0 + 5, y + 7), (x0 + 10, y), (x0 + 10, y + 1), (x0 + 3, y - 5), (x0 + 7, y + 6)): px(a, x, yy, lt)
    elif kind == 'hand':  # 王者之手：爪抓著寶珠
        orb(x0 + 6, cy, 3)
        for side in (1, -1):
            for i in range(6): px(a, x0 + i + 1, cy + side * (4 - abs(i - 2) * .5), GOLD[0] if side < 0 else GOLD[1])
        px(a, x0 + 10, cy - 2, GOLD[0]); px(a, x0 + 10, cy + 2, GOLD[1])
    elif kind == 'crown':  # 權杖：小王冠＋寶石
        for x in range(x0, x0 + 6):
            for yy in range(y - 3, y + 5): px(a, x, yy, GOLD[0] if yy < y + 1 else GOLD[1])
        for yy in (y - 4, y + 5): px(a, x0 + 1, yy, GOLD[0]); px(a, x0 + 3, yy, GOLD[0]); px(a, x0 + 5, yy, GOLD[0])
        orb(x0 + 8, cy, 2.2)
    elif kind == 'knob':
        for x in range(x0, x0 + 5):
            for yy in range(y - 2, y + 4): px(a, x, yy, lt if yy < y else dk)
    elif kind == 'branch':  # 神木：樹枝分叉＋葉子
        for i in range(8): px(a, x0 + i, y - i // 2, MET['wood'][1]); px(a, x0 + i, y + 1 + i // 3, MET['wood'][2])
        for x, yy in ((x0 + 7, y - 4), (x0 + 8, y - 5), (x0 + 6, y - 5), (x0 + 8, y + 3), (x0 + 9, y + 4), (x0 + 5, y + 4)): px(a, x, yy, (90, 190, 90))
        if g: gem(a, x0 + 9, y - 3, g)
    elif kind == 'ring':
        for x in range(x0, x0 + 12):
            for yy in range(y - 7, y + 9):
                d = ((x - x0 - 6) ** 2 + (yy - cy) ** 2) ** .5
                if 4.5 <= d <= 5.8: px(a, x, yy, lt if yy < cy else dk)
        orb(x0 + 6, cy, 1.8)
        for yy in (y - 7, y + 8): px(a, x0 + 6, yy, GOLD[0])
    elif kind == 'sky':
        orb(x0 + 6, cy, 3)
        for side in (1, -1):
            for i in range(10): px(a, x0 + 3 + i // 3, cy + side * (3 + i * .6), MET['sky'][0] if i % 2 else MET['sky'][1])
        for i in range(4): px(a, x0 + 10 + i, cy, MET['sky'][0])


def staff(s):
    L = s.get('L', 56); a = canvas(L + 22, 30); y = 13
    lt, dk = WOOD[s.get('wood', 'wood')]
    for x in range(1, L + 1): px(a, x, y, lt); px(a, x, y + 1, dk)
    if s.get('bands'):
        for x in range(10, L - 4, 12): px(a, x, y, WOOD[s['bands']][0]); px(a, x, y + 1, WOOD[s['bands']][1])
    for x in (15, 16): px(a, x, y, GOLD[0]); px(a, x, y + 1, GOLD[1])
    for x in (L - 1, L):
        for r in range(y - 1, y + 3): px(a, x, r, GOLD[0] if r <= y else GOLD[1])
    staff_head(a, L + 1, y, s.get('kind', 'orb'), s.get('gem', 'b'), s.get('mat', 'gold'))
    return outline(a), (18, y)


# ---------- 弓（直放，往右瞄） ----------
def bow(s):
    H = s.get('H', 44); a = canvas(24, H + 12); cy = 6 + H // 2; cx = 4
    lt, dk = WOOD[s.get('wood', 'wood')]
    kind = s.get('kind', 'simple'); bend = s.get('bend', 5)
    if kind == 'crossbow':  # 弩：橫放的弓臂＋往前的弩身
        a = canvas(40, 30); y = 13
        for x in range(2, 30): px(a, x, y, lt); px(a, x, y + 1, dk)
        for i in range(12):
            t = i / 11
            for side in (1, -1): px(a, 24 - int(3 * t * t), y + side * (1 + i) + (1 if side > 0 else 0), MET[s.get('mat', 'iron')][1])
        for i in range(-12, 14): px(a, 21 - int(abs(i) * .1), y + i, (230, 226, 210)) if abs(i) > 1 else None
        for x in (8, 9, 10): px(a, x, y + 2, dk); px(a, x, y + 3, dk)
        if s.get('gem'): gem(a, 26, y, s['gem'], True)
        return outline(a), (9, y)
    def limb(x_off, col1, col2):
        for yy in range(6, 7 + H):
            t = (yy - cy) / (H / 2)
            x = cx + bend * (1 - t * t) + x_off
            if kind in ('recurve', 'composite', 'ornate', 'moon', 'sky') and abs(t) > .8: x -= (abs(t) - .8) * 14
            if kind == 'big': x = cx + bend * 1.3 * (1 - t * t) + x_off
            px(a, x, yy, col1); px(a, x + 1, yy, col2)
    limb(0, lt, dk)
    if kind == 'double': limb(4, lt, dk)
    for yy in range(8, 5 + H): px(a, cx - 1, yy, (230, 226, 210))  # 弦
    grip_col = WOOD[s.get('grip', 'gold')]
    for yy in range(cy - 2, cy + 3): px(a, cx + bend, yy, grip_col[0]); px(a, cx + bend + 1, yy, grip_col[1])
    if kind in ('composite', 'ornate', 'sky'):
        bc = WOOD[s.get('bands', 'gold')]
        for f in (-.5, .5):
            yy = int(cy + f * H / 2); x = cx + bend * (1 - f * f)
            px(a, x, yy, bc[0]); px(a, x + 1, yy, bc[1]); px(a, x, yy + 1, bc[0]); px(a, x + 1, yy + 1, bc[1])
    if kind in ('ornate', 'sky', 'moon') or s.get('gem'):
        g = s.get('gem', 'c')
        for yy in (7, 5 + H): gem(a, cx - 1 + (2 if kind == 'moon' else 0), yy, g)
    if kind == 'moon':  # 月光：弓臂外側一道銀光
        for yy in range(10, 3 + H):
            t = (yy - cy) / (H / 2); px(a, cx + bend * (1 - t * t) + 2, yy, (230, 240, 255)) if abs(t) < .7 else None
    return outline(a), (int(cx + bend), cy)


# ---------- 小刀 ----------
def dagger(s):
    kind = s.get('kind', 'straight')
    if kind == 'shuriken':
        a = canvas(20, 20); c = 9.5; lt, md, dk = MET[s.get('mat', 'steel')]
        for k in range(4):
            ang = k * math.pi / 2 + .3
            for r in range(8):
                for wv in (-1, 0, 1):
                    if r > 6 - abs(wv) * 4: continue
                    px(a, c + r * math.cos(ang) - wv * math.sin(ang) * (1 - r / 8), c + r * math.sin(ang) + wv * math.cos(ang) * (1 - r / 8), lt if wv < 0 else md)
        px(a, c, c, (40, 40, 50))
        return outline(a), (9, 9)
    if kind == 'disc':
        a = canvas(22, 22); c = 10.5; lt, md, dk = MET[s.get('mat', 'steel')]
        for x in range(22):
            for yy in range(22):
                d = ((x - c) ** 2 + (yy - c) ** 2) ** .5
                if 4 <= d <= 8.5: px(a, x, yy, lt if d > 7.5 else md if yy < c else dk)
        for x in range(3, 8): px(a, x, c, WOOD['dk'][0])
        return outline(a), (6, 10)
    s = dict(s); s.setdefault('L', 16); s.setdefault('grip', 4); s.setdefault('guard', 'bar'); s.setdefault('gh', 2)
    shp = {'straight': 'straight', 'curved': 'straight', 'kris': 'kris', 'broad': 'broad', 'cleaver': 'cleaver', 'fang': 'tusk', 'ornate': 'straight',
           'kunai': 'straight', 'ear': 'straight', 'tanto': 'straight', 'needle': 'needle', 'serrate': 'serrate', 'hook': 'hook'}[kind]
    s['shape'] = shp
    if kind == 'curved': s['curve'] = s.get('curve', 3)
    if kind == 'kunai': s['pommel'] = 'ring'; s['guard'] = 'none'
    if kind == 'ear':  # 耳柄：柄頭兩個圓耳
        s['pommel'] = 'none'
    out, g = sword(s)
    if kind == 'ear':
        a = np.pad(out, ((0, 0), (3, 0), (0, 0)))
        for dy in (-2, 3):
            for dx in (0, 1): a[g[1] + dy, 2 + dx] = (*GOLD[0], 255)
        return outline(a), (g[0] + 3, g[1])
    return out, g


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


if __name__ == '__main__':
    items = json.loads(open('/dev/stdin').read())
    sheet, table, cells = build(items)
    Image.fromarray(sheet).resize((sheet.shape[1] * K, sheet.shape[0] * K), Image.NEAREST).save('../../www/assets/mud/wpn/sheet.png', optimize=True)
    with open('../../www/src/mud/wpn-data.mjs', 'w') as f:
        f.write('// scripts/doll/weapons.py 產生的，別手改：每把武器在 assets/mud/wpn/sheet.png 的 [x,y,寬,高,握把x,握把y,發光色?]（立繪像素）\n')
        f.write('export const WPN_ART=' + json.dumps(table, ensure_ascii=False, separators=(',', ':')) + ';\n')
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
