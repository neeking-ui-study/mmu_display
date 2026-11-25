import type { TlbEntry } from '../types';

/** 按 VPN 查找，命中返回槽位与表项。 */
export function lookup(
  tlb: readonly TlbEntry[],
  vpn: number,
): { index: number; entry: TlbEntry } | null {
  const index = tlb.findIndex((entry) => entry.vpn === vpn);
  if (index < 0) return null;
  return { index, entry: tlb[index] };
}

/** 追加一项，返回新数组。 */
export function fill(tlb: readonly TlbEntry[], entry: TlbEntry): TlbEntry[] {
  return [...tlb.map((item) => ({ ...item })), { ...entry }];
}

/** 淘汰 tick 最小项（并列取槽位最小），返回剩余数组与被淘汰槽位。 */
export function evict(tlb: readonly TlbEntry[]): { tlb: TlbEntry[]; index: number } {
  if (tlb.length === 0) throw new Error('TLB 为空，无法淘汰');
  let victim = 0;
  for (let i = 1; i < tlb.length; i += 1) {
    if (tlb[i].tick < tlb[victim].tick) victim = i;
  }
  return {
    tlb: tlb.filter((_, i) => i !== victim).map((item) => ({ ...item })),
    index: victim,
  };
}
