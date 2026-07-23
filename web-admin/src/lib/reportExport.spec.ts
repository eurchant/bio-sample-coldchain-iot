import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildTraceReportPrintTitle, printTraceReport } from './reportExport'

describe('trace report print export', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    document.title = 'Web 管理端'
  })

  it('creates a PDF-friendly title from the actual task ID and update time', () => {
    expect(buildTraceReportPrintTitle('TASK-001', '2026-07-21T10:35:00+08:00')).toBe(
      '冷链追溯报告_TASK-001_2026-07-21_10-35-00',
    )
  })

  it('opens the browser print flow and restores the page title afterwards', () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined)

    printTraceReport('TASK-001', '2026-07-21T10:35:00+08:00')

    expect(print).toHaveBeenCalledOnce()
    expect(document.title).toBe('Web 管理端')
  })
})
