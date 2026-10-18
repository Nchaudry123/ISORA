import { flushSync } from 'react-dom'
import { useStore } from '../store/useStore.js'
import { applyAccent } from '../lib/accent.js'
import { t } from '../lib/i18n.js'
import Icon from './Icon.jsx'

// One tap between dark and light. Where the browser can (View Transitions), the new theme opens
// as a circle from the button itself; with reduced motion, or without the API, it simply switches.
// The new theme is written onto <html> inside the transition so the "after" snapshot is already in
// it — App.jsx's own effect then finds nothing left to change.
const resolved = () => document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'

export default function ThemeToggle({ className = 'iconbtn' }) {
  const theme = useStore(s => s.S.theme)
  const accent = useStore(s => s.S.accent)
  const update = useStore(s => s.update)
  const isDark = (theme === 'light' || theme === 'dark' ? theme : resolved()) === 'dark'
  const toggle = e => {
    const next = resolved() === 'dark' ? 'light' : 'dark'
    const apply = () => {
      const de = document.documentElement
      de.dataset.theme = next
      applyAccent(de, accent, next)
      flushSync(() => update(s => { s.theme = next }))
    }
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (!document.startViewTransition || reduce) { apply(); return }
    const r = e.currentTarget.getBoundingClientRect()
    const de = document.documentElement
    de.style.setProperty('--tx', r.left + r.width / 2 + 'px')
    de.style.setProperty('--ty', r.top + r.height / 2 + 'px')
    document.startViewTransition(apply)
  }
  return (
    <button type="button" className={className + ' theme-toggle'} onClick={toggle}
      aria-label={isDark ? t('Switch to light mode') : t('Switch to dark mode')} title={isDark ? t('Switch to light mode') : t('Switch to dark mode')}>
      <span className="tt-icon" key={isDark ? 'sun' : 'moon'}><Icon name={isDark ? 'sun' : 'moon'} /></span>
    </button>
  )
}
