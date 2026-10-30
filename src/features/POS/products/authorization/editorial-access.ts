// Feature-local policy, independent of CASL. Callers must also require a ready,
// authenticated identity and a concrete selected tenant; manage:all is tenant-local.
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
