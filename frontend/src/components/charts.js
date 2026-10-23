import { useTheme } from '../context/ThemeContext'

/** Axis, grid and tooltip colours that work in light and dark mode. */
export function useChartColors() {
  const { dark } = useTheme()
  return dark
    ? {
        text: '#94a3b8',
        grid: '#1e293b',
        cursor: 'rgba(148,163,184,0.08)',
        tooltip: { background: '#0f172a', border: '1px solid #334155', borderRadius: 12, color: '#e2e8f0' },
      }
    : {
        text: '#64748b',
        grid: '#e2e8f0',
        cursor: 'rgba(100,116,139,0.08)',
        tooltip: { background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12, color: '#0f172a' },
      }
}

/** Categorical colours for multiple series (orange first, matching the brand). */
export const SERIES = ['#c2410c', '#0ea5e9', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#64748b', '#14b8a6']
