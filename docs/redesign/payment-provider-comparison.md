# Pasarela de pago web: comparación para decidir, no selección

**Recomendación condicional:** evaluar primero **Stripe Checkout** por su documentación de recuperación de pagos, expiración, firmas y reembolsos, útil para D25/D29. **Mercado Pago Checkout Pro** es alternativa; **EVO sigue en evaluación**, pendiente de identificar producto y propuesta comercial exactos. No se afirma que uno sea universalmente mejor o más barato.

**Situación confirmada por el usuario:** «no hermano, no tenemos pasarela de pago actualmente, link evo suena bien. pero podemos analizarlo.» No hay pasarela contratada ni cuenta de comercio conocida; Link EVO es candidato, no elección.

## 1. Alcance y evidencia

- Base: [contrato de pago D25–D29](payment-contract-proposal.md) y [descubrimiento de checkout/logística](checkout-logistics-discovery.md); sus decisiones no se reabren aquí.
- Fuentes oficiales enlazadas: lecturas acotadas reportadas por el agente padre, fecha de sesión **2026-10-23**. No se consultaron nuevamente ni garantizan condiciones futuras.
- «Documentado» describe al proveedor, no integración implementada, cuenta aprobada ni pruebas superadas por HoundFe. Las rutas API citadas son del proveedor, no de la aplicación.
- Diseño actual: una empresa comerciante que cobra sus ventas; no se infieren marketplace, cuentas conectadas ni pagos a terceros.
- Preferir checkout alojado por el proveedor, sin manejo directo de PAN de tarjeta en HoundFe. Confirmar igualmente responsabilidades PCI aplicables.

## 2. Qué debe preservar cualquier candidato

| Regla | Consecuencia para evaluar la pasarela |
| --- | --- |
| D25: prepago íntegro | Mercancía y envío confirmado; retorno web o comprobante no confirman cobro ni habilitan despacho. |
| D26: cotización pendiente | Sin cobro ni reserva; resolver exige revisión y aceptación del total actualizado. |
| D27/D28: identidad y restricciones | Correo verificado y autorización vigente; restricción confirmada bloquea, coincidencia dudosa requiere revisión sin cobro. |
| D29: reserva al iniciar pago | Reserva atómica propia; pago confirmado asigna una vez, liberación requiere causa autoritativa compatible. |
| Incertidumbre | Recuperar el mismo intento ante timeout; reconciliar duplicados, desorden y pago tardío sin prometer stock. |

**Dirección inicial indicada por el usuario (D30):** lanzamiento web solo con tarjetas. Transferencias/SPEI y efectivo/OXXO quedan fuera de esa entrega; MSI no se incorpora automáticamente por aceptar tarjeta. Link EVO se considera para una evaluación posterior del chatbot, no como integración decidida. Checkout alojado sigue recomendado, proveedor aún pendiente. Una tarjeta puede requerir autenticación o quedar pendiente: no eliminar reconciliación ni elegir duración de reserva por suponer confirmación inmediata.

## 3. Comparación técnica documentada

