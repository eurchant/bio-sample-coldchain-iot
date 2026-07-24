import { defineStore } from 'pinia'
import { describeApiError, remoteTaskPreparation } from '../services/api'
import { runtimeConfig } from '../services/config'
import type { Task, TaskAssignmentInput, TaskPrecheckInput, UserCandidate } from '../types/contracts'

interface TaskPreparationState {
  carriers: UserCandidate[]
  receivers: UserCandidate[]
  loadingCandidates: boolean
  actionLoading: 'assign' | 'precheck' | null
  error: string | null
  message: string | null
}

export const useTaskPreparationStore = defineStore('taskPreparation', {
  state: (): TaskPreparationState => ({
    carriers: [],
    receivers: [],
    loadingCandidates: false,
    actionLoading: null,
    error: null,
    message: null,
  }),
  actions: {
    clearFeedback() {
      this.error = null
      this.message = null
    },
    async loadCandidates() {
      if (runtimeConfig.dataSource !== 'api') return
      this.loadingCandidates = true
      this.error = null
      try {
        const [carriers, receivers] = await Promise.all([
          remoteTaskPreparation.listCandidates('carrier'),
          remoteTaskPreparation.listCandidates('receiver'),
        ])
        this.carriers = carriers.items.filter((user) => user.status === 'active')
        this.receivers = receivers.items.filter((user) => user.status === 'active')
      } catch (error) {
        this.error = describeApiError(error)
      } finally {
        this.loadingCandidates = false
      }
    },
    async assign(taskId: string, input: TaskAssignmentInput): Promise<Task | null> {
      this.actionLoading = 'assign'
      this.clearFeedback()
      try {
        const task = await remoteTaskPreparation.assignTask(taskId, input)
        this.message = '承运方与接收方已由后端确认。'
        return task
      } catch (error) {
        this.error = describeApiError(error)
        return null
      } finally {
        this.actionLoading = null
      }
    },
    async precheck(taskId: string, input: TaskPrecheckInput): Promise<Task | null> {
      this.actionLoading = 'precheck'
      this.clearFeedback()
      try {
        const task = await remoteTaskPreparation.precheckTask(taskId, input)
        this.message = input.passed ? '装箱预检已通过，等待发出交接。' : '预检结果已记录，任务仍待处理。'
        return task
      } catch (error) {
        this.error = describeApiError(error)
        return null
      } finally {
        this.actionLoading = null
      }
    },
  },
})
