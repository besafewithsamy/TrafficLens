import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../hooks/theme'

/**
 * Visible dark/light theme switch, mounted in the Layout.
 * Uses the single existing theme system (useTheme — localStorage +
 * prefers-color-scheme + pre-paint script); no separate implementation.
 */
export function ThemeToggle() {
  const { theme, toggle } = useTheme()
  const isDark = theme === 'dark'
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      aria-pressed={isDark}
      title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
    >
      {isDark ? <Sun size={16} aria-hidden /> : <Moon size={16} aria-hidden />}
    </button>
  )
}
