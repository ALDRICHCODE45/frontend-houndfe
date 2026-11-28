/**
 * downloadFile.ts — the browser half of an authenticated file download (customers-bulk-actions T1).
 *
 * The bytes always come from the authenticated http client as a Blob (never a bare link, which
 * would carry no token). This module only names and saves them:
 * - the name comes from `Content-Disposition` (`filename*`, quoted, bare), stripped of paths and
 *   reserved characters, with the expected extension forced; otherwise the caller's fallback;
 * - the save goes through a detached anchor whose object URL is revoked shortly after.
 */
const MAX_BASE_NAME_LENGTH = 120
const REVOKE_GRACE_MS = 1_000
const RESERVED_CHARACTERS = '<>:"/\\|?*'

function stripUnsafeCharacters(value: string): string {
  let safe = ''
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0
    if (code <= 0x1f || code === 0x7f || RESERVED_CHARACTERS.includes(character)) continue
    safe += character
  }
  return safe
}

function sanitize(raw: string, fallback: string, extension: string): string {
  const basename = raw.replace(/\\/g, '/').split('/').pop() ?? ''
  const cleaned = stripUnsafeCharacters(basename).replace(/^\.+/, '').trim()
  const withoutExtension = cleaned.toLowerCase().endsWith(extension.toLowerCase())
    ? cleaned.slice(0, -extension.length)
    : cleaned
  const base = withoutExtension.slice(0, MAX_BASE_NAME_LENGTH).replace(/^\.+/, '').replace(/\.+$/, '').trim()
  return base ? `${base}${extension}` : fallback
}

function decode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

/** File name from `Content-Disposition`, sanitized and ending in `extension` (e.g. `.csv`), or the fallback. */
export function parseContentDispositionFileName(
  header: string | null | undefined,
  fallback: string,
  extension: string,
): string {
  if (typeof header !== 'string' || header.trim() === '') return fallback

  const encoded = /filename\*\s*=\s*([^;]+)/i.exec(header)?.[1]
  if (encoded) {
    const segments = encoded.trim().split("'")
    const value = segments.length >= 3 ? segments.slice(2).join("'") : encoded.trim()
    return sanitize(decode(value), fallback, extension)
  }
  const quoted = /filename\s*=\s*"([^"]*)"/i.exec(header)?.[1]
  if (quoted !== undefined) return sanitize(quoted, fallback, extension)
  const bare = /filename\s*=\s*([^;]+)/i.exec(header)?.[1]
  if (bare) return sanitize(bare.trim(), fallback, extension)
  return fallback
}

/** Save the bytes through a hidden, detached anchor; the object URL is revoked shortly after. */
export function saveBlobAsFile(blob: Blob, fileName: string): void {
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = fileName
  anchor.rel = 'noopener'
  anchor.style.display = 'none'
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(objectUrl), REVOKE_GRACE_MS)
}
