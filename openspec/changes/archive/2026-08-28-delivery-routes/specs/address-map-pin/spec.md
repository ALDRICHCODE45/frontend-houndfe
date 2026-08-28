# Address Map Pin Specification

Domain: `address-map-pin` · Capability: a single, reusable map primitive (`AddressMapPicker` in `src/core/shared/components/AddressMapPicker.vue`) that consumes a `MapProvider` port (default Leaflet + OSM + Nominatim in `src/core/shared/maps/leaflet-map-provider.ts`). The map has two modes: **write** (inside the shared `AddressModal` used by `CustomerUpsertSlideover` and `AssignCustomerSlideover`) — debounced geocode + draggable pin + clear-pin → optional `latitude`/`longitude` on the customer address; **read** (inside `DriverStopDetail`) — static marker when coords exist, hidden when not. The shared `formatAddress` util in `src/core/shared/utils/formatAddress.ts` replaces the two divergent local formatters and drives label-first ordering.

## Purpose

Give every address in the system an optional, visual-only geographic context without coupling the UI to any single map vendor. A tenant admin filling out an address sees a pin they can drag (or clear), the courier sees a static map for a stop, and the underlying provider can be swapped (Mapbox, Google) without touching the consumers. The pin MUST be optional and MUST NEVER gate eligibility for the eligible-sales picker — an address without coordinates is just as eligible as one with them.

## Requirements

### REQ-AMP-001: `MapProvider` port with default Leaflet+OSM+Nominatim implementation

`src/core/shared/maps/map-provider.ts` SHALL declare the `MapProvider` port with shape `{ kind: 'leaflet', createMap(container, opts), geocode(query, signal?) → Promise<GeoPoint | null>, reverse? }` plus the `GeoPoint { lat: number, lng: number }` type. `src/core/shared/maps/leaflet-map-provider.ts` SHALL be the default implementation: Leaflet + OpenStreetMap tiles + Nominatim client-side geocode. Consumers MUST import the port and SHALL NOT import `leaflet` directly.

#### Scenario: default provider is Leaflet

- GIVEN the `MapProvider` port is loaded
- WHEN the default provider is resolved
- THEN its `kind` is `'leaflet'`
- AND `createMap` mounts an OSM tile layer

#### Scenario: consumers do not import leaflet directly

- GIVEN `AddressModal.vue` and `DriverStopDetail.vue` source
- WHEN the source is inspected
- THEN no `import 'leaflet'` or `import L from 'leaflet'` line exists in either consumer
- AND the provider port is the only import seam

### REQ-AMP-002: `AddressMapPicker` exposes write and read modes

`AddressMapPicker.vue` SHALL accept a `mode: 'write' | 'read'` prop and a `modelValue: GeoPoint | null` v-model. In `write` mode the component SHALL render a debounced geocode input + draggable marker + clear-pin button. In `read` mode the component SHALL render a static marker + popup with no drag handle and no geocode input.

#### Scenario: write mode renders debounced input and draggable marker

- GIVEN `mode="write"`, `modelValue={ lat: 19.43, lng: -99.13 }`
- WHEN the picker mounts
- THEN a text input renders for search
- AND a Leaflet map renders with a draggable marker at the given coords

#### Scenario: read mode renders static marker only

- GIVEN `mode="read"`, `modelValue={ lat: 19.43, lng: -99.13 }`
- WHEN the picker mounts
- THEN a static marker renders
- AND no drag handle is visible
- AND no geocode input renders

#### Scenario: read mode with null modelValue renders nothing

- GIVEN `mode="read"`, `modelValue={ null }`
- WHEN the picker mounts
- THEN no Leaflet map renders (the host renders formatted address only)

### REQ-AMP-003: Write mode — debounced geocode + draggable pin + clear-pin

In write mode, typing into the geocode input SHALL debounce (one Nominatim request per settled typing burst) and SHALL move the marker to the first result. Dragging the marker SHALL emit `update:modelValue` with the new `GeoPoint`. The "Quitar pin" button SHALL clear the pin and emit `update:modelValue` with `null`.

#### Scenario: debounced geocode fires once per typing burst

- GIVEN the user types "Av. Ref" and pauses 500ms
- WHEN the debounce settles
- THEN exactly one Nominatim request fires
- AND the marker moves to the first result

#### Scenario: drag emits a new GeoPoint

- GIVEN `mode="write"`, a marker at `(19.43, -99.13)`
- WHEN the user drags the marker to `(19.50, -99.20)`
- THEN `update:modelValue` emits `{ lat: 19.50, lng: -99.20 }`

#### Scenario: clear-pin emits null

- GIVEN `mode="write"`, a marker placed at `(19.43, -99.13)`
- WHEN the user clicks "Quitar pin"
- THEN `update:modelValue` emits `null`
- AND the marker disappears
- AND the host's `latitude`/`longitude` reset to `null`

### REQ-AMP-004: Geocode failure falls back to manual pin placement

When Nominatim returns zero results OR the request errors (network / rate limit), the picker SHALL NOT throw and SHALL NOT render a blocking error. The map SHALL remain usable so the user can drag the pin manually to set coords. No toast SHALL fire on geocode failure.

