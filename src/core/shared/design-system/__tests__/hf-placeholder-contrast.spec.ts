import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const adapter = readFileSync('src/core/shared/design-system/houndfe-ui.css', 'utf8')
const requestDetail = readFileSync('src/features/chatbot/requests/styles/chatbot-request-detail.css', 'utf8')
const actionPanel = readFileSync('src/features/chatbot/requests/components/RequestDetailActionPanel.vue', 'utf8')

describe('placeholders read in --hf-muted on every screen', () => {
  // hf-form.css only loads with the Hf form components; the global adapter always loads.
  it('covers text fields, select placeholders and empty date segments in the global adapter', () => {
    expect(adapter).toMatch(
      /\.hf-ui :is\(input, textarea\)::placeholder,\s*\.hf-ui \[data-slot='placeholder'\],\s*\.hf-ui \[data-slot='segment'\]\[data-placeholder\]\s*\{\s*color: var\(--hf-muted\);\s*opacity: 1;/,
    )
  })
})

describe('request detail bar: «Más acciones» uses the app focus ring', () => {
  it('marks the button and paints the 2px --hf-focus ring', () => {
    expect(actionPanel).toMatch(/data-testid="bar-more"[\s\S]{0,200}class="rd-bar__more"/)
    expect(requestDetail).toMatch(
      /\.chatbot-request-detail \.rd-bar__more:focus-visible\s*\{\s*outline: 2px solid var\(--hf-focus\);\s*outline-offset: 2px;/,
    )
  })
})
