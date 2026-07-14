<template>
  <view class="trend-chart" :style="{ height: chartHeight + 'px' }">
    <view class="legend">
      <view class="legend-item">
        <view class="dot temp-dot"></view>
        <text>温度 (℃)</text>
      </view>
      <view class="legend-item">
        <view class="dot hum-dot"></view>
        <text>湿度 (%)</text>
      </view>
    </view>
    <view class="axis-note">左轴：温度 · 右轴：湿度</view>
    <canvas
      type="2d"
      id="trendChart"
      class="trend-canvas"
      :style="{ width: canvasWidth + 'px', height: chartHeight + 'px' }"
    />
    <view v-if="empty" class="empty">暂无历史数据</view>
  </view>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, getCurrentInstance } from 'vue'
import type { Telemetry } from '@/shared/types/api'

const props = defineProps<{
  items: Telemetry[]
}>()

// canvas 无法读取 CSS 变量，以下颜色字面量必须与 DESIGN.md §2 的 --cc-* 令牌保持一致
const TOKENS = {
  primary: '#533afd',       // --cc-primary（温度线/点）
  primarySoft: '#665efd',   // --cc-primary-soft（湿度线）
  inkMute: '#64748b',       // --cc-ink-mute（轴刻度文字）
  grid: '#eef1f5',          // --cc-neutral-bg（网格线）
}

const systemInfo = uni.getSystemInfoSync()
const canvasWidth = ref(systemInfo.windowWidth - 80) // 减去卡片内边距 + 左右轴刻度空间
const chartHeight = ref(180)
const empty = ref(true)

let ctx: CanvasRenderingContext2D | null = null
let canvasNode: any = null
const dpr = systemInfo.pixelRatio

function initCanvas() {
  const instance = getCurrentInstance()
  const query = uni.createSelectorQuery().in(instance!.proxy as any)
  query
    .select('#trendChart')
    .fields({ node: true, size: true }, (res: any) => {
      if (!res || !res[0] || !res[0].node) return
      canvasNode = res[0].node
      canvasNode.width = res[0].width * dpr
      canvasNode.height = res[0].height * dpr
      ctx = canvasNode.getContext('2d') as CanvasRenderingContext2D
      ctx.scale(dpr, dpr)
      draw()
    })
    .exec()
}

function draw() {
  if (!ctx) return
  const c = ctx
  const w = canvasWidth.value
  const h = chartHeight.value
  c.clearRect(0, 0, w, h)

  const items = props.items
  if (!items || items.length === 0) {
    empty.value = true
    return
  }
  empty.value = false

  // 倒序变正序（左旧右新）
  const series = [...items].reverse()
  const temps = series.map((t) => t.temperature)
  const hums = series.map((t) => t.humidity)

  const padL = 36
  const padR = 30
  const padT = 16
  const padB = 24
  const plotW = w - padL - padR
  const plotH = h - padT - padB

  const tMin = Math.min(...temps)
  const tMax = Math.max(...temps)
  const hMin = Math.min(...hums)
  const hMax = Math.max(...hums)
  // 温度范围留余量
  const tLo = Math.floor(tMin - 2)
  const tHi = Math.ceil(tMax + 2)
  const hLo = Math.floor(hMin - 5)
  const hHi = Math.ceil(hMax + 5)

  const xStep = series.length > 1 ? plotW / (series.length - 1) : 0
  const xOf = (i: number) => padL + i * xStep
  const yOfT = (v: number) => padT + plotH - ((v - tLo) / (tHi - tLo || 1)) * plotH
  const yOfH = (v: number) => padT + plotH - ((v - hLo) / (hHi - hLo || 1)) * plotH

  // 网格 + Y 轴刻度（温度，左轴）
  ctx.strokeStyle = TOKENS.grid
  ctx.lineWidth = 1
  ctx.setLineDash([])
  ctx.fillStyle = TOKENS.inkMute
  ctx.font = '10px -apple-system, "PingFang SC", sans-serif'
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  const gridLines = 4
  for (let i = 0; i <= gridLines; i++) {
    const y = padT + (plotH / gridLines) * i
    ctx.beginPath()
    ctx.moveTo(padL, y)
    ctx.lineTo(padL + plotW, y)
    ctx.stroke()
    const tVal = tHi - ((tHi - tLo) / gridLines) * i
    ctx.fillText(tVal.toFixed(0), padL - 6, y)
  }

  // 湿度刻度（右轴）
  ctx.textAlign = 'left'
  for (let i = 0; i <= gridLines; i++) {
    const y = padT + (plotH / gridLines) * i
    const hVal = hHi - ((hHi - hLo) / gridLines) * i
    ctx.fillText(hVal.toFixed(0), padL + plotW + 6, y)
  }

  // 湿度线（靛蓝 soft）
  ctx.strokeStyle = TOKENS.primarySoft
  ctx.lineWidth = 2
  ctx.beginPath()
  hums.forEach((v, i) => {
    const x = xOf(i)
    const y = yOfH(v)
    if (i === 0) c.moveTo(x, y)
    else c.lineTo(x, y)
  })
  ctx.stroke()

  // 温度线（靛蓝主色）
  ctx.strokeStyle = TOKENS.primary
  ctx.lineWidth = 2
  ctx.beginPath()
  temps.forEach((v, i) => {
    const x = xOf(i)
    const y = yOfT(v)
    if (i === 0) c.moveTo(x, y)
    else c.lineTo(x, y)
  })
  ctx.stroke()

  // 温度点
  ctx.fillStyle = TOKENS.primary
  temps.forEach((v, i) => {
    c.beginPath()
    c.arc(xOf(i), yOfT(v), 2, 0, Math.PI * 2)
    c.fill()
  })
}

onMounted(initCanvas)

watch(
  () => props.items,
  () => draw(),
  { deep: true }
)
</script>

<style scoped>
.trend-chart {
  position: relative;
  width: 100%;
}
.legend {
  display: flex;
  gap: 16px;
  padding: 0 4px 4px;
  font-size: 11px;
  color: var(--cc-ink-mute, #64748b);
}
.legend-item {
  display: flex;
  align-items: center;
  gap: 5px;
}
.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}
.temp-dot {
  background: var(--cc-primary, #533afd);
}
.hum-dot {
  background: var(--cc-primary-soft, #665efd);
}
.axis-note {
  font-size: 10px;
  color: var(--cc-ink-faint, #94a3b8);
  padding: 0 4px 8px;
}
.trend-canvas {
  display: block;
}
.empty {
  position: absolute;
  top: 60%;
  left: 0;
  right: 0;
  text-align: center;
  color: var(--cc-ink-faint, #94a3b8);
  font-size: 13px;
}
</style>
