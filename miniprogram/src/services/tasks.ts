import { appConfig } from '@/config/env'
import type { ContractMeta, Task, Telemetry } from '@/types/api'
import { mockContracts, mockGetTask, mockLatest, mockStart } from './mock'
import { request } from './request'

export const taskService = {
  getContracts: () => appConfig.useMock ? mockContracts() : request<ContractMeta>('/api/v1/meta/contracts'),
  getTask: (taskId: string) => appConfig.useMock ? mockGetTask(taskId) : request<Task>(`/api/v1/tasks/${encodeURIComponent(taskId)}`),
  getLatestTelemetry: (taskId: string) => appConfig.useMock ? mockLatest(taskId) : request<Telemetry | null>(`/api/v1/tasks/${encodeURIComponent(taskId)}/telemetry/latest`),
  startTask: (taskId: string) => appConfig.useMock ? mockStart(taskId) : request<Task>(`/api/v1/tasks/${encodeURIComponent(taskId)}/start`, { method: 'POST' }),
  async listDemoTasks() {
    const results = await Promise.allSettled(appConfig.demoTaskIds.map((id) => this.getTask(id)))
    return results.filter((item): item is PromiseFulfilledResult<Task> => item.status === 'fulfilled').map((item) => item.value)
  },
}
