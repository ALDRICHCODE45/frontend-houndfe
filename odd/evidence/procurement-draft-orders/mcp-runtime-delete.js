async (page) => {
  // O3a filename retained for discoverability, NOT a third mutation stage.
  // O3b manager performs the referenced-supplier restriction and draft discard
  // in one context, then proves DELETE 204 / row absence / GET 404.
  // Intentionally no network, file access, or attempt to delete seeded suppliers.
  return {
    stage: 'delete', verdict: 'not an executable verification stage',
    next: 'Execute mcp-runtime-manager.js once; its manager flow includes deletion checks.',
    checks: [], requests: [], outsideScope: [], screenshots: [],
  }
}
