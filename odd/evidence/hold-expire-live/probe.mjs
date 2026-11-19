import { session } from './api.mjs'
const s = await session('manager')
const me = await s.get('/auth/me'); console.log('me', me.status, me.data && JSON.stringify({ name: me.data.name ?? me.data.user?.name, first: me.data.firstName ?? me.data.user?.firstName, last: me.data.lastName ?? me.data.user?.lastName }))
const l = await s.get('/sales?search=000077'); const row = (l.data?.items ?? l.data?.data ?? []).find((x) => /000077/.test(x.folio ?? '')); console.log('row', l.status, row?.id)
const d = await s.get('/sales/' + (row?.id ?? '6e64f7bc-f7a8-48cb-8c5f-8902ef000233'))
console.log('detail', d.status, JSON.stringify({ folio: d.data?.folio, status: d.data?.status, paymentStatus: d.data?.paymentStatus, hold: d.data?.hold, cancelReason: d.data?.cancelReason, canceledBy: d.data?.canceledBy }))
