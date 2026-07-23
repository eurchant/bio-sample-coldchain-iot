function printableTimestamp(value: string | null | undefined) {
  if (!value) return '未更新时间'

  const matched = value.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})/)
  if (matched) return `${matched[1]}_${matched[2]}-${matched[3]}-${matched[4]}`

  return value.replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]+/g, '-')
}

export function buildTraceReportPrintTitle(taskId: string, updatedAt: string | null | undefined) {
  return `冷链追溯报告_${taskId}_${printableTimestamp(updatedAt)}`
}

export function printTraceReport(taskId: string, updatedAt: string | null | undefined) {
  const previousTitle = document.title
  document.title = buildTraceReportPrintTitle(taskId, updatedAt)
  window.print()
  document.title = previousTitle
}
