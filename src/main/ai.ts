import { execCommand } from './ssh'

export interface AIConfig {
  provider: string
  apiUrl: string
  apiKey: string
  model: string
}

export const AI_PRESETS: Record<string, { apiUrl: string; model: string }> = {
  'OpenAI': { apiUrl: 'https://api.openai.com', model: 'gpt-4o' },
  'DeepSeek': { apiUrl: 'https://api.deepseek.com', model: 'deepseek-chat' },
  '通义千问': { apiUrl: 'https://dashscope.aliyuncs.com/compatible-mode', model: 'qwen-plus' },
  'Kimi': { apiUrl: 'https://api.moonshot.cn', model: 'moonshot-v1-8k' },
  '智谱': { apiUrl: 'https://open.bigmodel.cn/api/paas', model: 'glm-4-flash' },
  'Ollama': { apiUrl: 'http://localhost:11434', model: 'llama3' },
  '自定义': { apiUrl: '', model: '' }
}

// Cache system info per session
const systemInfoCache = new Map<string, string>()

export async function collectSystemInfo(sessionId: string): Promise<string> {
  const cached = systemInfoCache.get(sessionId)
  if (cached) return cached

  const commands = [
    'uname -a',
    'cat /etc/os-release 2>/dev/null || echo "unknown"',
    'whoami'
  ]

  let info = ''
  for (const cmd of commands) {
    try {
      const result = await execCommand(sessionId, cmd)
      info += result.trim() + '\n'
    } catch {
      info += '(unavailable)\n'
    }
  }

  const trimmed = info.trim()
  systemInfoCache.set(sessionId, trimmed)
  return trimmed
}

export function clearSystemInfoCache(sessionId: string): void {
  systemInfoCache.delete(sessionId)
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

async function chatWithAI(
  messages: ChatMessage[],
  config: AIConfig
): Promise<string> {
  const base = config.apiUrl.replace(/\/+$/, '')
  // Avoid duplicating path if user already included /v1 or full endpoint
  let url: string
  if (base.endsWith('/chat/completions')) {
    url = base
  } else if (base.endsWith('/v1')) {
    url = base + '/chat/completions'
  } else {
    url = base + '/v1/chat/completions'
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }
  if (config.apiKey) {
    headers['Authorization'] = `Bearer ${config.apiKey}`
  }

  const resp = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature: 0
    })
  })

  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`API 请求失败 (${resp.status}): ${text}`)
  }

  const data = await resp.json()
  return data.choices?.[0]?.message?.content ?? ''
}

export interface AIResult {
  type: 'command' | 'ai' | 'error'
  cmd?: string
  explain?: string
  error?: string
}

export async function classifyAndProcess(
  sessionId: string,
  input: string,
  config: AIConfig
): Promise<AIResult> {
  try {
    const systemInfo = await collectSystemInfo(sessionId)

    const systemPrompt = `你是一个 Linux 运维命令生成器。当前主机信息：
${systemInfo}

只输出 JSON，格式：
- {"type":"command","cmd":"<命令>"} —— 用户输入本身就是 shell 命令
- {"type":"ai","cmd":"<命令>","explain":"<说明>"} —— 根据描述生成命令
- {"type":"error","error":"<原因>"} —— 无法用命令完成

禁止输出 JSON 以外的任何内容。`

    const examples: ChatMessage[] = [
      { role: 'user', content: 'docker images' },
      { role: 'assistant', content: '{"type":"command","cmd":"docker images"}' },
      { role: 'user', content: '查看当前运行的容器' },
      { role: 'assistant', content: '{"type":"ai","cmd":"docker ps","explain":"列出正在运行的容器"}' },
      { role: 'user', content: '检查磁盘使用情况' },
      { role: 'assistant', content: '{"type":"ai","cmd":"df -h","explain":"查看各挂载点磁盘占用"}' },
      { role: 'user', content: '帮我写个排序算法' },
      { role: 'assistant', content: '{"type":"error","error":"无法通过 shell 命令完成该请求"}' },
    ]

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...examples,
      { role: 'user', content: input }
    ]

    let reply = await chatWithAI(messages, config)

    // If no JSON found, retry once with a nudge
    if (!reply.match(/\{[\s\S]*\}/)) {
      const retryMessages: ChatMessage[] = [
        ...messages,
        { role: 'assistant', content: reply },
        { role: 'user', content: '请只输出 JSON 对象，不要任何其他内容。' }
      ]
      reply = await chatWithAI(retryMessages, config)
    }

    // Extract JSON from reply (handle possible markdown wrapping)
    const jsonMatch = reply.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return { type: 'error', error: 'AI 返回了无效格式，请重试或换用其他模型' }
    }

    const parsed = JSON.parse(jsonMatch[0])
    return {
      type: parsed.type || 'ai',
      cmd: parsed.cmd,
      explain: parsed.explain,
      error: parsed.error
    }
  } catch (err: any) {
    return { type: 'error', error: err.message || String(err) }
  }
}
