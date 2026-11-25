export interface Region {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 基准视口 1440×900，原点为页面左上角，单位 px。 */
export const REGIONS = {
  toolbar: { x: 0, y: 0, w: 1440, h: 56 },
  addrBar: { x: 24, y: 64, w: 1392, h: 88 },
  pageTable: { x: 24, y: 164, w: 620, h: 516 },
  tlb: { x: 656, y: 164, w: 352, h: 236 },
  narration: { x: 656, y: 412, w: 352, h: 268 },
  memory: { x: 1020, y: 164, w: 396, h: 516 },
  timeline: { x: 24, y: 692, w: 1392, h: 180 },
} as const satisfies Record<string, Region>;

export const SIZES = {
  viewport: { w: 1440, h: 900 },
  cell: { w: 28, h: 24 },
  gap: 2,
  frame: { w: 20, h: 20 },
  probeR: 5,
  pageWindow: 16,
  addrBitsPerCell: 3,
  addrCells: { 48: 16, 39: 13 },
  addrCellH: 28,
  tlbRowH: 22,
  timelineH: 34,
  controlH: 24,
  memGrid: 16,
  frameCount: 256,
} as const;
