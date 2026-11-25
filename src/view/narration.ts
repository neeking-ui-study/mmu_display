import type { Step } from '../types';

export interface Narration {
  title: string;
  detail: string;
}

const hex = (value: number, width = 3) => `0x${value.toString(16).toUpperCase().padStart(width, '0')}`;

/** 界面中文文案的唯一来源；组件内不得硬编码旁白。 */
export function narrationOf(step: Step): Narration {
  const { state, level } = step;
  const offsetBits = Math.log2(state.cfg.pageSize);
  switch (step.kind) {
    case 'addr_split':
      return {
        title: '拆分地址',
        detail: `把 VA 按位段表拆成 ${state.indices.length} 段页表索引和 ${offsetBits} 位页内偏移；索引从高位到低位依次查表。`,
      };
    case 'tlb_lookup':
      return {
        title: '查 TLB',
        detail: `用 VPN ${hex(Math.floor(state.va / 2 ** offsetBits), 8)} 并行比较 TLB 全部槽位。`,
      };
    case 'tlb_hit':
      return {
        title: 'TLB 命中',
        detail: `命中 TLB，直接取 PFN ${hex(state.result?.pfn ?? 0)}，无需走页表。`,
      };
    case 'tlb_miss':
      return { title: 'TLB 缺失', detail: 'TLB 中没有可用表项（未命中或权限不满足），转入页表 walk。' };
    case 'walk_read':
      return {
        title: `读 L${level ?? 0} 页表`,
        detail: `读取第 ${(level ?? 0) + 1} 级表项（索引 ${hex(state.indices[level ?? 0])}），得到下一级表帧号。`,
      };
    case 'walk_leaf':
      return {
        title: `读 L${level ?? 0} 叶子表项`,
        detail: state.fault
          ? `叶子表项无效或权限不足（索引 ${hex(state.fault.index)}），本步判定失败。`
          : `叶子表项有效，取出 PFN ${hex(state.result?.pfn ?? 0)}。`,
      };
    case 'tlb_fill':
      return { title: '填入 TLB', detail: `把 VPN → PFN 写入 TLB 槽位，最近使用时刻更新为当前 tick。` };
    case 'tlb_evict':
      return { title: '淘汰 TLB 表项', detail: 'TLB 已满，淘汰最近使用时刻最小的表项（LRU）。' };
    case 'fault_page':
      return { title: '缺页异常', detail: `L${level ?? 0} 表项 v=0，触发缺页异常。` };
    case 'fault_perm':
      return {
        title: '权限异常',
        detail: `当前访问类型 ${state.cfg.access} 与叶子表项权限不匹配，触发权限异常。`,
      };
    case 'fault_handle':
      return { title: '异常处理', detail: '分配空闲帧、写回有效 PTE，然后重试本次访存。' };
    case 'done':
      return state.result?.pa != null
        ? { title: '完成', detail: `物理地址 = PFN × 4 KB + 页内偏移 = ${hex(state.result.pa, 6)}。` }
        : { title: '完成（未翻译）', detail: '本次访存以异常结束，没有产生物理地址。' };
    default:
      return { title: '', detail: '' };
  }
}
