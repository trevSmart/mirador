/**
 * DataLoader-style coalescing loader. Multiple `load(key)` calls made within the
 * same microtask are grouped into a single `batchFn` invocation, and duplicate
 * keys collapse into one. This is what turns "open N work items at once" into a
 * single `/records/details` request instead of N.
 *
 * It complements TanStack Query's own in-flight dedup (which only coalesces
 * calls sharing the exact same query key): the batch loader coalesces across
 * *different* keys into one network call.
 *
 * @param batchFn - resolves a list of keys into a Map indexed by the string key
 *   (`keyFn(key)`). Missing entries resolve the corresponding load to undefined.
 * @param keyFn - serializes a key for dedup + result lookup (default `String`).
 */
export function createBatchLoader<TKey, TValue>(
  batchFn: (keys: TKey[]) => Promise<Map<string, TValue>>,
  keyFn: (key: TKey) => string = (key) => String(key),
): (key: TKey) => Promise<TValue | undefined> {
  interface Waiter {
    resolve: (value: TValue | undefined) => void
    reject: (error: unknown) => void
  }
  interface Batch {
    keys: Map<string, TKey>
    waiters: Map<string, Waiter[]>
  }

  let current: Batch | null = null

  function schedule(): Batch {
    if (current) {
      return current
    }
    const batch: Batch = { keys: new Map(), waiters: new Map() }
    current = batch
    queueMicrotask(() => {
      current = null
      const keys = [...batch.keys.values()]
      batchFn(keys).then(
        (result) => {
          for (const [stringKey, waiters] of batch.waiters) {
            const value = result.get(stringKey)
            for (const waiter of waiters) {
              waiter.resolve(value)
            }
          }
        },
        (error: unknown) => {
          for (const waiters of batch.waiters.values()) {
            for (const waiter of waiters) {
              waiter.reject(error)
            }
          }
        },
      )
    })
    return batch
  }

  return function load(key: TKey): Promise<TValue | undefined> {
    const stringKey = keyFn(key)
    const batch = schedule()
    if (!batch.keys.has(stringKey)) {
      batch.keys.set(stringKey, key)
    }
    return new Promise<TValue | undefined>((resolve, reject) => {
      const waiters = batch.waiters.get(stringKey) ?? []
      waiters.push({ resolve, reject })
      batch.waiters.set(stringKey, waiters)
    })
  }
}
