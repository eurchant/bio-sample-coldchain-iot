import { defineStore } from 'pinia'
import { ApiError, remoteTaskDirectory } from '../services/api'
import { runtimeConfig } from '../services/config'
import { gateway } from '../services/gateway'
import type {
  CreateTaskInput,
  TaskList,
  TaskListQuery,
  TaskStatus,
  UpdateTaskInput,
} from '../types/contracts'

interface TaskDirectoryState {
  result: TaskList
  loading: boolean
  submitting: boolean
  error: string | null
  query: Required<Pick<TaskListQuery, 'page' | 'page_size'>> & Omit<TaskListQuery, 'page' | 'page_size'>
}

const DEFAULT_QUERY: TaskDirectoryState['query'] = {
  page: 1,
  page_size: 10,
  status: undefined,
  keyword: undefined,
  updated_after: undefined,
}

function displayError(error: unknown) {
  if (error instanceof ApiError) {
    const detail = [error.status ? `HTTP ${error.status}` : '', error.code ? `code ${error.code}` : '']
      .filter(Boolean)
      .join(' / ')
    return detail ? `${error.message}（${detail}）` : error.message
  }
  return error instanceof Error ? error.message : '请求失败，请稍后重试。'
}

function createIdempotencyKey() {
  const randomId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2)
  return `web-task-create-${randomId}`
}

function emptyResult(query: TaskDirectoryState['query']): TaskList {
  return { items: [], page: query.page, page_size: query.page_size, total: 0 }
}

function normalizeKeyword(value: string | undefined) {
  const normalized = value?.trim()
  return normalized || undefined
}

export const useTaskDirectoryStore = defineStore('taskDirectory', {
  state: (): TaskDirectoryState => ({
    result: emptyResult(DEFAULT_QUERY),
    loading: false,
    submitting: false,
    error: null,
    query: { ...DEFAULT_QUERY },
  }),
  getters: {
    tasks: (state) => state.result.items,
    totalPages: (state) => Math.max(1, Math.ceil(state.result.total / state.result.page_size)),
  },
  actions: {
    clearError() {
      this.error = null
    },
    async load(query: Partial<TaskListQuery> = {}) {
      const nextQuery = {
        ...this.query,
        ...query,
        keyword: normalizeKeyword(query.keyword ?? this.query.keyword),
      }
      this.query = nextQuery
      this.loading = true
      this.error = null
      try {
        if (runtimeConfig.dataSource === 'api') {
          this.result = await remoteTaskDirectory.listTasks(nextQuery)
          return
        }

        const task = await gateway.getTask(runtimeConfig.taskId)
        const matchesStatus = !nextQuery.status || task.status === nextQuery.status
        const keyword = nextQuery.keyword?.toLowerCase()
        const matchesKeyword =
          !keyword ||
          task.task_id.toLowerCase().includes(keyword) ||
          task.sample_name.toLowerCase().includes(keyword) ||
          (task.batch ?? '').toLowerCase().includes(keyword)
        this.result = {
          items: matchesStatus && matchesKeyword ? [task] : [],
          page: 1,
          page_size: nextQuery.page_size,
          total: matchesStatus && matchesKeyword ? 1 : 0,
        }
      } catch (error) {
        this.error = displayError(error)
      } finally {
        this.loading = false
      }
    },
    async setFilters(filters: { keyword?: string; status?: TaskStatus }) {
      await this.load({ ...filters, page: 1 })
    },
    async goToPage(page: number) {
      const safePage = Math.max(1, Math.min(page, this.totalPages))
      await this.load({ page: safePage })
    },
    async create(input: CreateTaskInput) {
      this.submitting = true
      this.error = null
      try {
        const task = await remoteTaskDirectory.createTask(input, createIdempotencyKey())
        await this.load({ page: 1 })
        return task
      } catch (error) {
        this.error = displayError(error)
        return null
      } finally {
        this.submitting = false
      }
    },
    async update(taskId: string, input: UpdateTaskInput) {
      this.submitting = true
      this.error = null
      try {
        const task = await remoteTaskDirectory.updateTask(taskId, input)
        this.result = {
          ...this.result,
          items: this.result.items.map((item) => (item.task_id === task.task_id ? task : item)),
        }
        return task
      } catch (error) {
        this.error = displayError(error)
        return null
      } finally {
        this.submitting = false
      }
    },
  },
})
