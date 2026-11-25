import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { PAGE_SIZES, deriveLevels } from './config';
import { CONTROL_REGISTRY, controlLabel } from './data/controls';
import type { ControlId } from './data/controls';
import { configOfLoaded, parseConfigDoc } from './data/configDoc';
import { buildMemImage } from './data/memory';
import type { MemImage } from './data/memory';
import { SCENARIO_LIST, loadScenario } from './data/scenarios';
import type { ScenarioId } from './data/scenarios';
import { run } from './engine/run';
import { REGIONS, SIZES } from './layout';
import { usePlayer } from './player/usePlayer';
import type { Speed } from './player/usePlayer';
import { TOKENS } from './tokens';
import { ConfigError } from './types';
import type { AccessKind, AddrWidth, Config, PageSize, Step, ViewMode } from './types';
import AddressBar from './view/AddressBar';
import MemPanel from './view/MemPanel';
import Narration from './view/NarrationPanel';
import TableTree from './view/TableTree';
import Timeline from './view/Timeline';
import TlbPanel from './view/TlbPanel';

interface Model {
  /** 内置场景 id；载入自定义配置后为 null。 */
  scenarioId: ScenarioId | null;
  source: string;
  cfg: Config;
  va: number;
  mem: MemImage;
  steps: Step[];
}

const hex = (value: number, width: number) =>
  `0x${value.toString(16).toUpperCase().padStart(width, '0')}`;

const pageLabel = (size: PageSize) => (size === 4096 ? '4 KB' : '2 MB');

const errText = (caught: unknown) =>
  caught instanceof ConfigError || caught instanceof Error ? caught.message : String(caught);

function buildModel(
  mem: MemImage,
  cfg: Config,
  va: number,
  scenarioId: ScenarioId | null,
  source: string,
): Model {
  return { scenarioId, source, cfg, va, mem, steps: run(va, cfg, mem) };
}

function fromScenario(id: ScenarioId): Model {
  const scenario = loadScenario(id);
  return buildModel(scenario.mem, scenario.cfg, scenario.va, id, `内置 ${id} · ${scenario.name}`);
}

function initialView(): ViewMode {
  return new URLSearchParams(window.location.search).get('view') === 'register' ? 'register' : 'plain';
}

/** 48 位 12 位十六进制、39 位 10 位；超位宽或非法字符返回 null。 */
function parseVa(text: string, width: number): number | null {
  const raw = text.trim().replace(/^0x/i, '');
  if (raw === '' || !/^[0-9a-fA-F]+$/.test(raw)) return null;
  const value = parseInt(raw, 16);
  if (!Number.isSafeInteger(value) || value >= 2 ** width) return null;
  return value;
}

