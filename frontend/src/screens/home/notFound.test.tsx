import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { waitFor } from '@testing-library/react'

import { server } from '@/test/msw/server'
import { renderApp } from '@/test/renderApp'

describe('home when my area no longer exists', () => {
  it('goes to the area list so another area can be chosen (docs/04 §6.1)', async () => {
    server.use(
      http.get('*/api/v1/prices', () =>
        HttpResponse.json(
          { error: { code: 'area_not_found', message: 'gone', request_id: 'r' } },
          { status: 404 },
        ),
      ),
    )
    const app = await renderApp('/')
    await waitFor(() => expect(app.path()).toBe('/areas?for=home'))
  })
})