| Candidato | Evidencia oficial disponible | Límite para esta decisión |
| --- | --- | --- |
| Stripe Checkout | Expiración manual/temporizada, idempotencia, webhooks firmados con reintentos y reembolsos documentados; detalles abajo. | No reserva stock del comercio ni garantiza elegibilidad, liquidación o recuperación correcta de nuestra integración. |
| Mercado Pago Checkout Pro — Orders | Orden durable, URL de checkout, referencia, idempotencia, expiración y reembolsos documentados. | Confirmar aplicabilidad en cuenta mexicana, firma exacta de notificaciones y recuperación/reintentos del contrato elegido. |
| EVO: producto por precisar | [Guías e-commerce](https://evopayments.mx/guias-integracion-ecomm/) distinguen HostedCheckout, HostedSession y Direct. | No prueban capacidades específicas de Link EVO, API, webhooks, idempotencia, reembolso ni cuenta disponible. |

### Stripe: por qué es el primer candidato técnico

- [Inventario limitado y expiración](https://docs.stripe.com/payments/checkout/managing-limited-inventory): una sesión abierta puede expirar manualmente; `expires_at` admite 30 minutos–24 horas, con 24 horas por defecto, y existe evento de expiración. **No reserva inventario de HoundFe.**
- La vigencia restante de cotización puede ser menor a 30 minutos: coordinar expiración manual, renovación de cotización y política de pago; D34 aprueba objetivo de 15 minutos desde iniciar pago: exige cierre explícito verificado y cotización válida por toda la ventana. No copiar el valor por defecto ni presentar el objetivo como soporte probado.
- [Idempotencia API v1](https://docs.stripe.com/api/idempotent_requests): POST con clave recupera respuesta previa, incluido un 500 tras iniciarse el endpoint; parámetros incompatibles producen error. Las claves pueden depurarse después de al menos 24 horas: se necesita unicidad durable del comercio.
- [Webhooks](https://docs.stripe.com/webhooks): verificar cuerpo sin transformar y `Stripe-Signature`; reintentos en producción hasta tres días. Puede haber eventos duplicados y desordenados: validar evento, consultar estado y aplicar transiciones durables; `event.created` no garantiza deduplicación ni orden.
- [Reembolsos](https://docs.stripe.com/refunds): completos/parciales al método original, sujetos a saldo y estados pendientes, fallidos o `requires_action`; eventos `refund.created`, `refund.updated` y `refund.failed`. No equivale a devolución instantánea, comisión reintegrada o SLA aprobado.

### Mercado Pago: alternativa con contrato Orders explícito

- [Crear orden Checkout Pro](https://www.mercadopago.com.mx/developers/es/docs/checkout-pro-orders/create-order): `/v1/orders`, `X-Idempotency-Key` UUID único por intento, ID durable, `checkout_url`, `external_reference` y `expiration_time` ISO 8601; `total_amount` debe coincidir con la suma de ítems.
- Documenta captura `automatic`/`automatic_async`; no equiparar estos nombres con confirmación inmediata de todos los medios. Confirmar moneda MXN y aplicabilidad a cuenta mexicana: país de cuenta condiciona moneda/URL; no copiar valores argentinos del ejemplo.
- [Notificaciones](https://www.mercadopago.com.mx/developers/es/docs/checkout-pro-orders/notifications): lectura disponible confirma webhooks HTTPS POST. La búsqueda sugiere `x-signature`, pero no se extrajo el esquema completo: **firma exacta, validación y pruebas siguen pendientes** para esta API.
- [Reembolsos/cancelaciones](https://www.mercadopago.com.mx/developers/es/docs/checkout-pro-orders/refunds-cancellations): reembolso completo/parcial en `/v1/orders/{id}/refund`, dentro de 180 días desde aprobación, con saldo suficiente; parciales acumulados no pueden superar lo pagado. Confirmar tiempos y condiciones por medio/contrato.
- No mezclar estas referencias Orders con el contrato anterior `/checkout/preferences`; demostrar consulta/recuperación del mismo intento y comportamiento ante reintentos antes de adoptar.

### EVO: mantener candidato sin atribuir capacidades no probadas

- Las [guías oficiales](https://evopayments.mx/guias-integracion-ecomm/) presentan HostedCheckout como pasarela independiente; HostedSession permite diseño del comercio con captura de tarjeta por EVO. Direct implica manejo de tarjeta por el comercio y requisitos PCI: no es la vía preferida.
- En las lecturas reportadas, `/link-evo/` respondió 404 y `/guias-integracion-evoclick/` solo mostró pie de página. Esto es una brecha documental, no prueba de que el producto carezca de integración.
- Pedir identificación exacta: EVO Click/link de pago frente a gateway alojado; demostrar API, sandbox, notificación autenticada, consulta autoritativa, referencia del comercio y garantías de reintento. No asumir equivalencia entre productos.
- Un PDF de comisiones de 2024 apareció en búsqueda: no es cotización vigente y sus importes no se usan para comparar.

## 4. Costos: verificados frente a pendientes

| Proveedor | Costo verificable en las lecturas | Pendiente comercial |
| --- | --- | --- |
| Stripe México | [Tarifa estándar](https://stripe.com/mx/pricing): tarjetas nacionales **3.6% + $3 MXN** por transacción exitosa, sin IVA; internacional +0.5%. Checkout incluido en Payments; estándar sin instalación ni mensualidad. | Confirmar condiciones de cuenta, otros medios, MSI, divisas, reembolsos, disputas y liquidación; no extrapolar tarifa de tarjeta nacional. |
| Mercado Pago | **Sin tarifa vigente verificada.** [Página oficial de checkout](https://www.mercadopago.com.mx/herramientas-para-vender/check-out) y blog oficial consultado devolvieron 403. | Obtener tarifario legible de cuenta/cotización; extractos de búsqueda 3.49% frente a 3.49% + $4 son incompatibles y no sirven como precio confirmado. |
| EVO | **Sin tarifa vigente verificada.** Las guías técnicas no sustituyen una oferta comercial. | Cotizar cargos fijos, transacción, IVA, reembolso, disputa, liquidación y contrato del producto exacto. |

Ejemplo limitado: cobro nacional Stripe de **$1,000 MXN → $39 MXN de comisión antes de IVA**, bajo la tarifa citada. No representa costo total, otros medios ni comparación numérica válida con MP/EVO.

## 5. Próximas pruebas antes de contratar o implementar

### Comerciales: obtener evidencia escrita por proveedor

- [ ] Elegibilidad de la empresa y catálogo real, incluida gama veterinaria/productos permitidos; alta y aprobación de cuenta, adquirencia y alcance exacto del producto ofrecido.
- [ ] Cobro en MXN, moneda de liquidación, recepción en cuenta bancaria y calendario de abonos; no incorporar cobro en otras monedas sin requerimiento explícito.
- [ ] Tarifa vigente con IVA y cargos de instalación/mensualidad, nacionales/internacionales, medios/MSI, conversión, reembolso, contracargo, reservas de fondos y condiciones contractuales.
- [ ] D30 acota lanzamiento web a tarjetas; verificar cobertura y condiciones de tarjeta con proveedor. MSI y otros medios no se incorporan por inferencia. Validar cierre seguro para 15 minutos D34 y precisar operación del reembolso: D31 ya define pago tardío y corte de cancelación; D32 devuelve íntegramente lo cobrado al medio original en sus dos casos, con comisión no reintegrada a cargo de HoundFe. No inventar fecha de acreditación ni ampliar a otros incidentes.

### Técnicas: demostración acotada futura, todavía no ejecutada

- [ ] Checkout alojado con importe/moneda autoritativos y referencia durable; respuesta de creación perdida se recupera como el mismo intento, sin nuevo cobro ciego.
- [ ] Firma válida/inválida, consulta de estado y correspondencia de importe/moneda/cliente; duplicados, desorden y reintentos no duplican asignación ni liberación.
- [ ] Expiración/cancelación y confirmación concurrentes, cotización de vigencia corta, pago tardío y última unidad compartida con POS/bot: sin doble efecto ni entrega prometida sin stock.
- [ ] Pago confirmado con fallo posterior de pedido: recuperación sin recobro; reembolso total/parcial pendiente o fallido rastreable, sin tratar registro local como devolución externa.
- [ ] MP: validar firma y recuperación del contrato Orders en cuenta MXN; EVO: aportar documentación/sandbox de todas las capacidades reclamadas para el producto ofertado.

**Siguiente paso:** contrastar propuestas comerciales y esas pruebas con D25/D29; si Stripe supera elegibilidad, costo y validación, proponerlo para aprobación. MP permanece alternativa y EVO pendiente de pruebas equivalentes, no descartado. Ningún proveedor queda seleccionado por este documento.

## 6. Límites de esta entrega

Solo documentación basada en evidencia suministrada: sin nueva investigación, comprobación externa de URLs, cuentas, contacto con proveedores, código ni pruebas de aplicación. La revisión local valida estructura, espacios y enlaces relativos, no capacidades del proveedor ni integración operativa.
