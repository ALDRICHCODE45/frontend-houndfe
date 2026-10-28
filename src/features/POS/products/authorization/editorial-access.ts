// Intentionally independent of CASL: no wildcard, manage or Product substitution.
export function canReadEditorial(codes: readonly string[]): boolean {
  return codes.includes('read:ProductEditorialDraft')
}

export function canPublishEditorial(codes: readonly string[]): boolean {
  return canReadEditorial(codes) && codes.includes('publish:ProductEditorialDraft')
}

export function canWriteEditorial(codes: readonly string[]): boolean {
  return canReadEditorial(codes) && codes.includes('update:ProductEditorialDraft')
}
