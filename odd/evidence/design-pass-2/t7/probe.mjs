// T7: read the notification config and assignable users (names only, no ids).
import { call, login } from '../t4/lib.mjs'
const who = process.argv[2] ?? 'manager'
const { token } = await login(`${who}@houndfe.com`, who)
try {
  const cfg = await call('GET', '/notification-config', token)
  console.log('config', JSON.stringify({ enabled: cfg.enabled, recipients: cfg.recipients.length, enabledActions: cfg.enabledActions }))
} catch (e) { console.log('config', e.message.slice(0, 120)) }
try {
  const users = await call('GET', '/users/assignable', token)
  const list = Array.isArray(users) ? users : users.items
  console.log('assignable', list.length, list.map((u) => u.name ?? u.displayName ?? Object.keys(u).join('/')).join(', '))
} catch (e) { console.log('assignable', e.message.slice(0, 120)) }
