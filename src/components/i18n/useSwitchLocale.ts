// @webheroco/payload-admin. The rules behind it: client-payload references/admin-ui.md.
'use client'

import { useRouteTransition } from '@payloadcms/ui'
import { useRouter } from 'next/navigation'
import { useCallback } from 'react'

/** Reload the current admin screen in another language (?locale=fr), as Payload's own picker does. */
export const useSwitchLocale = () => {
  const router = useRouter()
  const { startRouteTransition } = useRouteTransition()
  return useCallback(
    (code: string) => {
      const params = new URLSearchParams(window.location.search)
      params.set('locale', code)
      startRouteTransition(() => router.push(`${window.location.pathname}?${params.toString()}`))
    },
    [router, startRouteTransition],
  )
}
