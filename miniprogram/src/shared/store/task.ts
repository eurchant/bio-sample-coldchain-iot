import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getTask } from '../api/task'
import type { Task } from '../types/api'

// 全局任务上下文：MVP 固定 TASK-001，页面间共享，避免硬编码
export const useTaskStore = defineStore('task', () => {
  const currentTaskId = ref('TASK-001')
  const task = ref<Task | null>(null)
  const loading = ref(false)

  async function loadTask() {
    loading.value = true
    try {
      task.value = await getTask(currentTaskId.value)
    } finally {
      loading.value = false
    }
  }

  function setTaskId(id: string) {
    currentTaskId.value = id
  }

  return { currentTaskId, task, loading, loadTask, setTaskId }
})
