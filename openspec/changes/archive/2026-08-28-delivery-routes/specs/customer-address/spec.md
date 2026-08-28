# Delta for Customer Address — Optional Map Pin and Shared Formatter

Extends the customer-address surface with optional `latitude`/`longitude` fields on every customer-address interface/payload, an optional map section in `AddressModal` (via `AddressMapPicker`, governed by `address-map-pin`), and the standardized `formatAddress` util from `src/core/shared/utils/formatAddress` that replaces the two divergent local formatters in `CustomerUpsertSlideover` and `AssignCustomerSlideover`.

> **Canonical note:** No canonical spec previously existed at `openspec/specs/customer-address/spec.md`. This delta establishes the canonical state for the domain: every requirement listed below is ADDED (no existing REQ-* to MODIFIED or REMOVED). At archive time, this file's contents become `openspec/specs/customer-address/spec.md` verbatim.

Anchored on `openspec/changes/delivery-routes/design.md` §5.3 (lat/lng on customer-address types), §8 (the shared `formatAddress` formatter + the two call-site swaps), and §9 (`AddressModal` map section mount).

## ADDED Requirements

### REQ-CA-001: `CustomerAddress` interface accepts optional+nullable `latitude`/`longitude`

`CustomerAddress` (in `src/features/POS/customers/interfaces/customer.types.ts`) SHALL accept `latitude: number | null` and `longitude: number | null` as required-to-be-present-but-nullable fields (normalized by `mapAddress` from the optional backend response).

#### Scenario: CustomerAddress accepts null lat/lng

- GIVEN `latitude: null, longitude: null` on a `CustomerAddress` literal
- WHEN type-checked
- THEN the literal is accepted

#### Scenario: CustomerAddress accepts concrete numbers

- GIVEN `latitude: 19.4326, longitude: -99.1332` on a `CustomerAddress` literal
- WHEN type-checked
- THEN the literal is accepted

### REQ-CA-002: `CustomerAddressBackendResponse` accepts optional lat/lng

`CustomerAddressBackendResponse` SHALL accept `latitude?: number | null` and `longitude?: number | null` as OPTIONAL + nullable. Legacy responses (pre-deploy, no lat/lng) SHALL continue to type-check.

#### Scenario: legacy response omits lat/lng

- GIVEN a `CustomerAddressBackendResponse` literal omits both `latitude` and `longitude`
- WHEN type-checked
- THEN the literal is accepted

#### Scenario: backend response with null lat/lng

- GIVEN `latitude: null, longitude: null`
- WHEN type-checked
- THEN the literal is accepted

#### Scenario: backend response with concrete numbers

- GIVEN `latitude: 19.43, longitude: -99.13`
- WHEN type-checked
- THEN the literal is accepted

### REQ-CA-003: `CreateCustomerAddressPayload` accepts optional lat/lng

`CreateCustomerAddressPayload` SHALL accept `latitude?: number | null` and `longitude?: number | null`. The backend `forbidNonWhitelisted` policy SHALL accept both omitted and null values. `UpdateCustomerAddressPayload` (currently `Partial<CreateCustomerAddressPayload>`) inherits the same fields.

#### Scenario: create payload omits lat/lng

- GIVEN a `CreateCustomerAddressPayload` literal omits both fields
- WHEN type-checked
- THEN the literal is accepted

#### Scenario: create payload includes null lat/lng

- GIVEN `latitude: null, longitude: null` on a `CreateCustomerAddressPayload`
- WHEN the request is sent
- THEN the backend returns 201 (`forbidNonWhitelisted` is satisfied; explicit `null` is allowed)

#### Scenario: create payload includes concrete numbers

- GIVEN `latitude: 19.43, longitude: -99.13` on a `CreateCustomerAddressPayload`
- WHEN the request is sent
- THEN the backend returns 201 and persists the coords

### REQ-CA-004: `AddressFormInput` carries nullable lat/lng

`AddressFormInput` (the form-side mirror type used by `AddressModal`) SHALL carry `latitude: number | null` and `longitude: number | null` as required-to-be-present-but-nullable fields. The address form's zod schema SHALL accept absent/null values without blocking submit.

#### Scenario: form starts with null lat/lng

- GIVEN a fresh `AddressFormInput` initialized for a new address
- WHEN the modal mounts
- THEN `latitude === null` AND `longitude === null`
- AND the map picker shows no pin

#### Scenario: form accepts a cleared pin

- GIVEN a user clears the pin via "Quitar pin"
- WHEN the form state updates
- THEN `latitude === null` AND `longitude === null`
- AND the form can still be submitted

### REQ-CA-005: `customer.api.ts` `mapAddress` normalizes lat/lng to null

`mapAddress` (in `src/features/POS/customers/api/customer.api.ts`) SHALL copy `latitude: item.latitude ?? null` and `longitude: item.longitude ?? null`. As a result, legacy backend responses (lat/lng absent) normalize to `null` rather than `undefined`, and the form-side mirror type stays free of `undefined` cases.

#### Scenario: legacy response normalizes to null

- GIVEN `mapAddress({ ..., latitude: undefined, longitude: undefined })`
- WHEN `mapAddress` runs
- THEN the returned `CustomerAddress` has `latitude: null, longitude: null`

#### Scenario: response with concrete numbers passes through

- GIVEN `mapAddress({ ..., latitude: 19.43, longitude: -99.13 })`
- WHEN `mapAddress` runs
- THEN the returned `CustomerAddress` has `latitude: 19.43, longitude: -99.13`

### REQ-CA-006: `AddressModal` mounts the optional map section

