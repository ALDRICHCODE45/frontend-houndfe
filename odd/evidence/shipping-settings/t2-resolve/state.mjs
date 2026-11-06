#!/usr/bin/env node
// Read-only snapshot of the 06600 validation/zone state (GET only; ids never printed).
import { call, login } from '../../design-pass-2/t4/lib.mjs'
const { token } = await login('manager@houndfe.com', 'manager')
const list = await call('GET', '/delivery-zone-validations', token)
console.log('pending:', list.pagination?.totalCount, list.data.map((v) => `${v.zipCode}:${v.status}:${v.urgency ?? ''}:${v.requesters?.length ?? v.requesterCount ?? '?'}`).join(' '))
const one = await call('GET', '/delivery-zone-validations?zipCode=06600', token)
console.log('?zipCode=06600:', one.data.length, one.pagination?.totalCount)
try { const z = await call('GET', '/delivery-zones/06600', token); console.log('zone 06600:', JSON.stringify({ type: z.type, surchargeCents: z.surchargeCents, etaDays: z.etaDays, isActive: z.isActive, sourceValidation: Boolean(z.sourceValidationId) })) } catch (e) { console.log('zone 06600:', e.message.slice(0, 120)) }
