import { API, login } from './api.mjs'
const { token } = await login('admin@houndfe.com', 'superAdmin')
const res = await fetch(`${API}/catalog-editorial/vocabulary`, { headers: { authorization: `Bearer ${token}` } })
console.log(res.status, [...res.headers].filter(([k]) => /editorial/i.test(k)))
const j = await res.json(); console.log(Object.keys(j), Object.keys(j.data ?? {}).slice(0, 10))
