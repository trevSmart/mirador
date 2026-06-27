import { describe, expect, it, vi } from 'vitest'
import { createBatchLoader } from './batch-loader'

describe('createBatchLoader', () => {
  it('coalesces concurrent loads into a single batch call', async () => {
    const batchFn = vi.fn(
      async (ids: string[]) => new Map(ids.map((id) => [id, `v:${id}`])),
    )
    const load = createBatchLoader(batchFn)

    const [a, b, c] = await Promise.all([load('1'), load('2'), load('3')])

    expect(batchFn).toHaveBeenCalledTimes(1)
    expect(batchFn).toHaveBeenCalledWith(['1', '2', '3'])
    expect([a, b, c]).toEqual(['v:1', 'v:2', 'v:3'])
  })

  it('collapses duplicate keys within a batch into one entry', async () => {
    const batchFn = vi.fn(
      async (ids: string[]) => new Map(ids.map((id) => [id, id])),
    )
    const load = createBatchLoader(batchFn)

    const [a, b] = await Promise.all([load('x'), load('x')])

    expect(batchFn).toHaveBeenCalledTimes(1)
    expect(batchFn).toHaveBeenCalledWith(['x'])
    expect(a).toBe('x')
    expect(b).toBe('x')
  })

  it('resolves undefined for keys missing from the batch result', async () => {
    const load = createBatchLoader<string, string>(async () => new Map())
    await expect(load('missing')).resolves.toBeUndefined()
  })

  it('opens a fresh batch on a later microtask', async () => {
    const batchFn = vi.fn(
      async (ids: string[]) => new Map(ids.map((id) => [id, id])),
    )
    const load = createBatchLoader(batchFn)

    await load('1')
    await load('2')

    expect(batchFn).toHaveBeenCalledTimes(2)
  })

  it('rejects every waiter when the batch fails', async () => {
    const load = createBatchLoader<string, string>(async () => {
      throw new Error('boom')
    })
    await expect(Promise.all([load('1'), load('2')])).rejects.toThrow('boom')
  })
})
