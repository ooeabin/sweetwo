import sys, numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage
from geom import pieces

def hexrgb(h): return np.array([int(h[i:i+2],16) for i in (1,3,5)],float)/255

def masks(geo, size, frac, ss=2):
    # 심볼 폭을 캔버스의 frac로, 바운딩 박스 가운데에 놓음
    allp = [p for k in geo for p in geo[k]]
    xs=[p[0] for p in allp]; ys=[p[1] for p in allp]
    w=max(xs)-min(xs); h=max(ys)-min(ys); cx=(max(xs)+min(xs))/2; cy=(max(ys)+min(ys))/2
    S=size*ss; k=S*frac/max(w,h)
    out={}
    for name,pts in geo.items():
        im=Image.new('L',(S,S),0)
        ImageDraw.Draw(im).polygon([((x-cx)*k+S/2,(y-cy)*k+S/2) for x,y in pts],fill=255)
        out[name]=np.array(im,float)/255
    return out, k

def render(size=1024, frac=0.62, gap=80, crust_gap=80, crust_t=170, bg='#FFFFFF',
           base='#FF6F0F', light='#FF9E52', dark='#E35A00', bevel=0.075, ss=3, shadow=True):
    geo=pieces(gap,crust_gap,crust_t)
    M,k=masks(geo,size,frac,ss); S=size*ss
    B=bevel*S*frac            # 둥근 모서리 반경(px)
    H=np.zeros((S,S)); U=np.zeros((S,S))
    rc=0.013*S*frac             # 평면 모서리 둥글기
    for m in M.values():
        mr=ndimage.gaussian_filter(m,rc)
        mr=np.clip((mr-0.5)*60+0.5,0,1)                 # 둥근 모서리 마스크(부드러운 경계)
        d=ndimage.distance_transform_edt(mr>0.5)
        x=np.clip(d/B,0,1); h=B*np.sqrt(1-(1-x)**2)   # 1/4 원 단면
        h=ndimage.gaussian_filter(h,B*0.30)*(mr>0.02)  # 접힘 자국 없애기
        H=np.maximum(H,h); U=np.maximum(U,mr)
    gy,gx=np.gradient(H)
    N=np.dstack([-gx,-gy,np.ones_like(H)]); N/=np.linalg.norm(N,axis=2,keepdims=True)
    L=np.array([-0.45,-0.65,0.62]); L/=np.linalg.norm(L)
    V=np.array([0,0,1.0]); Hh=(L+V)/np.linalg.norm(L+V)
    diff=np.clip((N*L).sum(2),0,1)
    spec=np.clip((N*Hh).sum(2),0,1)**28
    # 평평한 윗면 기준 diff0 → base, 밝으면 light, 어두우면 dark
    d0=L[2]; t=(diff-d0)
    col=np.where(t[...,None]>=0, hexrgb(base)+(hexrgb(light)-hexrgb(base))*np.clip(t/(1-d0),0,1)[...,None],
                 hexrgb(base)+(hexrgb(dark)-hexrgb(base))*np.clip(-t/d0,0,1)[...,None])
    # 위쪽이 살짝 밝은 세로 그라데이션(윗면)
    yy=np.linspace(0,1,S)[:,None,None]
    col=col+ (0.035-0.07*yy)
    col=col+0.22*spec[...,None]*(1-col)       # 반무광 하이라이트
    # 틈 안쪽 살짝 어둡게(앰비언트 오클루전)
    occ=ndimage.gaussian_filter(U,B*0.6); ao=np.clip(1-0.10*(occ-U*0)*(1-np.clip(H/B,0,1)),0.85,1)
    col=np.clip(col*ao[...,None],0,1)
    bgc=hexrgb(bg) if bg else None
    canvas=np.ones((S,S,3))*(bgc if bg else 1)
    alpha=np.zeros((S,S))
    if shadow:
        sh=ndimage.shift(U,(B*0.9,0),order=1); sh=ndimage.gaussian_filter(sh,B*0.55)
        sc=np.array([0.62,0.33,0.16])
        a=0.14*sh
        canvas=canvas*(1-a[...,None])+sc*a[...,None]
        alpha=np.maximum(alpha,a)
    Um=U
    canvas=canvas*(1-Um[...,None])+col*Um[...,None]
    alpha=np.maximum(alpha,Um)
    rgb=Image.fromarray((canvas*255+.5).clip(0,255).astype(np.uint8)).resize((size,size),Image.LANCZOS)
    if bg: return rgb
    # 투명 배경: 색은 premultiplied 해제
    a=Image.fromarray((alpha*255+.5).astype(np.uint8)).resize((size,size),Image.LANCZOS)
    pre=Image.fromarray(((col*Um[...,None]+np.array([0.62,0.33,0.16])*(alpha-Um).clip(0)[...,None])*255).clip(0,255).astype(np.uint8)).resize((size,size),Image.LANCZOS)
    A=np.array(a,float)/255; P=np.array(pre,float)/255
    C=np.where(A[...,None]>0.003,P/np.maximum(A[...,None],1e-3),0).clip(0,1)
    return Image.fromarray(np.dstack([C*255,A*255]).round().clip(0,255).astype(np.uint8),'RGBA')

if __name__=='__main__':
    render().save(sys.argv[1] if len(sys.argv)>1 else 'icon.png')
