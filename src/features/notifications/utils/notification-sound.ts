/**
 * A short two-note chime made with the Web Audio API (no asset to ship). Browsers may refuse to
 * start audio before the user has interacted with the page; that is not an error worth surfacing.
 */
export function playNotificationSound(): void {
  try {
    // SAFETY: Safari < 14.1 exposes the constructor only as `webkitAudioContext`; it has the same
    // shape as `AudioContext`, which is all this function uses.
    const legacy = window as unknown as { webkitAudioContext?: typeof AudioContext }
    const Context = window.AudioContext ?? legacy.webkitAudioContext
    if (!Context) return
    const context = new Context()
    const start = context.currentTime
    const notes: [number, number][] = [
      [880, 0],
      [1175, 0.14],
    ]
    for (const [frequency, offset] of notes) {
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = 'sine'
      oscillator.frequency.value = frequency
      gain.gain.setValueAtTime(0.0001, start + offset)
      gain.gain.exponentialRampToValueAtTime(0.15, start + offset + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.16)
      oscillator.connect(gain).connect(context.destination)
      oscillator.start(start + offset)
      oscillator.stop(start + offset + 0.18)
    }
    window.setTimeout(() => void context.close().catch(() => {}), 600)
  } catch {
    // Audio is a nicety: stay silent.
  }
}
