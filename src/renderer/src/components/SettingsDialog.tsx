import React, { useState, useEffect } from 'react'
import { themes, ThemeColors, applyTheme } from '../themes'

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
  onApply: (themeName: string, colors: ThemeColors) => void
  onClose: () => void
}

export default function SettingsDialog({ currentTheme, onApply, onClose }: Props): JSX.Element {
  const [selected, setSelected] = useState(currentTheme)
  const [copyOnSelect, setCopyOnSelect] = useState(true)
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
    if (t) onApply(selected, t.colors)

    // Save AI config and terminal settings alongside theme
    window.api.settings.load().then((settings: any) => {
      window.api.settings.save({
        ...settings,
        theme: selected,
        copyOnSelect,
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
