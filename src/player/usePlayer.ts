import { useCallback, useEffect, useRef, useState } from 'react';
import type { Step } from '../types';

export type Speed = 0.5 | 1 | 2 | 4;

/** 基准 1200ms ÷ speed；默认 1×。 */
export const SPEED_MS: Record<Speed, number> = { 0.5: 2400, 1: 1200, 2: 600, 4: 300 };

export interface Player {
  cursor: number;
  playing: boolean;
  lastIndex: number;
  next: () => void;
  prev: () => void;
  seek: (index: number) => void;
  play: () => void;
  pause: () => void;
}

export function usePlayer(steps: Step[], speed: Speed = 1): Player {
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const lastIndex = Math.max(0, steps.length - 1);
  const lastRef = useRef(lastIndex);
  lastRef.current = lastIndex;

  useEffect(() => {
    setCursor(0);
    setPlaying(false);
  }, [steps]);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const frame = (now: number) => {
      acc += now - last;
      last = now;
      if (acc >= SPEED_MS[speed]) {
        acc -= SPEED_MS[speed];
        setCursor((value) => {
          if (value >= lastRef.current) {
            setPlaying(false);
            return value;
          }
          return value + 1;
        });
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed]);

  const next = useCallback(() => setCursor((value) => Math.min(value + 1, lastRef.current)), []);
  const prev = useCallback(() => setCursor((value) => Math.max(value - 1, 0)), []);
  const seek = useCallback(
    (index: number) => setCursor(Math.max(0, Math.min(index, lastRef.current))),
    [],
  );
  const play = useCallback(() => {
    setCursor((value) => (value >= lastRef.current ? 0 : value));
    setPlaying(true);
  }, []);
  const pause = useCallback(() => setPlaying(false), []);

  return { cursor, playing, lastIndex, next, prev, seek, play, pause };
}
