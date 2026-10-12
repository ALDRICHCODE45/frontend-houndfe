/**
 * Playwright entrypoint for the isolated cash-live HTTP/browser journey.
 *
 * This root config does nothing but wire `process.env` through the pure
 * builder. The builder validates the fail-closed opt-in/backend/fixture
 * contract at load time, so a rejected environment throws before Playwright
 * can start the frontend webServer, launch a browser or run a journey.
 *
 * The backend is never started here and no global hooks are registered.
 */
import { buildCashLiveConfig } from './e2e/cash-live/support/config'

export default buildCashLiveConfig(process.env)
