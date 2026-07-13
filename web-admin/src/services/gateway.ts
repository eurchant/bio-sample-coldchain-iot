import { remoteGateway, type TaskGateway } from './api'
import { runtimeConfig } from './config'
import { mockGateway } from './mockClient'

export const gateway: TaskGateway = runtimeConfig.dataSource === 'mock' ? mockGateway : remoteGateway
