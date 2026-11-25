import type { ViewMode } from '../types';

export type ControlId = 'addrWidth' | 'pageSize' | 'tlbEnabled' | 'access' | 'rootFrame';

export interface ControlMeta {
  id: ControlId;
  /** plain 视角名称 */
  name: string;
  /** register 视角标签：寄存器名或抽象开关名 */
  register: string;
  /** register 视角常驻行的位域名 */
  field: string;
  configField: string;
  values: string;
  hint: string;
  interactive: boolean;
}

export const CONTROL_REGISTRY: readonly ControlMeta[] = [
  {
    id: 'addrWidth',
    name: '位宽',
    register: 'TCR_EL1.T0SZ',
    field: 'T0SZ[5:0]',
    configField: 'cfg.addrWidth',
    values: '48 / 39',
    hint: '决定 VA 宽度与页表级数；T0SZ = 64 - VA 位宽',
    interactive: true,
  },
  {
    id: 'pageSize',
    name: '页大小',
    register: 'TCR_EL1.TG0',
    field: 'TG0[15:14]',
    configField: 'cfg.pageSize',
    values: '4 KB / 2 MB',
    hint: '与位宽共同推导 levels；2 MB 为模拟的块粒度，无真实编码',
    interactive: true,
  },
  {
    id: 'tlbEnabled',
    name: 'TLB',
    register: 'TLB 开关（模拟）',
    field: 'enabled',
    configField: 'cfg.tlbEnabled',
    values: '开 / 关',
    hint: '关闭时 TLB 区置灰并显示「TLB 已关闭」',
    interactive: true,
  },
  {
    id: 'access',
    name: '访问类型',
    register: '访存类型（模拟）',
    field: 'access',
    configField: 'cfg.access',
    values: '读 / 写 / 执行',
    hint: '决定末级 PTE 的权限判定',
    interactive: true,
  },
  {
    id: 'rootFrame',
    name: '根表帧',
    register: 'TTBR0_EL1',
    field: 'TTBR0_EL1[47:12]',
    configField: 'mem.rootFrame',
    values: '由场景配置决定',
    hint: '只读，不允许手填',
    interactive: false,
  },
];

export function controlLabel(id: ControlId, mode: ViewMode): string {
  const meta = CONTROL_REGISTRY.find((item) => item.id === id);
  if (!meta) return id;
  return mode === 'register' ? meta.register : meta.name;
}
