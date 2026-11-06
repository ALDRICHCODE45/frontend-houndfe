# Sale address change notice

A sale keeps the shipping address it was sold with (sale-time snapshot). When the customer later edits or deletes that address, the screens that show the sale's address warn about it, without replacing the sale's address.

## Specs
- S1 The sale's shipping address stays the one captured at sale time; editing or deleting the customer's address never rewrites it (user: «debe ser la direccion de ESA VENTA»).
- S2 When the customer's address changed after the sale, show a notice next to the sale's address: «El cliente cambió esta dirección después de la venta.» When it was deleted: «El cliente eliminó esta dirección después de la venta.» No notice when it is unchanged or the sale had no address.
- S3 The notice appears in the driver stop panel, in the eligible sales list used to build a route, and in the POS sales screens (which today do not show the shipping address, so they gain it).
- S4 The backend computes the status (the frontend only has the snapshot); contract to be agreed with the backend.

## Tasks
- [ ] T1 S4 Agree the backend contract (field, values, which endpoints) — parent via intercom
- [ ] T2 S2,S3 Driver stop panel and eligible sales notice — after T1
- [ ] T3 S2,S3 POS sales: show the sale's shipping address with the notice — after T1

## Log
- L1 User (2026-11-06): «Mm creo no lo se hermano.. creo que por motivos de la venta para que todo quede "real" o fiel, debe ser la direccion de ESA VENTA, y seria bueno que haya algun aviso/badge o algo que diga que la direccion de ese cliente se actualizo, me sigues?»
- L2 User chose all three places: «Panel del repartidor (Recomendado), Al armar la ruta (ventas por entregar), Ventas en el POS».
- L3 Context: route stops and eligible sales read sale snapshot columns including coordinates; GET /sales and /sales/:id do not expose a shipping address (BE docs/sale-shipping-snapshot-reads.md:3,15,23,32). The snapshot keeps the source address id, null once the customer deleted it.