export default function App() {
  const [model, setModel] = useState<Model>(() => fromScenario('A'));
  const [viewMode, setViewMode] = useState<ViewMode>(initialView);
  const [speed, setSpeed] = useState<Speed>(1);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [vaText, setVaText] = useState(() => hex(model.va, Math.ceil(model.cfg.addrWidth / 4)));
  const [vaInvalid, setVaInvalid] = useState(false);
  const player = usePlayer(model.steps, speed);
  const step = model.steps[player.cursor] ?? null;

  useEffect(
    () => setVaText(hex(model.va, Math.ceil(model.cfg.addrWidth / 4))),
    [model.va, model.cfg.addrWidth],
  );

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('view', viewMode);
    window.history.replaceState(null, '', url);
  }, [viewMode]);

  const commit = (next: Model) => {
    setModel(next);
    setError(null);
  };

  const guard = (factory: () => Model, prefix = '') => {
    try {
      commit(factory());
      return true;
    } catch (caught) {
      setError(`${prefix}${errText(caught)}`);
      return false;
    }
  };

  const patch = (next: Partial<Config>, va = model.va) =>
    guard(() => buildModel(model.mem, { ...model.cfg, ...next }, va, model.scenarioId, model.source));

  const loadDoc = (text: string, source: string, prefix: string) =>
    guard(() => {
      const loaded = parseConfigDoc(text);
      return buildModel(
        buildMemImage(loaded.spec),
        configOfLoaded(loaded),
        loaded.va,
        null,
        source,
      );
    }, prefix);

  const loadFile = async (file: File) => {
    try {
      const text = await file.text();
      loadDoc(text, `文件 ${file.name}`, '配置载入失败：');
    } catch (caught) {
      setError(`配置载入失败：${errText(caught)}`);
    }
  };

  useEffect(() => {
    const target = new URLSearchParams(window.location.search).get('config');
    if (!target) return;
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(target);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const text = await response.text();
        if (!cancelled) loadDoc(text, `URL ${target}`, '配置加载失败：');
      } catch (caught) {
        if (!cancelled) setError(`配置加载失败：${errText(caught)}`);
      }
    })();
    return () => {
      cancelled = true;
    };
    // 仅在首次挂载时读取 URL 参数。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const commitVa = () => {
    const value = parseVa(vaText, model.cfg.addrWidth);
    if (value === null) {
      setVaInvalid(true);
      return;
    }
    setVaInvalid(false);
    guard(() =>
      buildModel(model.mem, model.cfg, value, model.scenarioId, model.source),
    );
  };

  const changeScenario = (id: ScenarioId) => {
    setVaInvalid(false);
    guard(() => fromScenario(id));
  };

  const mismatchText = (next: { addrWidth: AddrWidth; pageSize: PageSize }) =>
    `页表按 ${model.mem.addrWidth} 位 / ${pageLabel(model.mem.pageSize)} 构建，与所选 ${next.addrWidth} 位 / ${pageLabel(next.pageSize)} 不匹配；请载入匹配配置或换场景`;

  const changeWidth = (width: AddrWidth) => {
    if (width === model.cfg.addrWidth) return;
    if (width !== model.mem.addrWidth) {
      setError(mismatchText({ addrWidth: width, pageSize: model.cfg.pageSize }));
      return;
    }
    patch({ addrWidth: width, levels: deriveLevels(width, model.cfg.pageSize) });
  };

  const changePageSize = (value: PageSize) => {
    if (value === model.cfg.pageSize) return;
    if (value !== model.mem.pageSize) {
      setError(mismatchText({ addrWidth: model.cfg.addrWidth, pageSize: value }));
      return;
    }
    patch({ pageSize: value, levels: deriveLevels(model.cfg.addrWidth, value) });
  };

  return (
    <div
      style={{
        position: 'relative',
        width: SIZES.viewport.w,
        height: SIZES.viewport.h,
        background: TOKENS.color.bg,
        color: TOKENS.color.text,
        font: TOKENS.font.ui,
        margin: '0 auto',
        overflow: 'hidden',
      }}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        const file = event.dataTransfer.files?.[0];
        if (file) void loadFile(file);
      }}
    >
      <Toolbar
        model={model}
        viewMode={viewMode}
        speed={speed}
        state={{
          vaText,
          vaInvalid,
          cursor: player.cursor,
          total: model.steps.length,
          playing: player.playing,
        }}
        onScenario={changeScenario}
        onVaText={(text) => {
          setVaText(text);
          setVaInvalid(parseVa(text, model.cfg.addrWidth) === null);
        }}
        onCommitVa={commitVa}
        onFile={(file) => void loadFile(file)}
        onWidth={changeWidth}
        onPageSize={changePageSize}
        onTlb={(enabled) => patch({ tlbEnabled: enabled })}
        onAccess={(access) => patch({ access })}
        onViewMode={setViewMode}
        onSpeed={setSpeed}
        onPrev={player.prev}
        onNext={player.next}
        onPlay={() => (player.playing ? player.pause() : player.play())}
      />

      {error && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'absolute',
            left: REGIONS.addrBar.x,
            right: REGIONS.addrBar.x,
            top: REGIONS.toolbar.h,
            height: 28,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '0 10px',
            boxSizing: 'border-box',
            background: TOKENS.color.error,
            color: TOKENS.color.bg,
            font: TOKENS.font.ui,
            fontSize: 12,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            zIndex: 10,
          }}
        >
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            aria-label="关闭错误提示"
            style={{ border: 'none', background: 'transparent', color: TOKENS.color.bg, cursor: 'pointer' }}
          >
            ×
          </button>
        </div>
      )}

      <AddressBar cfg={model.cfg} va={model.va} step={step} />
      <TableTree step={step} viewMode={viewMode} />
      <TlbPanel step={step} enabled={model.cfg.tlbEnabled} />
      <Narration step={step} total={model.steps.length} />
      <MemPanel step={step} />
      <Timeline steps={model.steps} cursor={player.cursor} onSeek={player.seek} />

      {dragging && (
        <div
          style={{
            position: 'absolute',
            inset: 8,
            border: `2px dashed ${TOKENS.color.vpn}`,
            borderRadius: 8,
            background: `${TOKENS.color.vpn}0D`,
            display: 'grid',
            placeItems: 'center',
            font: TOKENS.font.title,
            color: TOKENS.color.vpn,
            pointerEvents: 'none',
          }}
        >
          松开以载入配置 JSON
        </div>
      )}
    </div>
  );
}

