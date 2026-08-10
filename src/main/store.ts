import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync } from 'fs'

const storePath = join(app.getPath('userData'), 'connections.json')
const settingsPath = join(app.getPath('userData'), 'settings.json')

export interface SavedConnection {
  id: string
  name: string
  host: string
  port: number
  username: string
  password?: string
  privateKey?: string
  jumpHost?: {
    host: string
    port: number
    username: string
    password?: string
    privateKey?: string
  }
  createdAt: number
}

export interface ConnectionGroup {
  id: string
  name: string
  collapsed: boolean
}

interface ConnectionsData {
  connections: SavedConnection[]
  groups: ConnectionGroup[]
}

export function loadConnections(): ConnectionsData {
  if (!existsSync(storePath)) return { connections: [], groups: [] }
  try {
    const raw = JSON.parse(readFileSync(storePath, 'utf-8'))
    // Old format: plain array of connections
    if (Array.isArray(raw)) {
      return { connections: raw, groups: [] }
    }
    // New format: { connections, groups }
    return { connections: raw.connections || [], groups: raw.groups || [] }
  } catch {
    return { connections: [], groups: [] }
  }
}

export function saveConnections(data: ConnectionsData): void {
  writeFileSync(storePath, JSON.stringify(data, null, 2), 'utf-8')
}

export function loadSettings(): Record<string, unknown> {
  if (!existsSync(settingsPath)) return {}
  try {
    return JSON.parse(readFileSync(settingsPath, 'utf-8'))
  } catch {
    return {}
  }
}

export function saveSettings(settings: Record<string, unknown>): void {
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8')
}
