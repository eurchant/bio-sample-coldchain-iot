import { createRouter, createWebHistory } from 'vue-router'
import OverviewView from '../views/OverviewView.vue'
import TaskDetailView from '../views/TaskDetailView.vue'
import TraceReportView from '../views/TraceReportView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'overview', component: OverviewView },
    { path: '/tasks/:taskId', name: 'task-detail', component: TaskDetailView },
    { path: '/trace/:taskId', name: 'trace-report', component: TraceReportView },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

export default router
