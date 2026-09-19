import { setupServer } from 'msw/node'

import { handlers } from './handlers'

/** Shared msw server for unit tests; started in src/test/setup.ts. */
export const server = setupServer(...handlers)
