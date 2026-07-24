import { defineStore } from 'pinia'
import { describeApiError, remoteDashboardGateway } from '../services/api'
import { runtimeConfig } from '../services/config'
import type { DashboardSummary } from '../types/contracts'

interface DashboardState {
  summary: DashboardSummary | null
  loading: boolean
  refreshing: boolean
  error: string | null
  lastSuccessAt: string | null
}

export const useDashboardStore = defineStore('dashboard', {
  state: (): DashboardState => ({
    summary: null,
    loading: false,
    refreshing: false,
    error: null,
    lastSuccessAt: null,
  }),
  actions: {
    async load() {
      if (runtimeConfig.dataSource !== 'api') {
        this.error = '聚合大屏仅在实时 API 模式可用；Mock 模式不伪造全局统计数据。'
        return
      }
      if (this.refreshing) return
      this.loading = !this.summary
      this.refreshing = true
      this.error = null
      try {
        this.summary = await remoteDashboardGateway.getSummary()
        this.lastSuccessAt = new Date().toISOString()
      } catch (error) {
        this.error = describeApiError(error)
      } finally {
        this.loading = false
        this.refreshing = false
      }
    },
  },
})
