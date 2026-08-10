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

export interface ForwardRule {
  id: string
  localPort: number
  remoteHost: string
  remotePort: number
  active: boolean
}
