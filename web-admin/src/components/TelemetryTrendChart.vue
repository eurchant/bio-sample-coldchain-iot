<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { init, use, type ECharts, type EChartsCoreOption } from 'echarts/core'
import { LineChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import { SVGRenderer } from 'echarts/renderers'
import { buildTelemetryChartData } from '../lib/telemetryChart'
import type { Telemetry } from '../types/contracts'

// Register only the ECharts pieces this component renders.
use([LineChart, GridComponent, LegendComponent, TooltipComponent, SVGRenderer])

const props = withDefaults(
  defineProps<{
    history?: readonly Telemetry[]
  }>(),
  {
    history: () => [],
  },
)

const chartHost = ref<HTMLElement | null>(null)
const chartData = computed(() => buildTelemetryChartData(props.history))

let chart: ECharts | null = null
let resizeObserver: ResizeObserver | null = null
let themeObserver: MutationObserver | null = null

function readThemeColor(name: string, fallback: string) {
  const value = window.getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

function buildChartOption(): EChartsCoreOption {
  const isLightTheme = document.documentElement.dataset.theme === 'light'
  const fallback = isLightTheme
    ? {
        text: '#1d3931',
        muted: '#638078',
        grid: 'rgba(29, 57, 49, 0.14)',
        tooltip: '#ffffff',
      }
    : {
        text: '#dff8ed',
        muted: '#88a99e',
        grid: 'rgba(141, 213, 190, 0.16)',
        tooltip: '#0b2925',
      }
  const palette = {
    text: readThemeColor('--chart-text', fallback.text),
    muted: readThemeColor('--chart-muted', fallback.muted),
    grid: readThemeColor('--chart-grid', fallback.grid),
    tooltip: readThemeColor('--chart-tooltip-background', fallback.tooltip),
    temperature: readThemeColor('--chart-temperature', '#6de0b7'),
    humidity: readThemeColor('--chart-humidity', '#6cc4ee'),
  }
  const points = chartData.value.points
  // A single real measurement has no visible line segment. Keep its marker so
  // the chart does not look empty while still avoiding fabricated data points.
  const showSingleMeasurementSymbol = points.length === 1

  return {
    animationDuration: 280,
    animationDurationUpdate: 180,
    grid: {
      top: 42,
      right: 52,
      bottom: 34,
      left: 52,
      containLabel: true,
    },
    legend: {
      top: 4,
      right: 4,
      itemWidth: 10,
      itemHeight: 3,
      textStyle: { color: palette.muted, fontSize: 11 },
      data: ['温度 °C', '湿度 %RH'],
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: palette.tooltip,
      borderColor: palette.grid,
      textStyle: { color: palette.text },
      axisPointer: { type: 'line', lineStyle: { color: palette.grid } },
    },
    xAxis: {
      type: 'time',
      axisLine: { lineStyle: { color: palette.grid } },
      axisTick: { show: false },
      axisLabel: { color: palette.muted, fontSize: 10, formatter: '{HH}:{mm}' },
      splitLine: { show: false },
    },
    yAxis: [
      {
        type: 'value',
        name: '温度 °C',
        nameTextStyle: { color: palette.muted, fontSize: 10 },
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: palette.muted, fontSize: 10 },
        splitLine: { lineStyle: { color: palette.grid, type: 'dashed' } },
      },
      {
        type: 'value',
        name: '湿度 %RH',
        nameTextStyle: { color: palette.muted, fontSize: 10 },
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: palette.muted, fontSize: 10 },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: '温度 °C',
        type: 'line',
        yAxisIndex: 0,
        showSymbol: showSingleMeasurementSymbol,
        symbolSize: 8,
        smooth: false,
        connectNulls: false,
        lineStyle: { width: 2.5, color: palette.temperature },
        itemStyle: { color: palette.temperature },
        data: points.map((point) => [point.timestamp, point.temperature]),
      },
      {
        name: '湿度 %RH',
        type: 'line',
        yAxisIndex: 1,
        showSymbol: showSingleMeasurementSymbol,
        symbolSize: 8,
        smooth: false,
        connectNulls: false,
        lineStyle: { width: 2.5, color: palette.humidity },
        itemStyle: { color: palette.humidity },
        data: points.map((point) => [point.timestamp, point.humidity]),
      },
    ],
  }
}

function disposeChart() {
  resizeObserver?.disconnect()
  resizeObserver = null
  chart?.dispose()
  chart = null
}

function renderChart() {
  if (!chart) return
  chart.setOption(buildChartOption(), { notMerge: true, lazyUpdate: true })
  chart.resize()
}

async function syncChart() {
  if (!chartData.value.hasMeasurements) {
    disposeChart()
    return
  }

  await nextTick()
  if (!chartHost.value) return

  if (!chart) {
    chart = init(chartHost.value, undefined, { renderer: 'svg' })
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => chart?.resize())
      resizeObserver.observe(chartHost.value)
    }
  }

  renderChart()
}

watch(chartData, () => {
  void syncChart()
})

onMounted(() => {
  if (typeof MutationObserver !== 'undefined') {
    themeObserver = new MutationObserver(() => renderChart())
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })
  }
  void syncChart()
})

onUnmounted(() => {
  themeObserver?.disconnect()
  themeObserver = null
  disposeChart()
})
</script>

<template>
  <section class="telemetry-trend-chart" aria-label="温湿度历史趋势">
    <div
      v-if="chartData.hasMeasurements"
      ref="chartHost"
      class="telemetry-trend-chart__canvas"
      role="img"
      aria-label="基于已有遥测历史的温度和湿度趋势图"
    ></div>
    <div v-else class="dashboard-empty-chart telemetry-trend-chart__empty" role="status">
      暂无历史温湿度记录，等待后端返回遥测数据。
    </div>
  </section>
</template>

<style scoped>
.telemetry-trend-chart {
  min-height: 220px;
  margin-top: 17px;
  padding-top: 10px;
  border-top: 1px solid var(--chart-grid, rgba(133, 210, 184, 0.11));
}

.telemetry-trend-chart__canvas {
  width: 100%;
  height: clamp(220px, 28vw, 310px);
}

.telemetry-trend-chart__empty {
  min-height: 220px;
}
</style>
