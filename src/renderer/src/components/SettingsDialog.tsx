import React, { useState, useEffect } from 'react'
import { themes, ThemeColors, applyTheme } from '../themes'

const FONT_PRESETS: { label: string; value: string }[] = [
  { label: '系统默认 (Menlo)', value: 'Menlo, Monaco, "Courier New", monospace' },
  { label: 'SF Mono', value: '"SF Mono", Menlo, monospace' },
  { label: 'Menlo', value: 'Menlo, monospace' },
  { label: 'Monaco', value: 'Monaco, Menlo, monospace' },
  { label: 'JetBrains Mono', value: '"JetBrains Mono", Menlo, monospace' },
  { label: 'Fira Code', value: '"Fira Code", Menlo, monospace' },
  { label: 'Source Code Pro', value: '"Source Code Pro", Menlo, monospace' },
  { label: 'Courier New', value: '"Courier New", monospace' },
  { label: '自定义…', value: '__custom__' }
]

const CUSTOM_VALUE = '__custom__'

const SCROLLBACK_PRESETS: { label: string; value: number }[] = [
  { label: '1,000 行（默认）', value: 1000 },
  { label: '10,000 行', value: 10000 },
  { label: '100,000 行', value: 100000 },
  { label: '500,000 行', value: 500000 }
]

const AI_PRESETS: Record<string, { apiUrl: string; model: string }> = {
  'OpenAI': { apiUrl: 'https://api.openai.com', model: 'gpt-4o' },
  'DeepSeek': { apiUrl: 'https://api.deepseek.com', model: 'deepseek-chat' },
  '通义千问': { apiUrl: 'https://dashscope.aliyuncs.com/compatible-mode', model: 'qwen-plus' },
  'Kimi': { apiUrl: 'https://api.moonshot.cn', model: 'moonshot-v1-8k' },
  '智谱': { apiUrl: 'https://open.bigmodel.cn/api/paas', model: 'glm-4-flash' },
  'Ollama': { apiUrl: 'http://localhost:11434', model: 'llama3' },
  '自定义': { apiUrl: '', model: '' }
}

interface AIConfig {
  provider: string
  apiUrl: string
  apiKey: string
  model: string
}

interface Props {
  currentTheme: string
  onApply: (
    themeName: string,
    colors: ThemeColors,
    terminal: { fontFamily: string; fontSize: number; scrollback: number }
  ) => void
  onClose: () => void
}

