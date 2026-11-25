import { allocFrame } from '../data/memory';
import type { MemImage } from '../data/memory';
import type { AccessKind, Pte } from '../types';

type Perm = Pick<Pte, 'r' | 'w' | 'x'>;

/** 读需 r=1，写需 w=1，执行需 x=1；u 位仅展示。 */
export function checkPerm(perm: Perm, access: AccessKind): boolean {
  if (access === 'read') return perm.r === 1;
  if (access === 'write') return perm.w === 1;
  return perm.x === 1;
}

/** 页缺失处置：取最小空闲帧、写回 v1/r1/w1/a1/d0 的叶子表项。 */
export function handlePageFault(
  tables: Record<number, Record<number, Pte>>,
  mem: MemImage,
  frame: number,
  index: number,
): { tables: Record<number, Record<number, Pte>>; newFrame: number } {
  const newFrame = allocFrame(mem, mem.freeFrameStart);
  const pte = tables[frame][index];
  tables[frame][index] = {
    ...pte,
    v: 1,
    r: 1,
    w: 1,
    x: 0,
    u: 0,
    a: 1,
    d: 0,
    pfn: newFrame,
    leaf: true,
  };
  return { tables, newFrame };
}
