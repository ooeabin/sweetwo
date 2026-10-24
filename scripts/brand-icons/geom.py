# 심볼 형상(원본 symbol.svg와 같은 규칙, 틈과 크러스트 두께만 파라미터)
import math
A1, A2 = 30.0, 82.0          # 조각 쐐기 각도(도, SVG y-아래 좌표)
R_IN, R_OUT = 366.0, 694.0   # 고리 안, 밖 반지름
def params(gap=40.0, crust_gap=44.0, crust_t=122.0):
    g = gap / 2
    rs = R_OUT + g                    # 조각 반지름(고리보다 반 틈만큼 밖으로)
    ci = rs + crust_gap               # 크러스트 안 반지름
    return dict(g=g, rs=rs, ci=ci, co=ci + crust_t)

def _dir(a): r = math.radians(a); return (math.cos(r), math.sin(r))
def _n(a, side):  # 반직선 a의 법선. side=+1: 각도가 커지는 쪽
    r = math.radians(a); return (-math.sin(r) * side, math.cos(r) * side)

def _line_circle(p, d, R):
    # p + t d 가 반지름 R 원과 만나는 t>0 점
    b = p[0]*d[0] + p[1]*d[1]; c = p[0]**2 + p[1]**2 - R*R
    t = -b + math.sqrt(b*b - c); return (p[0] + t*d[0], p[1] + t*d[1])

def _arc(R, a_from, a_to, n=200):
    pts = []
    for i in range(n + 1):
        a = math.radians(a_from + (a_to - a_from) * i / n); pts.append((R*math.cos(a), R*math.sin(a)))
    return pts

def ang(p): return math.degrees(math.atan2(p[1], p[0]))

def pieces(gap=40.0, crust_gap=44.0, crust_t=122.0, ring_out=None, ring_in=None):
    """ring_out='crust'면 고리 바깥이 크러스트 바깥까지 커져 조각과 크러스트를 감쌈"""
    P = params(gap, crust_gap, crust_t); g = P['g']
    ro = P['co'] if ring_out == 'crust' else (ring_out or R_OUT)
    ri = ring_in or (R_IN * ro / R_OUT)
    # 오프셋 직선: 쐐기 경계 A1, A2를 g만큼 평행 이동
    def off(a, side): n = _n(a, side); return (n[0]*g, n[1]*g)
    # 조각: 쐐기 안쪽으로 g씩 들어간 두 직선, 반지름 rs
    o1 = off(A1, +1); o2 = off(A2, -1)
    # 두 직선 교점(꼭짓점)
    d1, d2 = _dir(A1), _dir(A2)
    det = d1[0]*(-d2[1]) - d1[1]*(-d2[0])
    t = ((o2[0]-o1[0])*(-d2[1]) - (o2[1]-o1[1])*(-d2[0])) / det
    apex = (o1[0] + t*d1[0], o1[1] + t*d1[1])
    s1 = _line_circle(apex, d1, P['rs']); s2 = _line_circle(apex, d2, P['rs'])
    slice_ = [apex] + _arc(P['rs'], ang(s1), ang(s2))
    # 고리: 쐐기 바깥으로 g씩 물러난 직선 사이(큰 호)
    q1 = off(A1, -1); q2 = off(A2, +1)
    def seg(o, d, R):  # 직선 o + t d 와 원 R 교점
        return _line_circle(o, d, R) if True else None
    r1o = _line_circle(q1, d1, ro); r1i = _line_circle(q1, d1, ri)
    r2o = _line_circle(q2, d2, ro); r2i = _line_circle(q2, d2, ri)
    a2o, a1o = ang(r2o), ang(r1o) + 360
    a1i, a2i = ang(r1i) + 360, ang(r2i)
    ring = _arc(ro, a2o, a1o, 400) + _arc(ri, a1i, a2i, 300)
    # 크러스트: 조각과 같은 두 직선 사이, 반지름 ci~co
    c1i = _line_circle(o1, d1, P['ci']); c1o = _line_circle(o1, d1, P['co'])
    c2i = _line_circle(o2, d2, P['ci']); c2o = _line_circle(o2, d2, P['co'])
    crust = _arc(P['co'], ang(c1o), ang(c2o)) + _arc(P['ci'], ang(c2i), ang(c1i))
    return dict(ring=ring, slice=slice_, crust=crust)

def svg_path(pts):
    return 'M' + 'L'.join(f'{x:.1f} {y:.1f}' for x, y in pts) + 'Z'

def svg_paths(gap=40.0, crust_gap=44.0, crust_t=122.0):
    """같은 형상을 호(A) 명령으로: 고리, 조각, 크러스트"""
    P = params(gap, crust_gap, crust_t); g = P['g']
    d1, d2 = _dir(A1), _dir(A2)
    o1 = (_n(A1, 1)[0]*g, _n(A1, 1)[1]*g); o2 = (_n(A2, -1)[0]*g, _n(A2, -1)[1]*g)
    q1 = (_n(A1, -1)[0]*g, _n(A1, -1)[1]*g); q2 = (_n(A2, 1)[0]*g, _n(A2, 1)[1]*g)
    sl = pieces(gap, crust_gap, crust_t)['slice']; apex = sl[0]
    f = lambda p: f'{p[0]:.1f} {p[1]:.1f}'
    r1o, r1i = _line_circle(q1, d1, R_OUT), _line_circle(q1, d1, R_IN)
    r2o, r2i = _line_circle(q2, d2, R_OUT), _line_circle(q2, d2, R_IN)
    ring = f'M{f(r2o)}A{R_OUT:g} {R_OUT:g} 0 1 1 {f(r1o)}L{f(r1i)}A{R_IN:g} {R_IN:g} 0 1 0 {f(r2i)}Z'
    s1, s2 = _line_circle(apex, d1, P['rs']), _line_circle(apex, d2, P['rs'])
    slice_ = f'M{f(apex)}L{f(s1)}A{P["rs"]:g} {P["rs"]:g} 0 0 1 {f(s2)}Z'
    c1i, c1o = _line_circle(o1, d1, P['ci']), _line_circle(o1, d1, P['co'])
    c2i, c2o = _line_circle(o2, d2, P['ci']), _line_circle(o2, d2, P['co'])
    crust = f'M{f(c1i)}L{f(c1o)}A{P["co"]:g} {P["co"]:g} 0 0 1 {f(c2o)}L{f(c2i)}A{P["ci"]:g} {P["ci"]:g} 0 0 0 {f(c1i)}Z'
    return ring, slice_, crust
