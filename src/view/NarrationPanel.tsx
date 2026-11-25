import { REGIONS } from '../layout';
import { TOKENS } from '../tokens';
import type { Step } from '../types';
import { narrationOf } from './narration';

/** 旁白区：标题一行 + 说明两行 + 步序；整块替换并淡入。 */
export default function Narration({ step, total }: { step: Step | null; total: number }) {
  const region = REGIONS.narration;
  const text = step ? narrationOf(step) : { title: '等待开始', detail: '选择场景或地址后开始单步演示。' };
  return (
    <section
      style={{
        position: 'absolute',
        left: region.x,
        top: region.y,
        width: region.w,
        height: region.h,
        boxSizing: 'border-box',
        padding: '12px 14px',
        background: TOKENS.color.panel,
        border: `1px solid ${TOKENS.color.line}`,
        borderRadius: 6,
        animation: 'fade-in 200ms linear',
      }}
      aria-live="polite"
    >
      <div style={{ font: TOKENS.font.title, color: TOKENS.color.text }}>{text.title}</div>
      <div
        style={{
          marginTop: 8,
          font: TOKENS.font.ui,
          color: TOKENS.color.text,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {text.detail}
      </div>
      {step && (
        <div style={{ marginTop: 10, font: TOKENS.font.mono, fontSize: 11, color: TOKENS.color.textMuted }}>
          第 {step.id + 1} / {total} 步 · tick {step.state.tick}
        </div>
      )}
    </section>
  );
}
