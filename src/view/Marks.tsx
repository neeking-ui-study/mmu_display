import { SIZES } from '../layout';
import { TOKENS } from '../tokens';

/** 探针：跟随当前焦点中心移动，motion.probe 缩放 1→1.15→1。 */
export function Probe({
  leftPct,
  top,
  active,
  scale = 1,
}: {
  leftPct: number;
  top: number;
  active: boolean;
  scale?: number;
}) {
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        left: `${leftPct}%`,
        top,
        width: SIZES.probeR * 2,
        height: SIZES.probeR * 2,
        marginLeft: -SIZES.probeR,
        marginTop: -SIZES.probeR,
        borderRadius: '50%',
        background: TOKENS.color.focus,
        opacity: active ? 0.9 : 0,
        transform: `scale(${scale})`,
        transition: `left ${TOKENS.motion.probe}, top ${TOKENS.motion.probe}, transform ${TOKENS.motion.probe}, opacity ${TOKENS.motion.fade}`,
        pointerEvents: 'none',
      }}
    />
  );
}

/** 已走路径连线：2px color.linePassed；未走 1px color.line 且 0.35 透明。 */
export function TraceLine({
  passed,
  x1,
  y1,
  x2,
  y2,
}: {
  passed: boolean;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}) {
  return (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke={passed ? TOKENS.color.linePassed : TOKENS.color.line}
      strokeWidth={passed ? 2 : 1}
      opacity={passed ? 1 : 0.35}
      style={{ transition: `stroke ${TOKENS.motion.base}, stroke-width ${TOKENS.motion.base}, opacity ${TOKENS.motion.base}` }}
    />
  );
}
