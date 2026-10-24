"""앱 아이콘 3D 원본을 Blender(bpy)로 렌더링.

형상은 geom.py 수치 → 높이 지도(둥근 단면) → 격자 메시. 재질은 '말랑 점토'.
그늘은 브랜드 색(#FF6F0F)을 발광으로 깔아 그 아래로 어두워지지 않고, 빛 받는 곳만 밝아짐.
바닥 그림자 없음, 투명 바탕. 결과: 심볼 폭이 캔버스의 62%인 정사각 PNG.
pip install bpy (Blender 5.2) 필요.
"""
import math, os, sys
import numpy as np
from scipy import ndimage
from PIL import Image, ImageDraw
import bpy
sys.path.insert(0, os.path.dirname(__file__))
from geom import pieces

BRAND, LIT = '#FF6F0F', '#FFA060'
FRAC = 0.62

def srgb(h):
    c = [int(h[i:i+2], 16) / 255 for i in (1, 3, 5)]
    return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c) + (1,)

def heightmap(geo, N, frac, bevel):
    allp = [p for k in geo for p in geo[k]]
    xs = [p[0] for p in allp]; ys = [p[1] for p in allp]
    cx = (max(xs) + min(xs)) / 2; cy = (max(ys) + min(ys)) / 2
    k = N * frac / max(max(xs) - min(xs), max(ys) - min(ys))
    B = bevel * N * frac; rc = 0.013 * N * frac; H = np.zeros((N, N))
    for pts in geo.values():
        im = Image.new('L', (N, N), 0)
        ImageDraw.Draw(im).polygon([((x - cx) * k + N / 2, (y - cy) * k + N / 2) for x, y in pts], fill=255)
        mr = ndimage.gaussian_filter(np.array(im, float) / 255, rc) > 0.5       # 평면 모서리 둥글게
        x = np.clip(ndimage.distance_transform_edt(mr) / B, 0, 1)
        h = ndimage.gaussian_filter(B * np.sqrt(1 - (1 - x) ** 2), B * 0.25) * mr  # 1/4 원 단면
        H = np.maximum(H, h)
    return H

def grid_mesh(H, W):
    N = H.shape[0]; inside = H > 0
    keep = ndimage.binary_dilation(inside)
    idx = -np.ones((N, N), int); ii, jj = np.nonzero(keep); idx[ii, jj] = np.arange(len(ii))
    verts = [((j / N - 0.5) * W, -(i / N - 0.5) * W, H[i, j] * W / N) for i, j in zip(ii, jj)]
    a, b, c, d = idx[:-1, :-1], idx[:-1, 1:], idx[1:, 1:], idx[1:, :-1]
    ok = (a >= 0) & (b >= 0) & (c >= 0) & (d >= 0) & (inside[:-1, :-1] | inside[:-1, 1:] | inside[1:, 1:] | inside[1:, :-1])
    me = bpy.data.meshes.new('sym'); me.from_pydata(verts, [], np.stack([a[ok], d[ok], c[ok], b[ok]], 1).tolist()); me.update()
    for p in me.polygons: p.use_smooth = True
    return me

def render(out, size=1536, samples=64, geo_kw=None, grid=1000, bevel=0.12):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = samples; sc.cycles.use_denoising = True
    sc.render.resolution_x = sc.render.resolution_y = size
    sc.render.film_transparent = True; sc.view_settings.view_transform = 'Standard'
    W = 2.0 / FRAC
    me = grid_mesh(heightmap(pieces(**(geo_kw or {})), grid, FRAC, bevel), W)
    ob = bpy.data.objects.new('sym', me); sc.collection.objects.link(ob)
    m = bpy.data.materials.new('puffy'); m.use_nodes = True; nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = srgb(LIT)
    b.inputs['Roughness'].default_value = 0.5; b.inputs['Sheen Weight'].default_value = 0.3
    em = nt.nodes.new('ShaderNodeEmission'); em.inputs['Color'].default_value = srgb(BRAND); em.inputs['Strength'].default_value = 1.0
    add = nt.nodes.new('ShaderNodeAddShader')
    nt.links.new(em.outputs[0], add.inputs[0]); nt.links.new(b.outputs[0], add.inputs[1])
    nt.links.new(add.outputs[0], nt.nodes['Material Output'].inputs['Surface'])
    me.materials.append(m)
    def area(name, loc, rot, energy, s):
        L = bpy.data.lights.new(name, 'AREA'); L.energy = energy; L.size = s
        o = bpy.data.objects.new(name, L); o.location = loc; o.rotation_euler = rot; sc.collection.objects.link(o)
    area('key', (-2.2, 2.6, 4.0), (math.radians(-35), math.radians(-28), 0), 75, 3.0)
    area('rim', (0.0, 4.0, 1.2), (math.radians(-75), 0, 0), 25, 2.0)
    w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
    w.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.0
    cam = bpy.data.cameras.new('c'); cam.type = 'ORTHO'; cam.ortho_scale = W
    co = bpy.data.objects.new('c', cam); co.location = (0, 0, 10); sc.collection.objects.link(co); sc.camera = co
    sc.render.filepath = out
    bpy.ops.render.render(write_still=True)

if __name__ == '__main__':
    render(sys.argv[1], geo_kw=dict(gap=80, crust_gap=80, crust_t=170))
