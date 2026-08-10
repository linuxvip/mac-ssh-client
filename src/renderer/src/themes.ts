export interface ThemeColors {
  // Base
  bg: string
  bgSidebar: string
  bgPanel: string
  bgInput: string
  bgHover: string
  // Text
  fg: string
  fgMuted: string
  fgDim: string
  // Borders
  border: string
  borderLight: string
  // Accent
  accent: string
  accentHover: string
  // Terminal
  termBg: string
  termFg: string
  termCursor: string
  termSelection: string
  // Status
  success: string
  warning: string
  danger: string
}

export interface ThemePreset {
  name: string
  colors: ThemeColors
}

export const themes: ThemePreset[] = [
  {
    name: '深色 (默认)',
    colors: {
      bg: '#1e1e1e',
      bgSidebar: '#252526',
      bgPanel: '#2d2d2d',
      bgInput: '#3c3c3c',
      bgHover: '#2a2d2e',
      fg: '#d4d4d4',
      fgMuted: '#999999',
      fgDim: '#666666',
      border: '#3e3e3e',
      borderLight: '#555555',
      accent: '#0e639c',
      accentHover: '#1177bb',
      termBg: '#1e1e1e',
      termFg: '#d4d4d4',
      termCursor: '#d4d4d4',
      termSelection: 'rgba(255,255,255,0.25)',
      success: '#4caf50',
      warning: '#ff9800',
      danger: '#f44336'
    }
  },
  {
    name: 'Monokai',
    colors: {
      bg: '#272822',
      bgSidebar: '#1e1f1c',
      bgPanel: '#2e2f2a',
      bgInput: '#3e3d32',
      bgHover: '#3e3d32',
      fg: '#f8f8f2',
      fgMuted: '#a6a692',
      fgDim: '#75715e',
      border: '#3e3d32',
      borderLight: '#575848',
      accent: '#a6e22e',
      accentHover: '#b6f23e',
      termBg: '#272822',
      termFg: '#f8f8f2',
      termCursor: '#f8f8f0',
      termSelection: 'rgba(255,255,255,0.2)',
      success: '#a6e22e',
      warning: '#e6db74',
      danger: '#f92672'
    }
  },
  {
    name: 'Dracula',
    colors: {
      bg: '#282a36',
      bgSidebar: '#21222c',
      bgPanel: '#343746',
      bgInput: '#44475a',
      bgHover: '#44475a',
      fg: '#f8f8f2',
      fgMuted: '#bfbfbf',
      fgDim: '#6272a4',
      border: '#44475a',
      borderLight: '#6272a4',
      accent: '#bd93f9',
      accentHover: '#caa4fa',
      termBg: '#282a36',
      termFg: '#f8f8f2',
      termCursor: '#f8f8f2',
      termSelection: 'rgba(255,255,255,0.2)',
      success: '#50fa7b',
      warning: '#f1fa8c',
      danger: '#ff5555'
    }
  },
  {
    name: 'Nord',
    colors: {
      bg: '#2e3440',
      bgSidebar: '#272c36',
      bgPanel: '#3b4252',
      bgInput: '#434c5e',
      bgHover: '#434c5e',
      fg: '#d8dee9',
      fgMuted: '#a0a8b8',
      fgDim: '#616e88',
      border: '#3b4252',
      borderLight: '#4c566a',
      accent: '#88c0d0',
      accentHover: '#8fbcbb',
      termBg: '#2e3440',
      termFg: '#d8dee9',
      termCursor: '#d8dee9',
      termSelection: 'rgba(255,255,255,0.2)',
      success: '#a3be8c',
      warning: '#ebcb8b',
      danger: '#bf616a'
    }
  },
  {
    name: 'Solarized Dark',
    colors: {
      bg: '#002b36',
      bgSidebar: '#00252f',
      bgPanel: '#073642',
      bgInput: '#0a4050',
      bgHover: '#073642',
      fg: '#839496',
      fgMuted: '#657b83',
      fgDim: '#586e75',
      border: '#073642',
      borderLight: '#2a5460',
      accent: '#268bd2',
      accentHover: '#2e9ce8',
      termBg: '#002b36',
      termFg: '#839496',
      termCursor: '#839496',
      termSelection: 'rgba(255,255,255,0.2)',
      success: '#859900',
      warning: '#b58900',
      danger: '#dc322f'
    }
  },
  {
    name: '浅色',
    colors: {
      bg: '#ffffff',
      bgSidebar: '#f3f3f3',
      bgPanel: '#e8e8e8',
      bgInput: '#ffffff',
      bgHover: '#e8e8e8',
      fg: '#333333',
      fgMuted: '#666666',
      fgDim: '#999999',
      border: '#d4d4d4',
      borderLight: '#c0c0c0',
      accent: '#0066b8',
      accentHover: '#0078d4',
      termBg: '#ffffff',
      termFg: '#333333',
      termCursor: '#333333',
      termSelection: '#b4d5ff',
      success: '#388e3c',
      warning: '#f57c00',
      danger: '#d32f2f'
    }
  }
]

export function applyTheme(colors: ThemeColors): void {
  const root = document.documentElement
  root.style.setProperty('--bg', colors.bg)
  root.style.setProperty('--bg-sidebar', colors.bgSidebar)
  root.style.setProperty('--bg-panel', colors.bgPanel)
  root.style.setProperty('--bg-input', colors.bgInput)
  root.style.setProperty('--bg-hover', colors.bgHover)
  root.style.setProperty('--fg', colors.fg)
  root.style.setProperty('--fg-muted', colors.fgMuted)
  root.style.setProperty('--fg-dim', colors.fgDim)
  root.style.setProperty('--border', colors.border)
  root.style.setProperty('--border-light', colors.borderLight)
  root.style.setProperty('--accent', colors.accent)
  root.style.setProperty('--accent-hover', colors.accentHover)
  root.style.setProperty('--term-bg', colors.termBg)
  root.style.setProperty('--term-fg', colors.termFg)
  root.style.setProperty('--term-cursor', colors.termCursor)
  root.style.setProperty('--term-selection', colors.termSelection)
  root.style.setProperty('--success', colors.success)
  root.style.setProperty('--warning', colors.warning)
  root.style.setProperty('--danger', colors.danger)
}
