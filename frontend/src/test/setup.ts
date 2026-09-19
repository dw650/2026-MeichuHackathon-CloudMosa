import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Initialise i18next so components using useTranslation() render real strings.
import '@/i18n'

afterEach(() => {
  cleanup()
})
