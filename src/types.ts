export type AddrWidth = 48 | 39;
export type PageSize = 4096 | 2097152;
export type AccessKind = 'read' | 'write' | 'exec';
export type Level = 0 | 1 | 2 | 3; // 距根的深度

export interface Config {
  addrWidth: AddrWidth;
  pageSize: PageSize;
  levels: 2 | 3 | 4; // 推导所得，禁止手填
  tlbEnabled: boolean;
  tlbCapacity: 8;
  access: AccessKind;
}

export interface Pte {
  v: 0 | 1;
  r: 0 | 1;
  w: 0 | 1;
  x: 0 | 1;
  u: 0 | 1;
  a: 0 | 1;
  d: 0 | 1;
  pfn: number; // 非叶子：下一级表帧；叶子：数据页帧
  leaf: boolean;
}

export interface TlbEntry {
  vpn: number;
  pfn: number;
  r: 0 | 1;
  w: 0 | 1;
  x: 0 | 1;
  tick: number; // 最近使用时刻
  asid: number; // v1 固定 0，为地址空间切换预留
}

export interface Fault {
  kind: 'page' | 'perm';
  level: Level;
  index: number; // 出错的表索引
}

export interface MachineState {
  cfg: Config;
  va: number;
  rootFrame: number; // 本场景根页表帧，来自 MemImage.rootFrame
  indices: number[]; // 长度 = levels，由高到低
  offset: number;
  tables: Record<number, Record<number, Pte>>; // 帧号 → 表索引 → PTE
  tlb: TlbEntry[];
  tick: number;
  fault: Fault | null;
  result: { pfn: number; pa: number | null } | null;
}

export type StepKind =
  | 'addr_split'
  | 'tlb_lookup'
  | 'tlb_hit'
  | 'tlb_miss'
  | 'walk_read'
  | 'walk_leaf'
  | 'tlb_fill'
  | 'tlb_evict'
  | 'fault_page'
  | 'fault_perm'
  | 'fault_handle'
  | 'done';

export type ViewRef =
  | 'addr.bits'
  | 'addr.offset'
  | 'pa'
  | `addr.index.${number}`
  | `pte.${number}.${number}`
  | `tlb.${number}`
  | `frame.${number}`;

export interface Step {
  id: number;
  kind: StepKind;
  level: Level | null;
  state: MachineState; // 本步结束后的完整快照
  focus: ViewRef[];
  passed: ViewRef[];
  error: ViewRef[];
}

export type ViewMode = 'plain' | 'register';

/** 配置或入参不合法时抛出的错误，消息内带字段路径。 */
export class ConfigError extends Error {
  readonly path: string | null;

  constructor(message: string, path: string | null = null) {
    super(path ? `${path}: ${message}` : message);
    this.name = 'ConfigError';
    this.path = path;
  }
}
