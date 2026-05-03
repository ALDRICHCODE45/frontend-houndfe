/**
 * Vitest global setup
 * Ensures localStorage is properly mocked in jsdom environment
 */

// Create a full localStorage implementation
// jsdom's localStorage implementation is incomplete
class LocalStorageMock implements Storage {
  private store: Map<string, string> = new Map()

  get length(): number {
    return this.store.size
  }

  clear(): void {
    this.store.clear()
  }

  getItem(key: string): string | null {
    return this.store.get(key) ?? null
  }

  key(index: number): string | null {
    const keys = Array.from(this.store.keys())
    return keys[index] ?? null
  }

  removeItem(key: string): void {
    this.store.delete(key)
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value)
  }
}

// Replace global localStorage with our complete implementation
if (typeof global !== 'undefined') {
  global.localStorage = new LocalStorageMock()
}

if (typeof window !== 'undefined') {
  window.localStorage = new LocalStorageMock()
}