#### Scenario: zero-results keeps the map interactive

- GIVEN the user types "asdfqwerty" and the debounce settles
- WHEN Nominatim returns zero results
- THEN no error toast fires
- AND the map remains visible
- AND the user can drag the marker

#### Scenario: geocode network failure keeps the map interactive

- GIVEN Nominatim is unreachable
- WHEN the user types and the debounce settles
- THEN no error toast fires
- AND the map remains visible
- AND the user can drag the marker

### REQ-AMP-005: Pin never gates address eligibility

The map SHALL NOT add or remove validation requirements on the address form. An address with `latitude: null, longitude: null` SHALL save successfully via `createAddress`/`updateAddress` and SHALL remain eligible for the `EligibleSalesPicker` (governed by `delivery-route-management`). The form zod schema MUST accept absent/null `latitude`/`longitude`.

#### Scenario: address saves without coords

- GIVEN the address form is filled with no pin and no manual lat/lng
- WHEN the user submits
- THEN `createAddress` fires with `latitude: undefined, longitude: undefined`
- AND the backend returns 201
- AND the saved address appears in the customer's address list with no pin icon

#### Scenario: address without coords is eligible for routes

- GIVEN a confirmed sale with a shipping address lacking coordinates
- WHEN `useEligibleSales` filters by status
- THEN the sale is included
- AND the picker accepts it
- AND the route create submits without error

### REQ-AMP-006: `AddressModal` mounts the write-mode picker

`AddressModal.vue` SHALL mount `<AddressMapPicker mode="write" v-model="pin" />` inside the address form section. The pin's `modelValue` SHALL be mapped to `formState.latitude`/`formState.longitude` (and emitted only when present in `handleSubmit`). The address zod schema (`addressSchema`) SHALL include `latitude: number | null` and `longitude: number | null` as optional+nullable.

#### Scenario: pin maps to formState on mount

- GIVEN the modal opens for an existing address with `latitude: 19.43, longitude: -99.13`
- WHEN the modal mounts
- THEN `formState.latitude === 19.43` AND `formState.longitude === -99.13`
- AND the picker shows a marker at those coords

#### Scenario: handleSubmit omits latitude/longitude when null

- GIVEN the user clears the pin (modelValue `null`)
- WHEN the user submits the address form
- THEN `handleSubmit` emits the payload without `latitude`/`longitude` keys
- AND the backend accepts the payload (`forbidNonWhitelisted` passes with absent keys)

#### Scenario: handleSubmit includes latitude/longitude when present

- GIVEN the user sets coords to `(19.50, -99.20)`
- WHEN the user submits the address form
- THEN `handleSubmit` emits `{ ..., latitude: 19.50, longitude: -99.20 }`

### REQ-AMP-007: Read-only map in `DriverStopDetail`

`DriverStopDetail` SHALL mount `<AddressMapPicker mode="read" :model-value="pin" />` when `stop.shippingAddress?.latitude != null && stop.shippingAddress?.longitude != null`. When coords are absent, the picker SHALL NOT mount; only the formatted address text SHALL render. The map SHALL be hidden gracefully on tile/network failure (no error toast, formatted address remains).

#### Scenario: read map renders when coords exist

- GIVEN a stop with `latitude: 19.4326, longitude: -99.1332`
- WHEN the stop detail renders
- THEN a static Leaflet marker at those coords is visible
- AND the formatted address text is visible above the map

#### Scenario: read map is hidden when coords are absent

- GIVEN a stop with `latitude: null, longitude: null`
- WHEN the stop detail renders
- THEN no Leaflet map renders
- AND the formatted address text renders alone

#### Scenario: tile failure hides the map without breaking the view

- GIVEN the Leaflet tile request fails
- WHEN the stop detail renders
- THEN the map area is hidden
- AND the formatted address remains visible
- AND no error toast fires

### REQ-AMP-008: Shared `formatAddress` replaces divergent local formatters

`src/core/shared/utils/formatAddress.ts` SHALL export `formatAddress(input: AddressFormatInput): string` with the label-first ordering: **label** → `street #exterior Int. interior` → `neighborhood, municipality, city, state` → `CP zipCode`. Empty/whitespace fields SHALL be dropped; missing everything SHALL return `''`. The function SHALL accept a superset type so customer entities (no `label` today) and the delivery-route stop projection (with `label`) both type-check.

#### Scenario: full address with all fields

- GIVEN `{ label: 'Casa', street: 'Av. Reforma', exteriorNumber: '123', interiorNumber: '4B', neighborhood: 'Centro', municipality: 'Cuauhtémoc', city: 'CDMX', state: 'CDMX', zipCode: '06000' }`
- WHEN `formatAddress` is invoked
- THEN it returns "Casa, Av. Reforma #123 Int. 4B, Centro, Cuauhtémoc, CDMX, CDMX, CP 06000"

#### Scenario: address missing label drops the label

- GIVEN `{ street: 'Av. Reforma', exteriorNumber: '123', city: 'CDMX', state: 'CDMX', zipCode: '06000' }` (no `label`)
- WHEN `formatAddress` is invoked
- THEN it returns "Av. Reforma #123, CDMX, CDMX, CP 06000"

