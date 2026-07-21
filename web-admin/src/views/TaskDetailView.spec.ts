import { describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import type { Task, TaskStatus } from '../types/contracts'
import { useTaskStore } from '../stores/task'
import TaskDetailView from './TaskDetailView.vue'

function makeTask(status: TaskStatus): Task {
  return {
    task_id: 'TASK-001',
    device_id: 'CLD-001',
    sample_name: '血液样本',
    sender: '发出单位',
    receiver: '接收单位',
    carrier: '测试人员',
    status,
    started_at: status === 'pending_pack' ? null : '2026-07-21T10:30:00+08:00',
    signed_at: status === 'signed' ? '2026-07-21T10:35:00+08:00' : null,
    rejected_at: null,
    rejection_reason: null,
    updated_at: '2026-07-21T10:35:00+08:00',
  }
}

async function mountForStatus(status: TaskStatus) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const store = useTaskStore()
  store.task = makeTask(status)

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/tasks/:taskId', component: TaskDetailView }],
  })
  await router.push('/tasks/TASK-001')
  await router.isReady()

  return mount(TaskDetailView, {
    global: {
      plugins: [pinia, router],
    },
  })
}

describe('TaskDetailView handoff controls', () => {
  it.each([
    ['pending_pack', false, true, true],
    ['in_transit', true, false, false],
    ['signed', true, true, true],
  ] as const)(
    'enforces button limits for %s',
    async (status, startDisabled, signDisabled, rejectDisabled) => {
      const wrapper = await mountForStatus(status)

      const startButton = wrapper.get('[data-testid="start-task"]').element as HTMLButtonElement
      const signButton = wrapper.get('[data-testid="sign-task"]').element as HTMLButtonElement
      const rejectButton = wrapper.get('[data-testid="reject-task"]').element as HTMLButtonElement

      expect(startButton.disabled).toBe(startDisabled)
      expect(signButton.disabled).toBe(signDisabled)
      expect(rejectButton.disabled).toBe(rejectDisabled)
    },
  )
})
