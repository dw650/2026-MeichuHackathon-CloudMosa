import { Shell } from '@/components/Shell/Shell'

// Placeholder screen until routing (T21) and i18n (T17) land.
export default function App() {
  return (
    <Shell title="AgriPrice" softKeys={{ left: 'Menu', center: 'OK', right: 'Exit' }}>
      <p style={{ padding: 'var(--gut)' }}>AgriPrice</p>
    </Shell>
  )
}