`AddressModal.vue` SHALL mount `<AddressMapPicker mode="write" v-model="pin" />` inside the address form. The map section SHALL render only when the address form is in create OR edit mode (the modal is always in one of those two modes; never display-only). The `pin` v-model SHALL bind to `formState.latitude`/`formState.longitude`.

#### Scenario: modal mounts the map

- GIVEN the modal opens in create mode
- WHEN the modal renders
- THEN `AddressMapPicker` is mounted
- AND a "Quitar pin" button renders next to the map

#### Scenario: modal pre-fills the map from existing coords

- GIVEN the modal opens in edit mode for an address with `latitude: 19.43, longitude: -99.13`
- WHEN the modal mounts
- THEN the picker shows a marker at those coords
- AND the form state has `latitude: 19.43, longitude: -99.13`

### REQ-CA-007: `AddressModal` `handleSubmit` emits lat/lng only when present

`AddressModal.handleSubmit` SHALL emit latitude/longitude in the payload ONLY when they are not `null` (i.e. the user has set a pin). When the pin is cleared, the payload SHALL omit both keys.

#### Scenario: clear-pin submit omits lat/lng

- GIVEN the user clears the pin (`formState.latitude === null`)
- WHEN the user submits
- THEN `handleSubmit` emits the payload without `latitude`/`longitude` keys
- AND the backend accepts the payload

#### Scenario: pin-set submit includes lat/lng

- GIVEN the user sets coords to `(19.50, -99.20)`
- WHEN the user submits
- THEN `handleSubmit` emits `{ ..., latitude: 19.50, longitude: -99.20 }`

### REQ-CA-008: Pin does not gate address eligibility

A customer address with `latitude: null, longitude: null` SHALL be just as eligible for the `EligibleSalesPicker` (governed by `delivery-route-management`) as an address with coordinates. The address form SHALL NOT add a validation requirement that demands a pin.

#### Scenario: address without coords saves successfully

- GIVEN the address form is filled with no pin
- WHEN the user submits
- THEN the create/update request fires without coords
- AND the backend returns success
- AND the address remains usable for sales shipping

#### Scenario: address without coords is selectable in the eligible-sales picker

- GIVEN a confirmed sale's shipping address has `latitude: null, longitude: null`
- WHEN the eligible-sales picker fetches
- THEN the sale is included
- AND the manager can add it to a DRAFT route

### REQ-CA-009: `CustomerUpsertSlideover` uses the shared `formatAddress`

`src/features/POS/customers/components/CustomerUpsertSlideover.vue` SHALL import `formatAddress` from `@/core/shared/utils/formatAddress` and SHALL DELETE the local `formatAddress` function. The two call sites (address preview rows) SHALL resolve to the shared function with the label-first + `CP zipCode` ordering from `address-map-pin` REQ-AMP-008.

#### Scenario: local formatter is removed

- GIVEN the slideover source
- WHEN the imports are inspected
- THEN `import { formatAddress } from '@/core/shared/utils/formatAddress'` is present
- AND no local `function formatAddress` declaration exists

#### Scenario: rendered address uses label-first + CP zipCode

- GIVEN an address with `label: 'Oficina'`, `street: 'Insurgentes Sur'`, `exteriorNumber: '1602'`, `city: 'CDMX'`, `zipCode: '03940'`
- WHEN the slideover renders the address preview
- THEN the text reads "Oficina, Insurgentes Sur #1602, CDMX, CP 03940"

### REQ-CA-010: `AssignCustomerSlideover` uses the shared `formatAddress`

`src/features/POS/sales/components/AssignCustomerSlideover.vue` SHALL import `formatAddress` from `@/core/shared/utils/formatAddress` and SHALL DELETE the local `formatAddress` function. The existing call site SHALL resolve to the shared function.

#### Scenario: local formatter is removed

- GIVEN the slideover source
- WHEN the imports are inspected
- THEN `import { formatAddress } from '@/core/shared/utils/formatAddress'` is present
- AND no local `function formatAddress` declaration exists

#### Scenario: rendered address uses label-first + CP zipCode

- GIVEN an address with `label: 'Casa'`, `street: 'Av. Reforma'`, `exteriorNumber: '123'`, `city: 'CDMX'`, `zipCode: '06000'`
- WHEN the slideover renders the address preview
- THEN the text reads "Casa, Av. Reforma #123, CDMX, CP 06000"

### REQ-CA-011: No label editing in `AddressModal` (deferred)

`AddressModal` SHALL NOT expose a UI field for editing `label`. The customer entity's `label` field is rendered (via `formatAddress`) but only when present in the stop projection; `AddressModal` does NOT include a label input in this change. The shared formatter's superset type SHALL keep `label?: string | null` optional so the formatter is correct whether or not `label` lands on the customer entity in a future change.

#### Scenario: AddressModal has no label input

- GIVEN the modal renders in create or edit mode
- WHEN the form fields are inspected
- THEN no input labelled "Etiqueta" or similar renders

#### Scenario: formatter accepts addresses with and without label

- GIVEN an address with no `label` field
- WHEN `formatAddress` is invoked
- THEN the result omits the label segment
- AND the rest of the ordering is unchanged

## Risks / unknown

- **Customer `label` vs lat/lng.** The customer address DTO gains `latitude`/`longitude` per this delta, but it is unconfirmed whether `label` also lands on the customer entity. The formatter already accepts an optional `label`, so this delta is correct regardless of the answer. If `label` lands on the customer entity, a follow-up wires it through `mapAddress` + `AddressModal` display (still no edit affordance in this change).
