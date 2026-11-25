import { bitFieldOf, deriveIndices } from '../config';
import type { MemImage } from '../data/memory';
import { ConfigError } from '../types';
import type {
  Config,
  Level,
  MachineState,
  Pte,
  Step,
  StepKind,
  ViewRef,
} from '../types';
import { checkPerm, handlePageFault } from './fault';
import { evict, fill, lookup } from './tlb';
import { readLevel } from './walk';

const ref = {
  index: (i: number): ViewRef => `addr.index.${i}`,
  pte: (frame: number, index: number): ViewRef => `pte.${frame}.${index}`,
  tlb: (i: number): ViewRef => `tlb.${i}`,
  frame: (frame: number): ViewRef => `frame.${frame}`,
};

function cloneTables(
  tables: Record<number, Record<number, Pte>>,
): Record<number, Record<number, Pte>> {
  const next: Record<number, Record<number, Pte>> = {};
  for (const [frame, table] of Object.entries(tables)) {
    const copy: Record<number, Pte> = {};
    for (const [index, pte] of Object.entries(table)) copy[Number(index)] = { ...pte };
    next[Number(frame)] = copy;
  }
  return next;
}

function cloneState(state: MachineState): MachineState {
  return {
    ...state,
    indices: [...state.indices],
    tables: cloneTables(state.tables),
    tlb: state.tlb.map((entry) => ({ ...entry })),
    fault: state.fault ? { ...state.fault } : null,
    result: state.result ? { ...state.result } : null,
  };
}

/** 纯函数：不读时间、随机数或 DOM；同输入两次调用逐字段一致。 */
export function run(va: number, cfg: Config, mem: MemImage): Step[] {
  const field = bitFieldOf(cfg.addrWidth, cfg.pageSize);
  if (cfg.levels !== field.levels) {
    throw new ConfigError(`levels 应为 ${field.levels}`, 'levels');
  }
  if (mem.addrWidth !== cfg.addrWidth) {
    throw new ConfigError(`页表按 ${mem.addrWidth} 位构建，与当前 ${cfg.addrWidth} 位配置不匹配`, 'mem.addrWidth');
  }
  if (mem.pageSize !== cfg.pageSize) {
    throw new ConfigError(
      `页表按 ${mem.pageSize === 4096 ? '4 KB' : '2 MB'} 页构建，与当前页大小不匹配`,
      'mem.pageSize',
    );
  }
  if (!(mem.rootFrame in mem.tables)) {
    throw new ConfigError('rootFrame 不在 tables 中', 'mem.rootFrame');
  }
  if (!Number.isInteger(va) || va < 0 || va >= 2 ** cfg.addrWidth) {
    throw new ConfigError('地址超出当前位宽', 'va');
  }

  const state: MachineState = {
    cfg,
    va,
    rootFrame: mem.rootFrame,
    indices: [],
    offset: 0,
    tables: cloneTables(mem.tables),
    tlb: mem.tlb.map((entry) => ({ ...entry })),
    tick: 0,
    fault: null,
    result: null,
  };
  const steps: Step[] = [];
  let passed: ViewRef[] = [];

  const emit = (kind: StepKind, level: Level | null, focus: ViewRef[], error: ViewRef[] = []) => {
    state.tick += 1;
    steps.push({
      id: steps.length,
      kind,
      level,
      state: cloneState(state),
      focus,
      passed: [...passed],
      error,
    });
    if (error.length === 0) passed = [...passed, ...focus];
  };

  const vpn = Math.floor(va / 2 ** field.offsetBits);
  const slots = Array.from({ length: cfg.tlbCapacity }, (_, i) => ref.tlb(i));

  const finish = () => {
    if (state.result) {
      const { pfn } = state.result;
      state.result = { pfn, pa: pfn * cfg.pageSize + state.offset };
      emit('done', null, ['addr.offset', ref.frame(pfn), 'pa']);
    } else {
      emit('done', null, []);
    }
  };

  const fillTlb = (pte: Pick<Pte, 'pfn' | 'r' | 'w' | 'x'>) => {
    if (!cfg.tlbEnabled) return;
    if (state.tlb.length >= cfg.tlbCapacity) {
      const victim = evict(state.tlb);
      state.tlb = victim.tlb;
      emit('tlb_evict', null, [ref.tlb(victim.index)]);
    }
    const slot = state.tlb.length;
    state.tlb = fill(state.tlb, {
      vpn,
      pfn: pte.pfn,
      r: pte.r,
      w: pte.w,
      x: pte.x,
      tick: state.tick + 1, // emit 内 tick 再 +1
      asid: 0,
    });
    emit('tlb_fill', null, [ref.tlb(slot)]);
  };

  const walk = () => {
    let frame = state.rootFrame;
    for (let level = 0; level < cfg.levels; level += 1) {
      const index = state.indices[level];
      const pteRef = ref.pte(frame, index);
      const pte = readLevel(state.tables, frame, index);
      if (level < cfg.levels - 1) {
        if (pte.v === 0) {
          throw new ConfigError('非末级表项 v=0 不建模', `tables[0x${frame}][0x${index}]`);
        }
        emit('walk_read', level as Level, [pteRef]);
        frame = pte.pfn;
        continue;
      }
      if (pte.v === 0) {
        state.fault = { kind: 'page', level: level as Level, index };
        emit('walk_leaf', level as Level, [pteRef]);
        emit('fault_page', level as Level, [], [pteRef]);
        const handled = handlePageFault(state.tables, mem, frame, index);
        state.tables = handled.tables;
        state.fault = null;
        emit('fault_handle', level as Level, [ref.frame(handled.newFrame), pteRef]);
        const retry = readLevel(state.tables, frame, index);
        state.result = { pfn: retry.pfn, pa: null };
        emit('walk_leaf', level as Level, [pteRef]);
        fillTlb(retry);
        finish();
        return;
      }
      if (!checkPerm(pte, cfg.access)) {
        state.fault = { kind: 'perm', level: level as Level, index };
        emit('walk_leaf', level as Level, [pteRef]);
        emit('fault_perm', level as Level, [], [pteRef]);
        finish();
        return;
      }
      state.result = { pfn: pte.pfn, pa: null };
      emit('walk_leaf', level as Level, [pteRef]);
      fillTlb(pte);
      finish();
      return;
    }
  };

  const { indices, offset } = deriveIndices(va, cfg);
  state.indices = indices;
  state.offset = offset;
  emit('addr_split', null, ['addr.bits', ...indices.map((_, i) => ref.index(i)), 'addr.offset']);

  if (cfg.tlbEnabled) {
    emit('tlb_lookup', null, slots);
    const hit = lookup(state.tlb, vpn);
    if (hit && checkPerm(hit.entry, cfg.access)) {
      state.result = { pfn: hit.entry.pfn, pa: null };
      emit('tlb_hit', null, [ref.tlb(hit.index)]);
      finish();
      return steps;
    }
    emit('tlb_miss', null, [], slots);
  }

  walk();
  return steps;
}