export default function SettingsDialog({ currentTheme, onApply, onClose }: Props): JSX.Element {
  const [selected, setSelected] = useState(currentTheme)
  const [copyOnSelect, setCopyOnSelect] = useState(true)
  const [fontFamily, setFontFamily] = useState('')
  const [fontSize, setFontSize] = useState(14)
  const [scrollback, setScrollback] = useState(1000)
  const [aiConfig, setAiConfig] = useState<AIConfig>({
    provider: '',
    apiUrl: '',
    apiKey: '',
    model: ''
  })
  const [aiLoaded, setAiLoaded] = useState(false)

  useEffect(() => {
    window.api.settings.load().then((settings: any) => {
      if (settings?.ai) {
        setAiConfig(settings.ai)
      }
      setCopyOnSelect(settings?.copyOnSelect !== false)
      setFontFamily(settings?.fontFamily || '')
      setFontSize(settings?.fontSize ?? 14)
      setScrollback(settings?.scrollback ?? 1000)
      setAiLoaded(true)
    })
  }, [])

  function handleSelect(name: string): void {
    setSelected(name)
    const t = themes.find((th) => th.name === name)
    if (t) applyTheme(t.colors)
  }

  function handleProviderChange(provider: string): void {
    const preset = AI_PRESETS[provider]
    if (preset) {
      setAiConfig((prev) => ({
        ...prev,
        provider,
        apiUrl: preset.apiUrl || prev.apiUrl,
        model: preset.model || prev.model
      }))
    }
  }

  function handleConfirm(): void {
    const t = themes.find((th) => th.name === selected)
    const finalFont = fontFamily.trim() || FONT_PRESETS[0].value
    if (t) onApply(selected, t.colors, { fontFamily: finalFont, fontSize, scrollback })

    // Save AI config and terminal settings alongside theme
    window.api.settings.load().then((settings: any) => {
      window.api.settings.save({
        ...settings,
        theme: selected,
        copyOnSelect,
        fontFamily: finalFont,
        fontSize,
        scrollback,
        ai: aiConfig
      })
    })

    onClose()
  }

  function handleCancel(): void {
    // Revert to original theme
    const t = themes.find((th) => th.name === currentTheme)
    if (t) applyTheme(t.colors)
    onClose()
  }

  return (
    <div className="dialog-overlay" onClick={handleCancel}>
      <div className="dialog settings-dialog" onClick={(e) => e.stopPropagation()}>
        <h2>设置</h2>
        <div className="settings-section">
          <h3>主题颜色</h3>
          <div className="theme-list">
            {themes.map((t) => (
              <div
                key={t.name}
                className={`theme-card ${selected === t.name ? 'active' : ''}`}
                onClick={() => handleSelect(t.name)}
              >
                <div className="theme-preview">
                  <div className="tp-sidebar" style={{ background: t.colors.bgSidebar }} />
                  <div className="tp-main" style={{ background: t.colors.bg }}>
                    <div className="tp-tab" style={{ background: t.colors.bgPanel }} />
                    <div className="tp-term" style={{ background: t.colors.termBg }}>
                      <div className="tp-line" style={{ background: t.colors.termFg, opacity: 0.7 }} />
                      <div className="tp-line tp-short" style={{ background: t.colors.accent }} />
                      <div className="tp-line" style={{ background: t.colors.termFg, opacity: 0.4 }} />
                    </div>
                  </div>
                </div>
                <span className="theme-name">{t.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="settings-section">
          <h3>终端</h3>
          <div className="form-row">
            <label>
              <input
                type="checkbox"
                checked={copyOnSelect}
                onChange={(e) => setCopyOnSelect(e.target.checked)}
              />
              {' '}选中即复制
            </label>
          </div>
          <p className="settings-hint">松开鼠标后自动将选中的文本复制到剪贴板</p>
          <div className="form-row">
            <label>回滚行数</label>
            <select
              className="font-select"
              value={scrollback}
              onChange={(e) => setScrollback(Number(e.target.value))}
              style={{
                flex: 1,
                background: 'var(--bg-input)',
                border: '1px solid var(--border-light)',
                borderRadius: '3px',
                color: 'var(--fg)',
                padding: '5px 8px',
                fontSize: '12px',
                outline: 'none'
              }}
            >
              {SCROLLBACK_PRESETS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
          <p className="settings-hint">终端向上可回看的最大行数。xterm 按「显示行」计数，长日志换行会成倍占用，行数越大内存越多。</p>
          {scrollback >= 100000 && (
            <p className="settings-warn">
              ⚠️ 已选 {scrollback.toLocaleString()} 行，预计占用内存约 {Math.round(scrollback / 1000)} MB 以上。
              超大日志建议改用 <code>less</code> 或重定向到文件。
            </p>
          )}
        </div>

        <div className="settings-section">
          <h3>终端字体</h3>
          <div className="form-row">
            <label>字体</label>
            <select
              className="font-select"
              value={FONT_PRESETS.some((p) => p.value === fontFamily) ? fontFamily : CUSTOM_VALUE}
              onChange={(e) => {
                const v = e.target.value
                setFontFamily(v === CUSTOM_VALUE ? '' : v)
              }}
              style={{
                flex: 1,
                background: 'var(--bg-input)',
                border: '1px solid var(--border-light)',
                borderRadius: '3px',
                color: 'var(--fg)',
                padding: '5px 8px',
                fontSize: '12px',
                outline: 'none'
              }}
            >
              {FONT_PRESETS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
          {!FONT_PRESETS.some((p) => p.value === fontFamily) && (
            <div className="form-row">
              <label>自定义字体</label>
              <input
                type="text"
                value={fontFamily}
                onChange={(e) => setFontFamily(e.target.value)}
                placeholder={'Menlo, Monaco, "Courier New", monospace'}
              />
            </div>
          )}
          <div className="form-row">
            <label>字号</label>
            <div className="font-size-row">
              <input
                type="number"
                min={10}
                max={28}
                value={fontSize}
                onChange={(e) => setFontSize(Math.max(10, Math.min(28, Number(e.target.value) || 14)))}
              />
              <span className="font-size-unit">px</span>
              <button className="font-size-btn" onClick={() => setFontSize((s) => Math.max(10, s - 1))}>A−</button>
              <button className="font-size-btn" onClick={() => setFontSize((s) => Math.min(28, s + 1))}>A+</button>
              <button
                className="font-size-btn font-size-reset"
                onClick={() => { setFontFamily(''); setFontSize(14) }}
              >
                重置
              </button>
            </div>
          </div>
          <div
            className="font-preview"
            style={{ fontFamily: fontFamily.trim() || FONT_PRESETS[0].value, fontSize: `${fontSize}px` }}
          >
            <span className="font-preview-label">预览</span>
            abcdefg ABC 0123 终端字体预览
          </div>
        </div>

        {aiLoaded && (
          <div className="settings-section">
            <h3>AI 助手</h3>
            <div className="form-row">
              <label>服务商</label>
              <select
                value={aiConfig.provider}
                onChange={(e) => handleProviderChange(e.target.value)}
                style={{
                  flex: 1,
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-light)',
                  borderRadius: '3px',
                  color: 'var(--fg)',
                  padding: '5px 8px',
                  fontSize: '12px',
                  outline: 'none'
                }}
              >
                <option value="">请选择...</option>
                {Object.keys(AI_PRESETS).map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <label>API 地址</label>
              <input
                type="text"
                value={aiConfig.apiUrl}
                onChange={(e) => setAiConfig((prev) => ({ ...prev, apiUrl: e.target.value }))}
                placeholder="https://api.openai.com"
              />
            </div>
            <div className="form-row">
              <label>API Key</label>
              <input
                type="password"
                value={aiConfig.apiKey}
                onChange={(e) => setAiConfig((prev) => ({ ...prev, apiKey: e.target.value }))}
                placeholder="sk-..."
              />
            </div>
            <div className="form-row">
              <label>模型名称</label>
              <input
                type="text"
                value={aiConfig.model}
                onChange={(e) => setAiConfig((prev) => ({ ...prev, model: e.target.value }))}
                placeholder="gpt-4o"
              />
            </div>
          </div>
        )}

        <div className="dialog-actions">
          <button onClick={handleCancel}>取消</button>
          <button onClick={handleConfirm}>确认</button>
        </div>
      </div>
    </div>
  )
}