const controlStyle = {
  height: SIZES.controlH,
  boxSizing: 'border-box',
  font: TOKENS.font.ui,
  fontSize: 12,
  color: TOKENS.color.text,
  background: TOKENS.color.bg,
  border: `1px solid ${TOKENS.color.line}`,
  borderRadius: 4,
  padding: '0 4px',
} as const;

const buttonStyle = {
  ...controlStyle,
  cursor: 'pointer',
  minWidth: 26,
} as const;

const fieldLabelStyle = {
  fontSize: 10,
  lineHeight: '12px',
  color: TOKENS.color.textMuted,
} as const;

const fieldValueStyle = {
  font: TOKENS.font.mono,
  fontSize: 10,
  lineHeight: '11px',
  color: TOKENS.color.textMuted,
  whiteSpace: 'nowrap',
} as const;

function Field({
  id,
  viewMode,
  value,
  children,
}: {
  id: ControlId;
  viewMode: ViewMode;
  value: string;
  children: ReactNode;
}) {
  const meta = CONTROL_REGISTRY.find((item) => item.id === id);
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={fieldLabelStyle}>{controlLabel(id, viewMode)}</span>
      {children}
      {viewMode === 'register' && meta && (
        <span style={fieldValueStyle} title={meta.hint}>
          {meta.field} = {value}
        </span>
      )}
    </label>
  );
}

/** register 视角下按寄存器把控件归拢成组；plain 视角只显示组内控件。 */
function Group({
  title,
  viewMode,
  children,
}: {
  title: string;
  viewMode: ViewMode;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        paddingLeft: 8,
        borderLeft: `1px solid ${TOKENS.color.line}`,
      }}
    >
      <span style={{ ...fieldLabelStyle, fontSize: 9, lineHeight: '10px' }}>
        {viewMode === 'register' ? title : ' '}
      </span>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>{children}</div>
    </div>
  );
}

interface ToolbarProps {
  model: Model;
  viewMode: ViewMode;
  speed: Speed;
  state: {
    vaText: string;
    vaInvalid: boolean;
    cursor: number;
    total: number;
    playing: boolean;
  };
  onScenario: (id: ScenarioId) => void;
  onVaText: (text: string) => void;
  onCommitVa: () => void;
  onFile: (file: File) => void;
  onWidth: (width: AddrWidth) => void;
  onPageSize: (value: PageSize) => void;
  onTlb: (enabled: boolean) => void;
  onAccess: (access: AccessKind) => void;
  onViewMode: (mode: ViewMode) => void;
  onSpeed: (speed: Speed) => void;
  onPrev: () => void;
  onNext: () => void;
  onPlay: () => void;
}

