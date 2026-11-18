/**
 * Playwright entrypoint for the isolated editorial-live journey (admin/global editorial, T12).
 * Wires `process.env` through the pure builder, which validates the fail-closed opt-in/backend/
 * fixture contract at load time. The backend is never started here.
 */
import { buildEditorialLiveConfig } from './e2e/editorial-live/support/config'

export default buildEditorialLiveConfig(process.env)
