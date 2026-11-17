import { chromium } from '@playwright/test'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
const HERE = dirname(fileURLToPath(import.meta.url))
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 540, height: 1000 } })
await p.setContent(`<body style="margin:0;font-family:sans-serif;background:#f4f7fb"><div style="padding:36px 32px">
<div style="background:#1a73e8;color:#fff;padding:20px;border-radius:14px 14px 0 0;font-size:26px;font-weight:700">Transferencia exitosa</div>
<div style="background:#fff;padding:24px;border-radius:0 0 14px 14px;font-size:20px;line-height:1.7">
<div style="font-size:44px;font-weight:800;margin:8px 0">$1,840.00 MXN</div>
<div>Fecha: 11 nov 2026, 14:32</div><div>Clave de rastreo:</div><div style="font-weight:700">MBAN01002611110012345678</div>
<div>Cuenta destino:</div><div style="font-weight:700">**** 5678 · HoundFe Centro</div>
<div>Concepto: Pago venta V-1042</div><div>Referencia: 9988776</div>
<div style="margin-top:20px;font-size:13px;color:#667">Texto pequeño para comprobar legibilidad al ampliar: Banco emisor SPEI, comisión $0.00, IVA $0.00.</div></div></div></body>`)
await p.screenshot({ path: join(HERE, 'receipt.jpg'), type: 'jpeg', quality: 90 }); await b.close()
