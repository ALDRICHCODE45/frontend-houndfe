# Seed data for the round 2 recapture

Created through the real API as the admin user, in tenant Sucursal Centro, on the disposable dev DB (S8). Nothing was deleted or reset. The backend session had seeded none of this, so everything below was created here. Names only.

## Suppliers (5)

- Distribuidora Canina del Bajío
- Alimentos Premium para Mascotas Monterrey
- Accesorios y Juguetes Patitas
- Farmacia Veterinaria Zapopan
- Acuarios y Peceras del Norte (archived)

## Purchase orders (5, three lines each, on existing products)

| Note | Supplier | State |
| --- | --- | --- |
| Reposición de croquetas | Distribuidora Canina del Bajío | Draft, ready to confirm |
| Pedido de alimento premium sin costos capturados | Alimentos Premium para Mascotas Monterrey | Draft, two lines without cost |
| Accesorios para temporada navideña | Accesorios y Juguetes Patitas | Confirmed |
| Medicamentos y antiparasitarios, pedido cancelado | Farmacia Veterinaria Zapopan | Cancelled |
| Reposición de arena y comederos | Distribuidora Canina del Bajío | Draft, one line without cost |

## Payment methods (3 asked, 4 created)

- Efectivo en mostrador (cash)
- Tarjeta de débito y crédito (debit card)
- Transferencia SPEI (transfer)
- Vales de despensa (cash, inactive)

## Bank payment details (3)

- BBVA México
- Banorte
- Santander

Refused or not possible: all three are active. The API creates every detail as active and the update endpoint rejects `isActive`; the only way to deactivate one is the DELETE endpoint, which was off limits. So the "one active, others inactive" mix could not be built.

## Promotions (4)

- 10% en croquetas Hill's (product discount, active)
- $100 de descuento en compras mayores a $1,000 (order discount, scheduled)
- Lleva 2 y el tercero a mitad de precio (buy X get Y, ended)
- Regalo de bienvenida para clientes registrados (order discount, active, no dates)

## Still empty

Human decisions, cash reception (custody) and the shift card have no rows. They were not part of this seed.
