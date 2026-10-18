import {
  joinCloseChannel,
  joinCloseTogether,
  leaveCloseTogether,
  qk,
  type ClosePresence,
} from '@sweetwo/api';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { create } from 'zustand';
import { toast } from '../../shared/toast';
import { copy } from './copy';
import { closePath, useCloseData } from './data';

// 함께 모드(21 W-04a 4~8번): 정리자 / 같이 하기(함께 모드) / 보기만. 접속·단계는 Realtime 채널(close:{id}).
// 함께 모드·보기만이면 누가 단계를 옮겨도 둘 다 이동. 함께 모드 중 상대가 나가면 안내 + 서버에 나감(이후 바꾼 값은 제안).
export type CloseMode = 'alone' | 'closer' | 'together' | 'view';
export const useTogether = create<{
  view: boolean;
  others: ClosePresence[];
  setView: (v: boolean) => void;
  setOthers: (o: ClosePresence[]) => void;
}>((set) => ({
  view: false,
  others: [],
  setView: (view) => set({ view }),
  setOthers: (others) => set({ others }),
}));

/** 이 정리에서 내 역할 */
export function useCloseMode(): CloseMode {
  const d = useCloseData();
  const view = useTogether((x) => x.view);
  const c = d.close;
  if (!c || !d.me || !d.joined || !c.started_by || c.status === 'done') return 'alone';
  if (c.started_by === d.me.id) return 'closer';
  if (c.together_by === d.me.id && c.together_at && !c.together_left_at) return 'together';
  return view ? 'view' : 'alone';
}

/** 함께 모드인지(정리자 쪽에서도: 상대가 같이 하는 중) */
export function useTogetherActive() {
  const d = useCloseData();
  const c = d.close;
  return !!c && !!c.together_at && !c.together_left_at && c.status !== 'done';
}

/** 정리 화면을 감쌈: 채널 접속, 단계 맞추기, 상단 띠(함께 정리 중 / 보기만) */
export function CloseLive({ children }: { children: ReactNode }) {
  const { step = 'w-04a' } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const d = useCloseData();
  const mode = useCloseMode();
  const active = useTogetherActive();
  const setOthers = useTogether((x) => x.setOthers);
  const others = useTogether((x) => x.others);
  const ch = useRef<ReturnType<typeof joinCloseChannel> | null>(null);
  const seen = useRef(false);
  const closeId = d.close?.id ?? null;
  const me = d.me?.id ?? null;
  const live = !!closeId && !!me && d.joined && !!d.close?.started_by;
  const follow = mode === 'together' || mode === 'view' || (mode === 'closer' && active);
  const followRef = useRef(follow);
  followRef.current = follow;

  useEffect(() => {
    if (!live || !closeId || !me) return;
    const c = joinCloseChannel(
      closeId,
      { user: me, step, field: null, mode: mode === 'alone' ? 'view' : mode },
      {
        sync: (o) => {
          setOthers(o);
          if (o.length) seen.current = true;
          else if (seen.current) {
            seen.current = false;
            // 함께 모드 중 상대가 나감 → 이후 바꾼 값은 제안
            void leaveCloseTogether(closeId)
              .then(() => qc.invalidateQueries({ queryKey: qk.monthClose(d.planId ?? '') }))
              .then(() => toast(copy.partnerLeft(d.partnerName)))
              .catch(() => undefined);
          }
        },
        step: (s) => {
          if (followRef.current) nav(closePath(s));
        },
      },
    );
    ch.current = c;
    return () => {
      c.close();
      ch.current = null;
    };
    // 채널은 정리마다 한 번
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, closeId, me]);

  useEffect(() => {
    if (followRef.current) ch.current?.move(step);
    else ch.current?.update({ step });
  }, [step]);
  useEffect(() => {
    ch.current?.update({ mode: mode === 'alone' ? 'view' : mode });
  }, [mode]);

  const partnerTyping = others.find((o) => o.field)?.field;
  const bar =
    mode === 'view' ? (
      <div className="hg-banner hg-banner--info" role="status">
        <span>{copy.viewing}</span>
        <JoinButton />
      </div>
    ) : active && (mode === 'together' || mode === 'closer') ? (
      <div className="hg-banner hg-banner--info" role="status">
        <span className="hg-avatars" aria-hidden="true">
          <span className="hg-avatar hg-avatar--sm hg-avatar--p1">
            {d.couple?.starter ? (d.couple.myName[0] ?? '') : (d.partnerName[0] ?? '')}
          </span>
          <span className="hg-avatar hg-avatar--sm hg-avatar--p2">
            {d.couple?.starter ? (d.partnerName[0] ?? '') : (d.couple?.myName[0] ?? '')}
          </span>
        </span>
        <span>
          {copy.togetherNow}
          {partnerTyping ? `, ${copy.typing(d.partnerName)}` : ''}
        </span>
      </div>
    ) : null;
  return (
    <>
      {bar}
      {mode === 'view' ? <div {...{ inert: '' }}>{children}</div> : children}
    </>
  );
}

/** 보기만 → 같이 하기 */
export function JoinButton() {
  const d = useCloseData();
  const qc = useQueryClient();
  const setView = useTogether((x) => x.setView);
  return (
    <button
      type="button"
      className="hg-btn hg-btn--secondary hg-btn--sm"
      onClick={() => {
        if (!d.close) return;
        void joinCloseTogether(d.close.id)
          .then(() => {
            setView(false);
            return qc.invalidateQueries({ queryKey: qk.monthClose(d.planId ?? '') });
          })
          .catch(() => toast(copy.saveFailed));
      }}
    >
      {copy.joinTogether}
    </button>
  );
}
