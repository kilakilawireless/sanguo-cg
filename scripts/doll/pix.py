# 像素武器的畫筆（2026-10-31 重畫，Leo「武器真的太醜了」）：照立繪的畫風——粗黑邊、每塊零件四五層明暗、光從左上來、刃口亮邊。
# 用法：c = Cv(寬, 高, 原點x, 原點y)；c.fill([多邊形...], 色盤, ...)；最後 c.done() 加外框。座標是「美術像素」，原點在握把那條軸上。
import math
import numpy as np

SS = 4                      # 每格取樣 4×4 算覆蓋率
O = (28, 20, 26)            # 外框（跟立繪的黑邊一樣偏紫黑）
LIGHT = (-0.55, -0.83)      # 光從左上來（往光的方向）


def mix(a, b, t): return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))


def pal5(lt, md, dk):
    """金屬：最暗→最亮五層"""
    return [mix(dk, O, .4), dk, md, lt, mix(lt, (255, 255, 255), .55)]


def pal4w(lt, dk):
    """木頭、布：兩個色擴成五層"""
    return [mix(dk, O, .35), dk, mix(lt, dk, .45), lt, mix(lt, (255, 250, 235), .35)]


def ellipse(cx, cy, rx, ry, n=28, a0=0, a1=2 * math.pi):
    return [(cx + rx * math.cos(a0 + (a1 - a0) * i / n), cy + ry * math.sin(a0 + (a1 - a0) * i / n)) for i in range(n + (0 if a1 - a0 >= 6.28 else 1))]


def bez(p0, p1, p2, n=12):
    return [((1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0], (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]) for t in (i / n for i in range(n + 1))]


def band(pts, w0, w1=None):
    """粗線：沿著 pts 的帶子，寬度從 w0 漸變到 w1 → 多邊形"""
    w1 = w0 if w1 is None else w1
    L, R = [], []
    n = len(pts)
    for i, (x, y) in enumerate(pts):
        a = pts[max(0, i - 1)]; b = pts[min(n - 1, i + 1)]
        dx, dy = b[0] - a[0], b[1] - a[1]; d = math.hypot(dx, dy) or 1
        nx, ny = -dy / d, dx / d; w = (w0 + (w1 - w0) * i / max(1, n - 1)) / 2
        L.append((x + nx * w, y + ny * w)); R.append((x - nx * w, y - ny * w))
    return L + R[::-1]


def pip(X, Y, poly):
    """點在多邊形內（奇偶規則），X、Y 是陣列"""
    ins = np.zeros(X.shape, bool)
    n = len(poly)
    for i in range(n):
        x1, y1 = poly[i]; x2, y2 = poly[(i + 1) % n]
        if y1 == y2: continue
        c = ((y1 > Y) != (y2 > Y)) & (X < (x2 - x1) * (Y - y1) / (y2 - y1) + x1)
        ins ^= c
    return ins


class Cv:
    def __init__(s, w, h, ox, oy):
        s.w, s.h, s.ox, s.oy = w, h, ox, oy
        s.a = np.zeros((h, w, 4), np.uint8)
        s.pid = np.zeros((h, w), np.int32); s.n = 0
        s.post = []
        yy, xx = np.mgrid[0:h, 0:w]
        s.X = xx + .5 - ox; s.Y = yy + .5 - oy   # 每格中心的美術座標

    def mask(s, polys, holes=()):
        h, w = s.h, s.w
        xs = (np.arange(w * SS) + .5) / SS - s.ox; ys = (np.arange(h * SS) + .5) / SS - s.oy
        X, Y = np.meshgrid(xs, ys)
        ins = np.zeros(X.shape, bool)
        for p in polys: ins |= pip(X, Y, p)
        for p in holes: ins &= ~pip(X, Y, p)
        return ins.reshape(h, SS, w, SS).mean((1, 3)) >= .5

    def fill(s, polys, pal, base=.5, amp=.6, bev=2.2, tf=None, split=None, sep=True, holes=(), m=None, flat=False):
        """填一塊零件。base＝整塊亮度（0～1）、amp＝邊緣受光多強、bev＝斜面寬（格）、tf(X,Y)＝額外亮度、
        split＝(點a, 點b, 差)：線右手邊（往下那側）暗一點（刃的兩個面）、sep＝蓋在別的零件上時接縫畫深色"""
        if m is None: m = s.mask(polys, holes)
        if not m.any(): return m
        H, W = m.shape; R = 3
        pad = np.pad(m, R)
        d = np.full(m.shape, 9.0); nx = np.zeros(m.shape); ny = np.zeros(m.shape)
        for dy in range(-R, R + 1):
            for dx in range(-R, R + 1):
                r = math.hypot(dx, dy)
                if r == 0 or r > R + .01: continue
                out = ~pad[R + dy:R + dy + H, R + dx:R + dx + W]
                d = np.where(out, np.minimum(d, r), d)
                wt = out / r ** 3; nx += wt * dx; ny += wt * dy
        ln = np.hypot(nx, ny) + 1e-9
        lit = (nx / ln) * LIGHT[0] + (ny / ln) * LIGHT[1]
        fall = np.clip(1 - (d - 1) / bev, 0, 1) * (ln > 1e-6)
        t = np.full(m.shape, float(base)) + (0 if flat else amp * lit * fall)
        if tf is not None: t = t + tf(s.X, s.Y)
        if split:
            (ax, ay), (bx, by), dd = split
            side = (bx - ax) * (s.Y - ay) - (by - ay) * (s.X - ax)
            t = t - dd * (side > 0)
        idx = np.clip((t * len(pal)).astype(int), 0, len(pal) - 1)
        P = np.array(pal, np.uint8)
        col = P[idx]
        if sep:
            had = s.a[..., 3] > 0
            p1 = np.pad(m, 1)
            edge = m & ~(p1[:-2, 1:-1] & p1[2:, 1:-1] & p1[1:-1, :-2] & p1[1:-1, 2:])
            hp = np.pad(had & ~m, 1)
            touch = edge & (hp[:-2, 1:-1] | hp[2:, 1:-1] | hp[1:-1, :-2] | hp[1:-1, 2:])
            col[touch] = np.array(mix(pal[0], O, .5), np.uint8)
        s.a[m, :3] = col[m]; s.a[m, 3] = 255
        s.n += 1; s.pid[m] = s.n
        return m

    def dots(s, pts, c):
        for x, y in pts:
            i, j = int(math.floor(y + s.oy)), int(math.floor(x + s.ox))
            if 0 <= i < s.h and 0 <= j < s.w and s.a[i, j, 3]: s.a[i, j, :3] = c

    def later(s, polys, c, alpha=255):
        """外框之後才畫（弓弦這種細線，不要被描黑邊）"""
        s.post.append((polys, c, alpha))

    def done(s):
        op = s.a[..., 3] > 0; p = np.pad(op, 1)
        nb = p[:-2, 1:-1] | p[2:, 1:-1] | p[1:-1, :-2] | p[1:-1, 2:]
        s.a[nb & ~op] = (*O, 255)
        for polys, c, al in s.post:
            m = s.mask(polys); s.a[m] = (*c, al)
        return s.a
