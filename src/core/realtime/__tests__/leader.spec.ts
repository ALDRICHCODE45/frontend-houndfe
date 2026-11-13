import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createLeaderElection, type ChannelLike } from '../leader'
import { createChannelHub, createLockRegistry, flush } from './helpers'

function track() {
  const log: boolean[] = []
  return { log, onChange: (v: boolean) => log.push(v), get leader() { return log[log.length - 1] === true } }
}

describe('leader election', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Web Locks', () => {
    it('the first tab leads, the second follows, and the lock name carries user and tenant', async () => {
      const reg = createLockRegistry()
      const a = track()
      const b = track()
      const ea = createLeaderElection({ name: 'realtime:u1:t1', locks: reg.tab().facade, createChannel: null, onChange: a.onChange })
      const eb = createLeaderElection({ name: 'realtime:u1:t1', locks: reg.tab().facade, createChannel: null, onChange: b.onChange })
      ea.start()
      await flush()
      eb.start()
      await flush()
      expect(a.leader).toBe(true)
      expect(b.leader).toBe(false)
      expect([...reg.held.keys()]).toEqual(['realtime:u1:t1'])
    })

    it('different user+tenant keys do not compete', async () => {
      const reg = createLockRegistry()
      const a = track()
      const b = track()
      createLeaderElection({ name: 'realtime:u1:t1', locks: reg.tab().facade, createChannel: null, onChange: a.onChange }).start()
      createLeaderElection({ name: 'realtime:u1:t2', locks: reg.tab().facade, createChannel: null, onChange: b.onChange }).start()
      await flush()
      expect(a.leader).toBe(true)
      expect(b.leader).toBe(true)
    })

    it('hands over to the waiting tab when the leader tab closes', async () => {
      const reg = createLockRegistry()
      const ta = reg.tab()
      const a = track()
      const b = track()
      createLeaderElection({ name: 'k', locks: ta.facade, createChannel: null, onChange: a.onChange }).start()
      await flush()
      createLeaderElection({ name: 'k', locks: reg.tab().facade, createChannel: null, onChange: b.onChange }).start()
      await flush()
      expect(b.leader).toBe(false)
      ta.close()
      await flush()
      expect(b.leader).toBe(true)
    })

    it('stop() on the leader steps down and the next tab takes over', async () => {
      const reg = createLockRegistry()
      const a = track()
      const b = track()
      const ea = createLeaderElection({ name: 'k', locks: reg.tab().facade, createChannel: null, onChange: a.onChange })
      ea.start()
      await flush()
      createLeaderElection({ name: 'k', locks: reg.tab().facade, createChannel: null, onChange: b.onChange }).start()
      await flush()
      ea.stop()
      await flush()
      expect(a.log).toEqual([true, false])
      expect(b.leader).toBe(true)
    })

    it('stop() on a waiting follower withdraws its request (it never becomes leader later)', async () => {
      const reg = createLockRegistry()
      const ta = reg.tab()
      const b = track()
      createLeaderElection({ name: 'k', locks: ta.facade, createChannel: null, onChange: () => {} }).start()
      await flush()
      const eb = createLeaderElection({ name: 'k', locks: reg.tab().facade, createChannel: null, onChange: b.onChange })
      eb.start()
      await flush()
      eb.stop()
      ta.close()
      await flush()
      expect(b.log).not.toContain(true)
    })
  })

  describe('BroadcastChannel fallback', () => {
    function tab(hub: ReturnType<typeof createChannelHub>, id: string, t = track()) {
      const mine: ChannelLike[] = []
      const election = createLeaderElection({
        name: 'realtime:u1:t1',
        locks: null,
        createChannel: (name: string) => {
          const ch = hub.create(name)
          mine.push(ch)
          return ch
        },
        onChange: t.onChange,
        makeId: () => id,
      })
      /** The tab dies without any goodbye: its channel just stops delivering. */
      const crash = () => mine.forEach((ch) => ch.close())
      return { election, t, crash }
    }

    it('a lone tab becomes leader after the election window', async () => {
      const hub = createChannelHub()
      const a = tab(hub, 'a')
      a.election.start()
      await advance(299)
      expect(a.t.leader).toBe(false)
      await advance(1)
      expect(a.t.leader).toBe(true)
    })

    it('a tab that joins a live leader stays follower', async () => {
      const hub = createChannelHub()
      const a = tab(hub, 'a')
      a.election.start()
      await advance(400)
      const b = tab(hub, 'b')
      b.election.start()
      await advance(2_000)
      expect(a.t.leader).toBe(true)
      expect(b.t.leader).toBe(false)
    })

    it('two tabs starting together elect exactly one leader (lowest id)', async () => {
      const hub = createChannelHub()
      const a = tab(hub, 'a')
      const b = tab(hub, 'b')
      a.election.start()
      b.election.start()
      await advance(1_000)
      expect([a.t.leader, b.t.leader].filter(Boolean)).toHaveLength(1)
      expect(a.t.leader).toBe(true)
    })

    it('hands over at once when the leader says goodbye (stop)', async () => {
      const hub = createChannelHub()
      const a = tab(hub, 'a')
      const b = tab(hub, 'b')
      a.election.start()
      await advance(400)
      b.election.start()
      await advance(1_000)
      a.election.stop()
      await advance(300)
      expect(a.t.log).toEqual([true, false])
      expect(b.t.leader).toBe(true)
    })

    it('takes over after the leader goes silent (crashed tab, no goodbye)', async () => {
      const hub = createChannelHub()
      const a = tab(hub, 'a')
      const b = tab(hub, 'b')
      a.election.start()
      await advance(400)
      b.election.start()
      await advance(1_000)
      a.crash()
      await advance(3_000)
      expect(b.t.leader).toBe(false)
      await advance(3_000)
      expect(b.t.leader).toBe(true)
    })

    it('a late joiner with a lower id defers to the live leader', async () => {
      const hub = createChannelHub()
      const a = tab(hub, 'a')
      const b = tab(hub, 'b')
      b.election.start()
      await advance(400)
      a.election.start()
      await advance(3_000)
      expect(b.t.leader).toBe(true)
      expect(a.t.leader).toBe(false)
    })

    it('a leader that sees a lower-id leader steps down (split brain heals)', async () => {
      const hub = createChannelHub()
      const a = tab(hub, 'a')
      const b = tab(hub, 'b')
      hub.partitioned = true
      a.election.start()
      b.election.start()
      await advance(400)
      expect(a.t.leader).toBe(true)
      expect(b.t.leader).toBe(true)
      hub.partitioned = false
      await advance(2_500)
      expect(a.t.leader).toBe(true)
      expect(b.t.leader).toBe(false)
    })
  })

  it('with neither Web Locks nor BroadcastChannel the tab leads on its own', async () => {
    const t = track()
    createLeaderElection({ name: 'k', locks: null, createChannel: null, onChange: t.onChange }).start()
    await flush()
    expect(t.leader).toBe(true)
  })
})


async function advance(ms: number) {
  await vi.advanceTimersByTimeAsync(ms)
}
