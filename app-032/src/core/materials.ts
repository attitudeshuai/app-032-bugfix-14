/**
 * 材料统计与备料单（规格书 §4.6 / §5）
 * 备料按含余量长度；竹篾/蒙面/扎线/胶 批量 = 单灯 × N × (1 + 损耗率)；
 * 净长/净面积/体积/表面积为几何量，只随数量放大（不含损耗）；
 * LED 按颗数 × N（整数，不参与损耗率）。
 */
import type { FrameMember, Lantern } from './types'
import { bodySurfaceArea, bodyVolume, r1, r3 } from './geometry'
import { buildFrame } from './frame'
import { buildPanels } from './panels'
import { CRAFT, coveringSpec } from './craft'

export interface SingleLightMaterials {
  /** 竹篾/铁丝备料总长（含绑扎余量，m） */
  frameM: number
  /** 全部构件净长（m，不含绑扎余量） */
  frameRawM: number
  /** 蒙面面积（含缝份，m²） */
  coveringM2: number
  /** 蒙面净面积（不含缝份，m²） */
  coveringNetM2: number
  /** 扎线（m）= 绑扎总处数 × 每处用线 */
  lashM: number
  /** 胶（g）= 含缝份裁片面积 × 所选材料每平方米用胶量 */
  glueG: number
  /** 绑扎总处数（Σ 每根数量 × 每根余量处数） */
  lashJoints: number
  /** 灯体体积（L） */
  volumeL: number
  /** LED 建议颗数（不做电气设计，仅数量建议） */
  ledCount: number
  /** 灯体表面积（m²） */
  surfaceM2: number
}

export interface BatchMaterials extends SingleLightMaterials {
  count: number
  wasteRatio: number
}

/**
 * 批量数量归一化：返回 ≥1 的整数；输入 <1 或非法时返回 0。
 * 返回 0 时界面必须给出提示、不出空表（computeBatch 内部会按 1 兜底计算）。
 */
export function normalizeBatchCount(v: unknown): number {
  const n = Math.floor(Number(v))
  return Number.isFinite(n) && n >= 1 ? n : 0
}

export function computeMaterials(l: Lantern): SingleLightMaterials {
  const frame = buildFrame(l)
  const panelRes = buildPanels(l)
  const cov = coveringSpec(l.covering)

  // 与骨架件表同一份合计：备料按含余量长度，净长用于核对
  const stockMm = frame.stockLengthMm
  const rawMm = frame.rawLengthMm
  // 扎线按各处绑扎的总处数 × 每处用线量
  const joints = frame.members.reduce((s, m: FrameMember) => s + m.qty * m.lashJoints, 0)
  const cutM2 = panelRes.cutAreaMm2 / 1_000_000
  const netM2 = panelRes.netAreaMm2 / 1_000_000
  const volumeL = bodyVolume(frame.geometry) / 1_000_000

  return {
    frameM: r3(stockMm / 1000),
    frameRawM: r3(rawMm / 1000),
    coveringM2: r3(cutM2),
    coveringNetM2: r3(netM2),
    lashM: r3(joints * CRAFT.lashPerJointM),
    // 用胶按含缝份的裁片面积折算（折边也要涂胶），费率随所选蒙面材料
    glueG: r1(cutM2 * cov.gluePerM2),
    lashJoints: joints,
    volumeL: r3(volumeL),
    ledCount: Math.max(CRAFT.led.min, Math.ceil(volumeL * CRAFT.led.perLiter)),
    surfaceM2: r3(bodySurfaceArea(frame.geometry, Math.max(3, Math.round(l.divisions))) / 1_000_000)
  }
}

/**
 * 批量化：
 *  - 竹篾/蒙面/扎线/胶 = 单灯 × N × (1 + 损耗率)（损耗率存的是小数，界面给百分数）；
 *  - 净长/净面积/体积/表面积为几何量 = 单灯 × N（不含损耗）；
 *  - LED = 单灯颗数 × N（整数，不参与损耗率）。
 */
export function computeBatch(single: SingleLightMaterials, count: number, wasteRatio: number): BatchMaterials {
  const n = normalizeBatchCount(count) || 1 // 兜底按 1 算，绝不出 NaN/空表；界面按 normalizeBatchCount 提示
  const w = Math.max(0, Number(wasteRatio) || 0)
  const k = n * (1 + w)
  return {
    ...single,
    count: n,
    wasteRatio: w,
    frameM: r3(single.frameM * k),
    coveringM2: r3(single.coveringM2 * k),
    lashM: r3(single.lashM * k),
    glueG: r1(single.glueG * k),
    frameRawM: r3(single.frameRawM * n),
    coveringNetM2: r3(single.coveringNetM2 * n),
    volumeL: r3(single.volumeL * n),
    surfaceM2: r3(single.surfaceM2 * n),
    ledCount: single.ledCount * n
  }
}
