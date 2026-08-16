interface Entry {
  count: number
  expiresAt: number
  scope: string
}

/** Lazy-TTL state: no background timer and no resource survives disposal. */
export class InterventionState {
  readonly #entries = new Map<string, Entry>()
  readonly #byScope = new Map<string, Set<string>>()
  readonly #ttlMs: number
  readonly #maximum: number
  readonly #now: () => number

  constructor(ttlMs: number, maximum: number, now: () => number = Date.now) {
    this.#ttlMs = ttlMs
    this.#maximum = maximum
    this.#now = now
  }

  claim(key: string, scope: string): boolean {
    const now = this.#now()
    for (const [candidate, entry] of this.#entries) {
      if (entry.expiresAt <= now) this.release(candidate)
    }
    const prior = this.#entries.get(key)
    if (prior !== undefined && prior.expiresAt > now && prior.count >= this.#maximum) return false
    const entry = prior !== undefined && prior.expiresAt > now
      ? { ...prior, count: prior.count + 1, expiresAt: now + this.#ttlMs }
      : { count: 1, expiresAt: now + this.#ttlMs, scope }
    this.#entries.set(key, entry)
    let keys = this.#byScope.get(scope)
    if (keys === undefined) this.#byScope.set(scope, keys = new Set())
    keys.add(key)
    return true
  }

  release(key: string): void {
    const entry = this.#entries.get(key)
    if (entry === undefined) return
    this.#entries.delete(key)
    const keys = this.#byScope.get(entry.scope)
    keys?.delete(key)
    if (keys?.size === 0) this.#byScope.delete(entry.scope)
  }

  clearScope(scope: string): void {
    const keys = this.#byScope.get(scope)
    if (keys === undefined) return
    for (const key of keys) this.#entries.delete(key)
    this.#byScope.delete(scope)
  }

  clear(): void {
    this.#entries.clear()
    this.#byScope.clear()
  }

  get size(): number {
    return this.#entries.size
  }
}