#### Scenario: address missing everything returns empty string

- GIVEN an input with all null fields
- WHEN `formatAddress` is invoked
- THEN it returns `''`

#### Scenario: whitespace-only fields are dropped

- GIVEN `{ label: '   ', street: 'Av. Reforma', exteriorNumber: '', interiorNumber: null, zipCode: '06000' }`
- WHEN `formatAddress` is invoked
- THEN the label and empty `exteriorNumber`/`interiorNumber` are dropped
- AND the result is "Av. Reforma, CP 06000"

### REQ-AMP-009: `CustomerUpsertSlideover` uses the shared formatter

`src/features/POS/customers/components/CustomerUpsertSlideover.vue` SHALL import `formatAddress` from `@/core/shared/utils/formatAddress` and SHALL DELETE the local `formatAddress` function (lines ~153 in the pre-change source). The two existing call sites (~lines 285, 307) SHALL resolve to the shared function with no behavior change beyond the new label-first + `CP zipCode` ordering.

#### Scenario: shared formatter is imported

- GIVEN the slideover source
- WHEN the imports are inspected
- THEN `import { formatAddress } from '@/core/shared/utils/formatAddress'` is present
- AND no local `function formatAddress` declaration exists

#### Scenario: rendered address uses label-first + CP zipCode

- GIVEN an address with `label: 'Oficina'`, `street: 'Insurgentes Sur'`, `exteriorNumber: '1602'`, `city: 'CDMX'`, `zipCode: '03940'`
- WHEN the slideover renders the address preview
- THEN the text reads "Oficina, Insurgentes Sur #1602, CDMX, CP 03940"

### REQ-AMP-010: `AssignCustomerSlideover` uses the shared formatter

`src/features/POS/sales/components/AssignCustomerSlideover.vue` SHALL import `formatAddress` from `@/core/shared/utils/formatAddress` and SHALL DELETE the local `formatAddress` function (lines ~196 in the pre-change source). The existing call site (~line 343) SHALL resolve to the shared function.

#### Scenario: shared formatter is imported

- GIVEN the slideover source
- WHEN the imports are inspected
- THEN `import { formatAddress } from '@/core/shared/utils/formatAddress'` is present
- AND no local `function formatAddress` declaration exists

#### Scenario: rendered address uses label-first + CP zipCode

- GIVEN an address with `label: 'Casa'`, `street: 'Av. Reforma'`, `exteriorNumber: '123'`, `city: 'CDMX'`, `zipCode: '06000'`
- WHEN the slideover renders the address preview
- THEN the text reads "Casa, Av. Reforma #123, CDMX, CP 06000"

### REQ-AMP-011: Customer-address interfaces accept optional lat/lng

`src/features/POS/customers/interfaces/customer.types.ts` SHALL extend `CustomerAddressBackendResponse`, `CustomerAddress`, `CreateCustomerAddressPayload`, and `AddressFormInput` with optional+nullable `latitude?: number | null` and `longitude?: number | null`. `UpdateCustomerAddressPayload` (already `Partial<CreateCustomerAddressPayload>`) inherits them. `customer.api.ts` `mapAddress` SHALL copy `latitude: item.latitude ?? null` and `longitude: item.longitude ?? null`.

#### Scenario: CustomerAddress accepts both null and number

- GIVEN `latitude: null, longitude: null` on a `CustomerAddress` literal
- WHEN type-checked
- THEN the literal is accepted

#### Scenario: CustomerAddress accepts concrete numbers

- GIVEN `latitude: 19.43, longitude: -99.13` on a `CustomerAddress` literal
- WHEN type-checked
- THEN the literal is accepted

#### Scenario: legacy fixtures without lat/lng still type-check

- GIVEN a `CustomerAddress` literal omits both `latitude` and `longitude`
- WHEN type-checked
- THEN the literal is accepted

#### Scenario: mapAddress normalizes to null

- GIVEN `mapAddress({ ..., latitude: null, longitude: null })`
- WHEN `mapAddress` runs
- THEN the returned `CustomerAddress` has `latitude: null, longitude: null`

## Empty / loading / error states (per surface)

| Surface | Loading | Empty | Error |
| --- | --- | --- | --- |
| Write map (inside `AddressModal`) | Debounced geocode spinner | No pin / cleared pin → `latitude: null, longitude: null` | Geocode failure → no blocking error; manual pin fallback |
| Read map (`DriverStopDetail`) | Tile load spinner (Leaflet) | No coords → map hidden | Tile/network failure → map hidden gracefully |

## UI Copy (neutral Spanish)

- Clear-pin button: "Quitar pin"
- Geocode input placeholder: "Buscar dirección…"
- Read-mode popup: shared `formatAddress(stop.shippingAddress)` output

## Risks / unknown

- **Nominatim usage policy / rate limits.** Browser-direct geocoding with no backend proxy can be rate-limited. Mitigation: debounce, one request per interaction, manual-pin fallback, clear-pin. Backend proxy is a follow-up if abuse appears (out of scope).
