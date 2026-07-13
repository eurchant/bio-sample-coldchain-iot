import { describe, expect, it } from 'vitest'
import { boxLabel, statusTone, taskLabel, temperatureLabel } from './format'

describe('contract status display helpers', () => {
  it('only maps backend enum values to presentation labels', () => {
    expect(taskLabel('in_transit')).toBe('运输中')
    expect(boxLabel('BOX_CLOSED')).toBe('箱体闭合')
    expect(temperatureLabel('TEMP_ALERT')).toBe('温度异常')
  })

  it('marks backend alert values with the danger tone', () => {
    expect(statusTone('TEMP_ALERT')).toBe('danger')
    expect(statusTone('signed')).toBe('safe')
  })
})
