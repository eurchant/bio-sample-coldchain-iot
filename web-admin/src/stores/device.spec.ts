import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const { deviceMock } = vi.hoisted(() => ({
  deviceMock: {
    listDevices: vi.fn(),
    registerDevice: vi.fn(),
    bindDevice: vi.fn(),
    unbindDevice: vi.fn(),
    getBindings: vi.fn(),
  },
}))

vi.mock('../services/api', () => {
  class ApiError extends Error {
    status?: number
    code?: number

    constructor(message: string, status?: number, code?: number) {
      super(message)
      this.status = status
      this.code = code
    }
  }
  return { ApiError, remoteDeviceGateway: deviceMock }
})

import { useDeviceStore } from './device'

const device = {
  device_id: 'CLD-900',
  device_name: '验证冷链记录仪',
  model: 'ESP32-S3',
  status: 'available',
  current_task_id: null,
  battery: 83,
  last_seen_at: null,
}

describe('device store', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    setActivePinia(createPinia())
    deviceMock.listDevices.mockResolvedValue({ items: [{ ...device, device_secret_hash: 'must-not-be-kept' }] })
  })

  it('loads the device ledger from the formal device endpoint', async () => {
    const store = useDeviceStore()

    await store.load()

    expect(deviceMock.listDevices).toHaveBeenCalledOnce()
    expect(store.devices).toEqual([device])
    expect(store.devices[0]).not.toHaveProperty('device_secret_hash')
  })

  it('binds a device to an explicit task then refreshes the server state', async () => {
    const store = useDeviceStore()
    deviceMock.bindDevice.mockResolvedValue({
      id: 1,
      device_id: 'CLD-900',
      task_id: 'WD-20260723-001',
      status: 'bound',
    })

    const binding = await store.bind('CLD-900', 'WD-20260723-001')

    expect(binding?.task_id).toBe('WD-20260723-001')
    expect(deviceMock.bindDevice).toHaveBeenCalledWith('CLD-900', 'WD-20260723-001')
    expect(deviceMock.listDevices).toHaveBeenCalledOnce()
  })

  it('does not claim success when a device mutation fails', async () => {
    const store = useDeviceStore()
    deviceMock.unbindDevice.mockRejectedValue(new Error('network unavailable'))

    const result = await store.unbind('CLD-900')

    expect(result).toBeNull()
    expect(store.error).toBe('network unavailable')
  })

  it('loads binding history from the device-specific endpoint', async () => {
    const store = useDeviceStore()
    deviceMock.getBindings.mockResolvedValue({
      items: [{ id: 9, device_id: 'CLD-900', task_id: 'WD-20260723-001', status: 'bound' }],
    })

    await store.loadBindings('CLD-900')

    expect(deviceMock.getBindings).toHaveBeenCalledWith('CLD-900')
    expect(store.bindingHistory['CLD-900'][0]?.task_id).toBe('WD-20260723-001')
  })
})
