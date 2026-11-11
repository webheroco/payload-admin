// @webheroco/payload-admin. Slow reads and saves, written to the server log.
import type { CollectionAfterOperationHook, CollectionBeforeOperationHook, PayloadRequest } from 'payload'

/**
 * Every collection operation that takes longer than `limit` milliseconds is
 * logged as `cms-timing <collection> <operation> <ms>ms`, so a slow admin
 * screen shows up in the hosting logs (Vercel: search "cms-timing") before
 * the client notices. Payload's own list and edit screens are these
 * operations, so they are covered too.
 */
const starts = new WeakMap<PayloadRequest, Map<string, number[]>>()

export function timingHooks(collection: string, limit: number): {
  beforeOperation: CollectionBeforeOperationHook
  afterOperation: CollectionAfterOperationHook
} {
  return {
    beforeOperation: ({ args, operation, req }) => {
      if (!req) return args
      const byKey = starts.get(req) ?? new Map<string, number[]>()
      starts.set(req, byKey)
      const key = `${collection}:${operation}`
      byKey.set(key, [...(byKey.get(key) ?? []), Date.now()])
      return args
    },
    afterOperation: ({ args, operation, result }) => {
      const req = (args as { req?: PayloadRequest })?.req
      const list = req ? starts.get(req)?.get(`${collection}:${operation}`) : undefined
      const start = list?.pop()
      if (start !== undefined) {
        const ms = Date.now() - start
        if (ms >= limit) req?.payload?.logger?.warn(`cms-timing ${collection} ${operation} ${ms}ms`)
      }
      return result
    },
  }
}