function Toolbar(props: ToolbarProps) {
  const { model, viewMode, speed, state } = props;
  const { cfg } = model;
  const fileRef = useRef<HTMLInputElement>(null);

  const valueOf = (id: ControlId): string => {
    switch (id) {
      case 'addrWidth':
        return String(64 - cfg.addrWidth);
      case 'pageSize':
        return cfg.pageSize === 4096 ? '0b00' : '—';
      case 'tlbEnabled':
        return cfg.tlbEnabled ? '1' : '0';
      case 'access':
        return cfg.access;
      case 'rootFrame':
        return hex(model.mem.rootFrame, 3);
    }
  };

  return (
    <header
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: REGIONS.toolbar.w,
        height: REGIONS.toolbar.h,
        boxSizing: 'border-box',
        padding: '6px 16px',
        display: 'flex',
        alignItems: 'flex-end',
        gap: 10,
        borderBottom: `1px solid ${TOKENS.color.line}`,
        background: TOKENS.color.panel,
      }}
    >
      <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={fieldLabelStyle}>场景</span>
        <select
          style={{ ...controlStyle, width: 132 }}
          value={model.scenarioId ?? 'custom'}
          onChange={(event) => {
            if (event.target.value !== 'custom') props.onScenario(event.target.value as ScenarioId);
          }}
          title="切换场景会重新 run 且游标归 0"
        >
          {SCENARIO_LIST.map((item) => (
            <option key={item.id} value={item.id}>
              {`${item.id} · ${item.addrWidth} 位 · ${pageLabel(item.pageSize)}`}
            </option>
          ))}
          {model.scenarioId === null && <option value="custom">自定义</option>}
        </select>
      </label>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={fieldLabelStyle} title={model.source}>
          配置
        </span>
        <button
          type="button"
          style={{ ...buttonStyle, minWidth: 64 }}
          onClick={() => fileRef.current?.click()}
          title={`选择或拖入配置 JSON（当前：${model.source}）`}
        >
          载入…
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          aria-label="载入配置 JSON"
          style={{ display: 'none' }}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) props.onFile(file);
            event.target.value = '';
          }}
        />
      </div>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={fieldLabelStyle}>地址（回车 / 失焦提交）</span>
        <input
          style={{
            ...controlStyle,
            width: 148,
            font: TOKENS.font.mono,
            borderColor: state.vaInvalid ? TOKENS.color.error : TOKENS.color.line,
          }}
          aria-invalid={state.vaInvalid}
          value={state.vaText}
          onChange={(event) => props.onVaText(event.target.value)}
          onBlur={props.onCommitVa}
          onKeyDown={(event) => {
            if (event.key === 'Enter') props.onCommitVa();
          }}
        />
      </label>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={fieldLabelStyle}>视角</span>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['plain', 'register'] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => props.onViewMode(mode)}
              style={{
                ...buttonStyle,
                minWidth: 54,
                fontWeight: viewMode === mode ? 600 : 400,
                borderColor: viewMode === mode ? TOKENS.color.vpn : TOKENS.color.line,
                color: viewMode === mode ? TOKENS.color.vpn : TOKENS.color.text,
              }}
            >
              {mode === 'plain' ? 'plain' : 'register'}
            </button>
          ))}
        </div>
      </div>

      <Group title="TCR_EL1" viewMode={viewMode}>
        <Field id="addrWidth" viewMode={viewMode} value={valueOf('addrWidth')}>
          <select
            style={{ ...controlStyle, width: 64 }}
            value={cfg.addrWidth}
            onChange={(event) => props.onWidth(Number(event.target.value) as AddrWidth)}
          >
            <option value={48}>48</option>
            <option value={39}>39</option>
          </select>
        </Field>

        <Field id="pageSize" viewMode={viewMode} value={valueOf('pageSize')}>
          <select
            style={{ ...controlStyle, width: 76 }}
            value={cfg.pageSize}
            onChange={(event) => props.onPageSize(Number(event.target.value) as PageSize)}
          >
            {PAGE_SIZES[cfg.addrWidth].map((size) => (
              <option key={size} value={size}>
                {size === 4096 ? '4 KB' : '2 MB'}
              </option>
            ))}
          </select>
        </Field>
      </Group>

      <Group title="模拟开关 / 访存" viewMode={viewMode}>
        <Field id="tlbEnabled" viewMode={viewMode} value={valueOf('tlbEnabled')}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, height: SIZES.controlH }}>
            <input
              type="checkbox"
              checked={cfg.tlbEnabled}
              onChange={(event) => props.onTlb(event.target.checked)}
            />
            <span style={{ font: TOKENS.font.mono, fontSize: 12 }}>{cfg.tlbEnabled ? '开' : '关'}</span>
          </label>
        </Field>

        <Field id="access" viewMode={viewMode} value={valueOf('access')}>
          <select
            style={{ ...controlStyle, width: 72 }}
            value={cfg.access}
            onChange={(event) => props.onAccess(event.target.value as AccessKind)}
          >
            <option value="read">read</option>
            <option value="write">write</option>
            <option value="exec">exec</option>
          </select>
        </Field>
      </Group>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={fieldLabelStyle}>播放</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button type="button" onClick={props.onPrev} style={buttonStyle} aria-label="上一步">
            ‹
          </button>
          <button type="button" onClick={props.onPlay} style={buttonStyle} aria-label="播放或暂停">
            {state.playing ? '❚❚' : '▶'}
          </button>
          <button type="button" onClick={props.onNext} style={buttonStyle} aria-label="下一步">
            ›
          </button>
          <select
            style={{ ...controlStyle, width: 62 }}
            value={speed}
            onChange={(event) => props.onSpeed(Number(event.target.value) as Speed)}
            title="播放间隔 = 1200ms ÷ speed"
          >
            <option value={0.5}>0.5×</option>
            <option value={1}>1×</option>
            <option value={2}>2×</option>
            <option value={4}>4×</option>
          </select>
          <span style={{ font: TOKENS.font.mono, fontSize: 11, color: TOKENS.color.textMuted, width: 58 }}>
            {state.cursor + 1}/{state.total}
          </span>
        </div>
      </div>

      {viewMode === 'register' && (
        <span
          style={{
            marginLeft: 'auto',
            font: TOKENS.font.mono,
            fontSize: 10,
            color: TOKENS.color.textMuted,
            whiteSpace: 'nowrap',
          }}
          title="本页所有寄存器与位域均为教学模拟，不对应真实硬件写入"
        >
          模拟值，非真实寄存器写入
        </span>
      )}
    </header>
  );
}
