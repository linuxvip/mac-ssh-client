import { Client, ConnectConfig } from 'ssh2'
import * as net from 'net'
import * as fs from 'fs'
import * as os from 'os'
import { join } from 'path'
import { StringDecoder } from 'string_decoder'
import { IpcMainInvokeEvent } from 'electron'

const logFile = join(os.tmpdir(), 'ssh-client-debug.log')
function debugLog(msg: string): void {
  fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${msg}\n`)
}

export interface SSHConfig {
  sessionId: string
  host: string
  port?: number
  username: string
  password?: string
  privateKey?: string
  jumpHost?: {
    host: string
    port?: number
    username: string
    password?: string
    privateKey?: string
  }
}

export interface ForwardConfig {
  localPort: number
  remoteHost: string
  remotePort: number
}

interface Session {
  client: Client
  jumpClient?: Client
  stream: any
}

interface ForwardEntry {
  server: net.Server
}

const sessions = new Map<string, Session>()
const forwards = new Map<string, ForwardEntry>()

export function getSession(sessionId: string): Session | undefined {
  return sessions.get(sessionId)
}

function readKey(keyPath?: string): Buffer | undefined {
  if (!keyPath) return undefined
  const resolved = keyPath.replace(/^~/, os.homedir())
  try {
    if (fs.existsSync(resolved)) return fs.readFileSync(resolved)
  } catch { /* ignore */ }
  return undefined
}

export async function testSSHConnection(
  config: SSHConfig
): Promise<{ success: boolean; error?: string }> {
  const targetPort = config.port || 22

  debugLog(`Test connection: ${config.host}:${targetPort} user:${config.username}`)

  return new Promise((resolve) => {
    const conn = new Client()
    let resolved = false

    function resolveOnce(result: { success: boolean; error?: string }): void {
      if (resolved) return
      resolved = true
      try { conn.end() } catch { /* ignore */ }
      resolve(result)
    }

    conn.on('error', (err) => {
      resolveOnce({ success: false, error: `连接失败: ${err.message}` })
    })

    conn.on('ready', () => {
      // 执行一个简单命令验证连接可用
      conn.exec('echo ok', { timeout: 10000 }, (err, stream) => {
        if (err) {
          resolveOnce({ success: false, error: `认证成功但无法执行命令: ${err.message}` })
          return
        }
        let output = ''
        stream.on('data', (data: Buffer) => { output += data.toString() })
        stream.stderr.on('data', (data: Buffer) => { output += data.toString() })
        stream.on('close', (code: number) => {
          if (code === 0 && output.trim() === 'ok') {
            resolveOnce({ success: true })
          } else {
            resolveOnce({ success: false, error: `命令执行异常 (exit=${code}): ${output.trim()}` })
          }
        })
      })
    })

    const targetOpts: ConnectConfig = {
      host: config.host,
      port: targetPort,
      username: config.username,
      password: config.password || undefined,
      privateKey: readKey(config.privateKey),
      readyTimeout: 10000
    }

    if (config.jumpHost) {
      // 跳板机模式测试连接
      const jump = config.jumpHost
      const jumpClient = new Client()

      jumpClient.on('error', (err) => {
        resolveOnce({ success: false, error: `跳板机连接失败: ${err.message}` })
      })

      jumpClient.on('ready', () => {
        jumpClient.forwardOut('127.0.0.1', 0, config.host, targetPort, (err, stream) => {
          if (err) {
            jumpClient.end()
            resolveOnce({ success: false, error: `跳板机转发失败: ${err.message}` })
            return
          }
          conn.connect({
            sock: stream,
            username: config.username,
            password: config.password || undefined,
            privateKey: readKey(config.privateKey),
            readyTimeout: 10000
          })
        })
      })

      jumpClient.connect({
        host: jump.host,
        port: jump.port || 22,
        username: jump.username,
        password: jump.password || undefined,
        privateKey: readKey(jump.privateKey),
        readyTimeout: 10000
      })
    } else {
      conn.connect(targetOpts)
    }
  })
}

export async function createSSHConnection(
  event: IpcMainInvokeEvent,
  config: SSHConfig
): Promise<{ success: boolean; error?: string }> {
  const targetPort = config.port || 22

  console.log('[SSH] Connect request:', config.host, ':', targetPort, 'user:', config.username,
    'jump:', config.jumpHost ? `${config.jumpHost.username}@${config.jumpHost.host}` : 'none')
  debugLog(`Connect request: ${config.host}:${targetPort} user:${config.username} session:${config.sessionId}`)

  return new Promise((resolve) => {
    const targetOpts: ConnectConfig = {
      host: config.host,
      port: targetPort,
      username: config.username,
      password: config.password || undefined,
      privateKey: readKey(config.privateKey),
      readyTimeout: 15000
    }

    function onTargetReady(conn: Client, jumpClient?: Client): void {
      debugLog(`onTargetReady called, opening shell...`)
      conn.shell({ term: 'xterm-256color', cols: 80, rows: 24 }, (err, stream) => {
        if (err) {
          debugLog(`shell error: ${err.message}`)
          conn.end()
          jumpClient?.end()
          resolve({ success: false, error: err.message })
          return
        }

        debugLog(`shell opened, session: ${config.sessionId}`)
        sessions.set(config.sessionId, { client: conn, jumpClient, stream })

        const decoder = new StringDecoder('utf8')
        const stderrDecoder = new StringDecoder('utf8')

        stream.on('data', (data: Buffer) => {
          const text = decoder.write(data)
          if (text) event.sender.send(`ssh:output:${config.sessionId}`, text)
        })

        stream.stderr.on('data', (data: Buffer) => {
          const text = stderrDecoder.write(data)
          if (text) event.sender.send(`ssh:output:${config.sessionId}`, text)
        })

        stream.on('close', () => {
          sessions.delete(config.sessionId)
          event.sender.send(`ssh:closed:${config.sessionId}`)
          conn.end()
          jumpClient?.end()
        })

        console.log('[SSH] Connected:', config.sessionId)
        debugLog(`Connected: ${config.sessionId}`)
        resolve({ success: true })
      })
    }

    if (config.jumpHost) {
      // Step 1: connect to jump host
      const jump = config.jumpHost
      const jumpClient = new Client()

      jumpClient.on('error', (err) => {
        console.log('[SSH] Jump host error:', err.message)
        resolve({ success: false, error: `跳板机连接失败: ${err.message}` })
      })

      jumpClient.on('ready', () => {
        console.log('[SSH] Jump host connected, forwarding to target...')
        // Step 2: tunnel through jump host to target
        jumpClient.forwardOut('127.0.0.1', 0, config.host, targetPort, (err, stream) => {
          if (err) {
            jumpClient.end()
            resolve({ success: false, error: `跳板机转发失败: ${err.message}` })
            return
          }

          // Step 3: connect to target through tunnel
          const targetConn = new Client()

          targetConn.on('error', (err) => {
            console.log('[SSH] Target via jump error:', err.message)
            jumpClient.end()
            resolve({ success: false, error: `目标主机连接失败: ${err.message}` })
          })

          targetConn.on('ready', () => {
            onTargetReady(targetConn, jumpClient)
          })

          targetConn.connect({
            sock: stream,
            username: config.username,
            password: config.password || undefined,
            privateKey: readKey(config.privateKey),
            readyTimeout: 15000
          })
        })
      })

      jumpClient.connect({
        host: jump.host,
        port: jump.port || 22,
        username: jump.username,
        password: jump.password || undefined,
        privateKey: readKey(jump.privateKey),
        readyTimeout: 15000
      })
    } else {
      // Direct connection
      const conn = new Client()

      conn.on('error', (err) => {
        console.log('[SSH] Direct connect error:', err.message)
        debugLog(`Direct connect error: ${err.message}`)
        resolve({ success: false, error: err.message })
      })

      conn.on('ready', () => {
        debugLog(`Direct connect ready`)
        onTargetReady(conn)
      })

      conn.connect(targetOpts)
    }
  })
}

export function closeSSHConnection(sessionId: string): void {
  const session = sessions.get(sessionId)
  if (session) {
    try { session.stream.close() } catch { /* ignore */ }
    session.client.end()
    session.jumpClient?.end()
    sessions.delete(sessionId)
    console.log('[SSH] Disconnected:', sessionId)
  }
}

export function sendSSHData(sessionId: string, data: string): void {
  const session = sessions.get(sessionId)
  if (session) {
    session.stream.write(data)
  }
}

export async function forwardPort(
  event: IpcMainInvokeEvent,
  sessionId: string,
  config: ForwardConfig
): Promise<{ success: boolean; forwardId?: string; error?: string }> {
  const session = sessions.get(sessionId)
  if (!session) return { success: false, error: '会话不存在' }

  return new Promise((resolve) => {
    const forwardId = `${sessionId}:${config.localPort}`
    const server = net.createServer((socket) => {
      session.client.forwardOut(
        '127.0.0.1', config.localPort,
        config.remoteHost, config.remotePort,
        (err, stream) => {
          if (err) {
            socket.destroy()
            return
          }
          socket.pipe(stream)
          stream.pipe(socket)
          socket.on('close', () => stream.close())
          stream.on('close', () => socket.destroy())
        }
      )
    })

    server.listen(config.localPort, '127.0.0.1', () => {
      forwards.set(forwardId, { server })
      event.sender.send('port-forward:active', forwardId, config)
      resolve({ success: true, forwardId })
    })

    server.on('error', (err) => {
      resolve({ success: false, error: err.message })
    })
  })
}

export function execCommand(
  sessionId: string,
  command: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const session = sessions.get(sessionId)
    if (!session) {
      reject(new Error('会话不存在'))
      return
    }
    session.client.exec(command, (err, stream) => {
      if (err) {
        reject(err)
        return
      }
      let output = ''
      stream.on('data', (data: Buffer) => {
        output += data.toString()
      })
      stream.stderr.on('data', (data: Buffer) => {
        output += data.toString()
      })
      stream.on('close', () => {
        resolve(output)
      })
    })
  })
}

export function stopForwarding(forwardId: string): void {
  const entry = forwards.get(forwardId)
  if (entry) {
    entry.server.close()
    forwards.delete(forwardId)
  }
}
