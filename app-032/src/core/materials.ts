/**
 * 材料统计与备料单（规格书 §4.6 / §5）
 *
 * 口径（材料页 / 裁片页 / 骨架件表 / 导出备料单同一数值）：
 * - frameM       竹篾备料总长 = 构件「截取长度（含绑扎余量）」合计；
 * - frameRawM    构件净长合计 = 构件「净长」合计（核对量，不含余量）；
 * - coveringM2   蒙面备料 = 裁片面积合计（含缝份）；
 * - coveringNetM2 蒙面净面积合计（不含缝份，核对量）；
 * - lashM        扎线 = 绑扎总处数（Σ 数量×每根绑扎处数）× 每处用线量；
 * - glueG        胶 = 含缝份裁片面积 × 该蒙面材料每平方米用胶量（折边也要涂到）。
 *
 * 批量化：
 * - 竹篾 / 蒙面（含缝份）/ 扎线 / 胶：单灯 × 数量 × (1 + 损耗率)；
 * - LED：单灯颗数 × 数量（整数颗，不摊损耗）；
 * - 净长 / 净面积 / 体积 / 表面积为核对量：单灯 × 数量，不摊损耗。
 */
import type { FrameMember, Lantern } from './types'
import { bodySurfaceArea, bodyVolume, r1, r3 } from './geometry'
import { buildFrame } from './frame'
import { buildPanels } from './panels'
import { CRAFT, coveringSpec } from './craft'

export interface SingleLightMaterials {
  /** 竹篾/铁丝备料总长（含绑扎余量，m） */
  frameM: number
  /** 全部构件净长合计（m，核对量，不含余量） */
  frameRawM: number
  /** 蒙面备料面积（含缝份，m²） */
  coveringM2: number
  /** 蒙面净面积合计（不含缝份，m²，核对量） */
  coveringNetM2: number
  /** 扎线（m） */
  lashM: number
  /** 胶（g） */
  glueG: number
  /** 绑扎总处数（Σ 构件数量 × 每根绑扎处数） */
  lashJoints: number
  /** 灯体体积（L） */
  volumeL: number
  /** LED 建议颗数（不做电气设计，仅数量建议；最低 CRAFT.led.min 颗） */
  ledCount: number
  /** 灯体表面积（m²） */
  surfaceM2: number
}

export interface BatchMaterials extends SingleLightMaterials {
  count: number
  wasteRatio: number
}

/** 规范化批量数量：非正 / 空 / NaN 一律按 1 兜底（视图层另行提示，杜绝 NaN 与空表） */
export function normalizeCount(v: number): number {
  const n = Math.round(Number(v))
  return Number.isFinite(n) && n >= 1 ? n : 1
}

export function computeMaterials(l: Lantern): SingleLightMaterials {
  const frame = buildFrame(l)
  const panelRes = buildPanels(l)
  const cov = coveringSpec(l.covering)

  // 扎线总处数：每种构件 数量 × 每根的绑扎处数（竖篾两端 2 处、横篾圈接头 1 处……）
  const lashJoints = frame.members.reduce(
    (s, m: FrameMember) => s + m.qty * m.lashJoints,
    0
  )

  const volumeL = bodyVolume(frame.geometry) / 1_000_000
  const ledByVolume = Math.ceil(volumeL * CRAFT.led.perLiter)

  return {
    frameM: r3(frame.stockLengthMm / 1000),
    frameRawM: r3(frame.rawLengthMm / 1000),
    coveringM2: r3(panelRes.cutAreaMm2 / 1_000_000),
    coveringNetM2: r3(panelRes.netAreaMm2 / 1_000_000),
    lashM: r3(lashJoints * CRAFT.lashPerJointM),
    glueG: r1((panelRes.cutAreaMm2 / 1_000_000) * cov.gluePerM2),
    lashJoints,
    volumeL: r3(volumeL),
    ledCount: Math.max(CRAFT.led.min, ledByVolume),
    surfaceM2: r3(bodySurfaceArea(frame.geometry, Math.max(3, Math.round(l.divisions))) / 1_000_000)
  }
}

/**
 * 批量化：
 * 竹篾 / 蒙面（含缝份）/ 扎线 / 胶 = 单灯 × 数量 × (1 + 损耗率)；
 * LED = 单灯颗数 × 数量（整数，不参与损耗）；
 * 净长 / 净面积等核对量 = 单灯 × 数量（不摊损耗）。
 */
export function computeBatch(single: SingleLightMaterials, count: number, wasteRatio: number): BatchMaterials {
  const n = normalizeCount(count)
  const k = n * (1 + wasteRatio)
  return {
    ...single,
    count: n,
    wasteRatio,
    frameM: r3(single.frameM * k),
    frameRawM: r3(single.frameRawM * n),
    coveringM2: r3(single.coveringM2 * k),
    coveringNetM2: r3(single.coveringNetM2 * n),
    lashM: r3(single.lashM * k),
    glueG: r1(single.glueG * k),
    volumeL: r3(single.volumeL * n),
    ledCount: single.ledCount * n,
    surfaceM2: r3(single.surfaceM2 * n)
  }
}
