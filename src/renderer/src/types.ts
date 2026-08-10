export interface ConnectionConfig {
  name?: string
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
}

export interface Tab {
  id: string
  title: string
  config: ConnectionConfig
  status: 'connecting' | 'connected' | 'disconnected' | 'error'
}

export interface SplitPair {
  id: string
  direction: 'vertical' | 'horizontal'
  ratio: number         // 0–1, left/top tab's share
  tabA: string          // left/top tab id
  tabB: string          // right/bottom tab id
}

export interface ForwardRule {
  id: string
  localPort: number
  remoteHost: string
  remotePort: number
  active: boolean
}
