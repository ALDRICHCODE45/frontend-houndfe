// Feature-local policy, independent of CASL. Callers must also require a ready,
// authenticated identity and selected tenant, or an explicit global claim in global
// mode. manage:all is tenant-local and never permits null tenant by itself.
// isSuperAdmin is the access-token claim from authStore, never a profile property.
export function canReadEditorial(codes: readonly string[], isSuperAdmin = false): boolean {
  return isSuperAdmin || codes.includes('manage:all') || codes.includes('read:ProductEditorialDraft')
}

export function canPublishEditorial(codes: readonly string[], isSuperAdmin = false): boolean {
  return isSuperAdmin || codes.includes('manage:all') ||
    (canReadEditorial(codes) && codes.includes('publish:ProductEditorialDraft'))
}

export function canWriteEditorial(codes: readonly string[], isSuperAdmin = false): boolean {
  return isSuperAdmin || codes.includes('manage:all') ||
    (canReadEditorial(codes) && codes.includes('update:ProductEditorialDraft'))
}
