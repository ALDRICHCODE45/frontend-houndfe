# Single editorial contract (S35)
Replace the existing editorial consumer with the agreed single schema; no compatibility/adoption path and no operational/public-catalog change.
Branch: feat/editorial-single-contract. Delivery: feature-branch-chain (human selected); tracker/integration branch feat/editorial-single-contract; local review slices hold coherent work-unit commits, no main change/push/PR now. Forecast several thousand authored lines across dependent units. Checks: focused Vitest, app vue-tsc, regression suite, browser functional/visual checks for UI.

## Specs
S1. Human: «si hermano, justamente lo que pensaba es que realmente no es necesario mantener compatibilidad con la version 1, realmente aun no hay gente usandolo en produccion REAL, no hay productos reales, etc... podemos quitar la v1 por completo ( de lo que estamos hablando de que es?? es sobre los productos? )».
S2. Human: «si hermano, y de hecho, de nuevo, no hay productos reales aun en produccion, podriamos borrar todos los productos y no paasaria nada, todo lo que hay es de prueba.» No database environment/target was selected. No deletion, reset, deploy, public C3.3 activation or operational POS/stock/prices/sales edits belong to this frontend feature.
S3. Agreed backend target: docs/catalog-editorial-single-contract.md at backend commit c90e2e0963faa538e41c92d62e6778b92437e181, exact full attachment in parent session; not the currently live API. One strict schema; no request version/adoption headers, document modes, historical conversion or minimumContractVersion. Constant contractVersion/schemaVersion/receiptVersion 2 and review-v1 are identifiers, not alternate capabilities. Later units require their exact relevant target excerpts recorded here before delegation; older proposals must not fill gaps.
S4. Target primitive assignment contract (verbatim machine shapes):
```ts
type Owner = 'product' | 'sellable';
type Evidence = { sourceRef: string; verifiedOn: string };
type KnownPayload =
  | { type: 'text'; value: string }
  | { type: 'boolean'; value: boolean }
  | { type: 'number'; value: number; unit: string | null }
  | { type: 'single'; value: string }
  | { type: 'multi'; value: string[] }
  | { type: 'range'; min: number; max: number; unit: string };
type Value = { code: string; owner: Owner; variantId: string | null } & (
  | { state: 'known'; payload: KnownPayload; evidence: Evidence | null }
  | { state: 'unknown'; evidence: null }
  | { state: 'not_applicable'; evidence: null }
);
```
All branches closed, all listed fields required, no defaults; finite JSON numbers/scalar strings. No lone UTF-16 surrogates. The primitive decoder is NOT fresh admission: do not apply current membership, numeric domain/range ordering, evidence calendar/length/nonblank rules, owner/variant relationship, uniqueness across assignments, NA authorization or publication completeness here. Those are separate T2/T6 boundaries. It must never convert the old flat assignment into the new shape. Unknown input must fail safely, without mutation; successful output detached and strings/order preserved. Decode only plain JSON-shaped data, never execute submitted getters or normalize inputs. Array multi duplicates are fresh admission, not a hidden primitive conversion. Implementation choice: standalone target types/value decoder for T1, not wired to old consumers until dependency units are ready; this is staged construction, not a dual runtime reader.
S5. Lifecycle invariants retained: exact editorial read/update/publish permissions; CAS; scoped cancellation; frozen key/body/R/care token per intent; historical receipt is acknowledgement, not current state. Same-scope conflict retains edits; changing account/tenant/product/API scope clears private scoped state. Vocabulary first, then document pinned to R and context in parallel; install only coherent pair. No automatic retry/new key on 409. Target R and error semantics will be recorded verbatim before T4/T5.
S6. Initialization copies current new-contract Published unchanged when present; only absent Published creates `{schemaVersion:2,commercialTitle:null,description:null,mediaRefs:[],familyCode:null,values:[],facts:[]}`. Pending numeric policy permits incomplete numeric draft save, NOT NaN/nonfinite/order/unit errors; publish blocks pending numeric policy. Keep archived identity conservation (Draft on save, current Published on publish).
S7. Family-change question: «Si cambiás la familia de un borrador (por ejemplo, de alimento a higiene), ¿qué hacemos con sus atributos, evidencias y declaraciones privadas ya cargadas? El título, la descripción y la publicación actual no se modifican.» Human selected «Limpiar con confirmación (recomendado)»: «Avisar antes y limpiar esos datos solo del borrador local; no guardar automáticamente ni borrar la publicación.» Cancel preserves all local data. Title/description unchanged; no automatic save.
S8. Retain existing UI design and Spanish project copy. Historical user requirement: «por favor pruebes en el navegador (con el mcp de playwhrit) todo lo que hagas en la ui, sigue el system design del sistema, las reglas de ui, y no solo valides funcionalidad, tambien valida que lo que hagas tenga buen diseño, esto es muy importante hermano, lo que no quiero es llegar a revisar el resultado y tner que haver 1000 correcciones de diseño». No visual redesign. Verify controls, focus, narrow/wide screens, light/dark and explicit confirmations against isolated mocked contract until BE coordinated cutover.
S9. Exact normative68-code catalog received from backend at c90e2e0:32 CHOICES/25 NUMBERS/11 OTHER. Parent holds exact attachment. Do not expand ProductionDefinitionCode with custom codes, groups or aliases. Backend authoritative Unicode17 alias admission is not a browser runtime guard/parity requirement. Exact metadata/facts/care machine excerpts must accompany their later implementation units.

S10. Exact production definition membership from the backend attachment at c90e2e0 (first-column codes only; not option identities). T3a adds a readonly/frozen finite catalog, its literal union and primitive membership guard; no inference from prefixes, no normalization, no custom expansion, and no policy/transport integration. Preserve this exact order (32 choices,25 numeric,11 other):
```text
animal.target
life.stage
pack.form
pack.sale
content.kind
material
color.base
size.label
size.animal
food.format
food.role
food.process
food.texture
food.aquatic
treat.form
treat.base
toy.type
toy.feature
hygiene.type
hygiene.form
hygiene.litter
hygiene.scent
accessory.type
accessory.closure
accessory.feature
habitat.type
habitat.environment
habitat.substrate
habitat.component
care.type
care.form
care.device
measure.net_mass
measure.net_volume
measure.content_count
measure.pack_count
measure.dimensions.external_length
measure.dimensions.external_width
measure.dimensions.external_height
measure.dimensions.external_diameter
measure.dimensions.internal_length
measure.dimensions.internal_width
measure.dimensions.internal_height
measure.dimensions.internal_diameter
measure.fit.neck
measure.fit.chest
measure.fit.back_length
measure.animal_mass
measure.capacity.container
measure.capacity.habitat_usable_volume
measure.equipment.power
measure.equipment.voltage
measure.equipment.frequency
measure.equipment.flow
measure.equipment.temperature
measure.coverage.length
measure.coverage.area
text.ingredients
text.protein_origin
text.composition
text.manufacturer_care
text.instructions
text.clinical_analysis
text.concentration
text.regulatory_warnings
feature.washable
feature.reusable
feature.waterproof
```

S11. T2a exact private declaration shapes from target §4 (verbatim shapes with imported ProductionDefinitionCode from S10). This unit is primitive decoding only: preserve submitted order/strings and detached output. Do not yet enforce counts/nonblank/calendar/evidence sufficiency/bounds/current family membership/unique subsets/known-negative publication rules; those are T6. Static finite enum identities in these types are not expanded by custom definitions. Unknown declarations have neither value nor basis. Evidence uses S4 shape, not fresh admission. Reuse existing descriptor-safe snapshot/scalar/evidence primitives without changing existing decodeEditorialValue results; any new shared export must retain T1 regression checks.
```ts
type DimensionCode =
  | 'measure.dimensions.external_length'
  | 'measure.dimensions.external_width'
  | 'measure.dimensions.external_height'
  | 'measure.dimensions.external_diameter'
  | 'measure.dimensions.internal_length'
  | 'measure.dimensions.internal_width'
  | 'measure.dimensions.internal_height'
  | 'measure.dimensions.internal_diameter';
type FitCode = 'measure.fit.neck' | 'measure.fit.chest' | 'measure.fit.back_length';
type CapacityCode = 'measure.capacity.container' | 'measure.capacity.habitat_usable_volume';
type EquipmentCode =
  | 'measure.equipment.power' | 'measure.equipment.voltage'
  | 'measure.equipment.frequency' | 'measure.equipment.flow'
  | 'measure.equipment.temperature';
type ContentMagnitude = 'mass' | 'volume' | 'count' | 'length' | 'area';
type DeclarationValues = {
  contentMagnitude: ContentMagnitude;
  consumable: boolean;
  animalApplied: boolean;
  fitDeterminesChoice: boolean;
  capacityDeterminesChoice: boolean;
  electricalApplies: boolean;
  relevantDimensionCodes: { codes: DimensionCode[]; toyTypes: string[] };
  relevantFitCodes: FitCode[];
  relevantCapacityCodes: CapacityCode[];
  relevantEquipmentCodes: EquipmentCode[];
  presentationKind: 'formulation' | 'device' | 'packaging';
  optionalNonpertinenceCodes: ProductionDefinitionCode[];
};
type Declaration = {
  [K in keyof DeclarationValues]:
    | { key: K; state: 'unknown'; evidence: null }
    | {
        key: K;
        state: 'known';
        value: DeclarationValues[K];
        evidence: Evidence;
        basis: string;
      };
}[keyof DeclarationValues];
```
Use project-prefixed exported type names to avoid DOM/global collisions; wire keys remain exact. All objects closed/required, Unicode scalar strings, no coercion/defaults/normalization. Primitive shape errors return null without mutating input. Successful known false/empty arrays remain explicit values; unknown is distinct. No live consumer integration. Exact care/facts/document shapes follow in T2b before its writer.

S12. T2b exact private care capture shapes from target §4:
```ts
type Requirement = {
  key: string;
  description: string;
  disposition: 'satisfied' | 'not_applicable' | 'unresolved' | 'conflicting';
  evidence: Evidence[];
  basis: string;
};
type ReviewWarning = {
  key: string;
  requirementKeys: string[];
  text: string;
  disclosure: 'private_only' | 'public_required' | 'unresolved';
  evidence: Evidence[];
  handlingBasis: string;
};
type CareReview =
  | { state: 'unknown' }
  | {
      state: 'prepared';
      jurisdiction: string;
      intendedUse: string;
      determination: 'identified' | 'none_applicable';
      evidence: Evidence[];
      basis: string;
      requirements: Requirement[];
      warnings: ReviewWarning[];
    };
```
Only primitive closed-shape/scalar decoding in T2b. Do not enforce fresh nonblank/count/calendar/unique keys/references/evidence sufficiency/family permission or publication readiness here. Preserve unknown, prepared contradictory/unresolved/private/public-required states for subsequent explicit correction; no silent sanitization/removal/legal inference. Empty arrays and unresolved capture are readable, not publication approval. Do not infer none_applicable requires empty arrays at this primitive boundary; that publication rule is later T6/T8. Decode one non-null CareReview to detached typed object or null on invalid; nullable careReview handling belongs to later SellableFacts composition. Reuse existing Evidence/scalar/snapshot exports, unchanged. No UI/API/receipt/attestation integration.

S13. T2 composes exact target §3/§4 document and subject forms using already-verified primitive readers. Verbatim machine shapes (Value/Declaration/CareReview are S4/S11/S12):
```ts
type SellableFacts = {
  variantId: string | null;
  presentation: string;
  declarations: Declaration[];
  careReview: CareReview | null;
};
type Document = {
  schemaVersion: 2;
  commercialTitle: string | null;
  description: string | null;
  mediaRefs: string[];
  familyCode: string | null;
  values: Value[];
  facts: SellableFacts[];
};
```
All fields required, closed shapes, no modes or conversion, scalar strings. Public readers return detached complete typed value or null; one malformed nested item rejects the whole object rather than pruning or substituting unknown/defaults. Root null is invalid for either reader; careReview:null is explicitly valid within facts. Preserve all document array ordering and strings, including inactive/unknown/contradictory content. Primitive reader does NOT require nonblank/unique/current variant/reference/limits/family-null emptiness/family permissions/numeric domains/evidence or publication readiness: fresh T6 admission enforces those. Do not discard stored information to make a document readable. Reject old five-key documents, flat old values and mode wrappers; schemaVersion must be exactly2. Clean noPublished initialization shape in S6 is readable; don't add initializer mutation or alter copy-Published behavior. Export project-prefixed types in new contract module; existing old document module/consumers remain untouched until coordinated integration.

S14. T3b target §5 definition metadata machine shapes (verbatim):
```ts
type Unit = { code: string | null; label: string | null; sortOrder: number };
type Option = {
  code: string;
  label: string;
  archived: boolean;
  sortOrder: number;
};
type Group = { code: string; label: string; optionCodes: string[] };
type Alias = { label: string; optionCode: string };
type NumericPolicy =
  | { status: 'pending' }
  | {
      status: 'resolved';
      magnitude: string;
      integer: boolean;
      lower: number | null;
      lowerInclusive: boolean;
      upper: number | null;
      upperInclusive: boolean;
    };
type Definition = { id: string; code: string; label: string } & (
  | { type: 'text' | 'boolean' }
  | { type: 'number' | 'range'; units: Unit[]; numericPolicy: NumericPolicy }
  | {
      type: 'single' | 'multi';
      options: Option[];
      groups: Group[];
      aliases: Alias[];
    }
);
```
T3b is a single-definition primitive reader, not complete metadata admission. All listed fields required/closed, strings Unicode scalar, numbers finite, sortOrder safe integer (negative valid). ID/code/label fields nonblank under ECMAScript trim and retained byte-for-byte; magnitude remains scalar string, not an invented enum. Arrays present even empty; nullable unit code/label retained. No coercion/defaults/order changes; detached complete value or null. Do not prematurely enforce cross-field numeric policy bounds, null-code/label pairing, range-null-unit ban, unique identities, group/alias memberships or production identity/type/domain rules in this primitive reader: T3 final metadata qualification must enforce those before editor use. Do not implement Unicode17 browser alias parity, provisioning or family policy here. Definitions may have custom codes; finite S10 applies FactRule parameter/fact subset, not global Definition.code. No live consumers.

S15. T3c target §5 policy/family/vocabulary machine shapes (verbatim; Definition=S14, Owner=S4, ProductionDefinitionCode=S10):
```ts
type OptionTest = {
  definitionCode: string;
  operator: 'equals_set' | 'contains_all' | 'intersects';
  optionCodes: string[];
};
type PolicyCase = {
  code: string;
  when: OptionTest[];
  applicability: 'applicable' | 'not_applicable' | 'unresolved';
  required: boolean;
  allowNA: boolean;
  evidenceRequired: boolean;
  documentary: 'resolved' | 'not_applicable' | 'unresolved';
};
type ProductionFamily = 'food' | 'treat' | 'toy' | 'hygiene' | 'accessory' | 'habitat' | 'care';
type RuleId = 'required' | 'optional' | 'animal' | 'form' | 'content' | 'dimensions'
  | 'fit' | 'capacity' | 'space' | 'equipment' | 'optional_equipment' | 'presentation';
type FactRule = {
  family: ProductionFamily;
  ruleId: RuleId;
  parameter: ProductionDefinitionCode;
};
type RuleResult = Pick<PolicyCase,
  'applicability' | 'required' | 'allowNA' | 'evidenceRequired' | 'documentary'>;
type BindingPolicy =
  | { route: 'pending' }
  | { route: 'option_cases'; cases: PolicyCase[] }
  | { route: 'fact_rule'; rule: FactRule };
type Binding = {
  definitionId: string;
  definitionCode: string;
  owner: Owner;
  sortOrder: number;
  exposure: 'INTERNAL' | 'DETAIL' | 'FACET';
  searchable: boolean;
  publicationCheck: 'always' | 'when_asserted';
  policy: BindingPolicy;
};
type Family = { id: string; code: string; label: string; bindings: Binding[] };
type Vocabulary = {
  semanticsVersion: 'editorial-production-1';
  families: Family[];
  definitions: Definition[];
};
```
T3c primitive reader only, whole-object atomic failure, all keys required/closed. No minimumContractVersion accepted. Scalar nonblank IDs/codes/labels and safeinteger sortOrder (negative allowed), exact route/enum literals, no defaults/coercion. FactRule static family/ruleId/parameter enums exact; standalone custom definition/family codes remain strings. Reuse verified definition reader and snapshot primitives unchanged. Preserve original array order/strings/labels/archives/policies; detached output. Cross-field/identity/reference/numeric/selector-graph/production admission is T3, not silently imposed or claimed by T3c. Cases/tests/optionCodes arrays may be empty or duplicate at primitive boundary; later qualification handles nonempty expected sets, identity uniqueness and required/publication consistency. No policy evaluation, hashing, HTTP envelope, normalized alias engine or live consumer wiring here.

S16. T3 consumer metadata qualification, grounded in target §5/§7 (not a duplicate backend full production admission engine):
- Target: «Families/definitions unique by ID/code; bindings unique definition per family, definitionId/code resolve the same identity.» Reject any duplicate family ID/code or definition ID/code and duplicate family binding; resolve both binding identifiers to the same definition. Never trim IDs for matching or prune invalid rows.
- Target: «Unit code null iff label null; ranges forbid null units. Null numeric bound means reviewed unbounded with inclusive=false; finite bounds ordered, equality requires both inclusive.» Apply to every number/range definition; pending policy stays allowed metadata, not unbounded resolved. Unit codes unique (at most one null); enforce no new physical/numeric domain beyond supplied policy.
- Target: «Units/options/groups and members/test options have unique identities within their definition; references resolve there. No archive identity reuse or option/group conflation.» Unique option codes/group codes; each group's optionCodes unique and existing; overlaps across groups allowed. Alias targets resolve same definition and exact original alias labels unique; labels may be homonymous and options may be archived. Group and option namespaces separate. Unicode17 normalized collision admission stays authoritative backend: no browser approximation/parity claim or new key normalization.
- Target option_cases: AND tests on bound single/multi selector definitions in same family; expected optionCodes nonempty, unique, existing. Each when has unique tested definition, case codes unique within binding. Cyclic selector dependencies rejected, including self-dependency; acyclic conditional intermediate selectors valid. Read owner from tested binding, do not invent same-owner restriction. No alias/group expansion. Empty when is unconditional; empty cases can remain unresolved metadata, not invent implicit default.
- Target: «Potentially required cases must be always» and «Required implies applicable». Enforce both for explicit cases. Do NOT infer allowNA=>not_applicable, evidenceRequired/documentary equivalence, or reject ordinary optional pending metadata. No arbitrary overlap solver in frontend; backend static rejection and later selected-route evaluation own that rule, not a browser copy of backend admission.
- Fact rule reference coherence: family equals actual family.code, parameter equals bound definition.code, owner sellable as required for production bindings. Static enum already decoded. This also rejects custom-family fact_rule without inventing a second policy dispatch. Complete canonical production inventory/type/route/exposure/evidence mapping remains backend authority, not this consumer qualifier.
- API implementation choice: qualifyEditorialContractVocabulary(unknown) returns a fully decoded detached unchanged-order Vocabulary or null. It invokes the verified primitive decoder, performs checks without mutation, rejects WHOLE snapshot on any failed consumer invariant; no inferred defaults/filtered fallback/side effects. Existing helper readers unchanged. This consumer-safety proof does not claim full backend admission, hashing, applicability evaluation, public exposure or live integration.

S17. T4a target §5/§8 exact success response bodies (verbatim; Owner=S4, Document=S13, Vocabulary=S15 qualified by S16):
```ts
type ArchivedWarning = {
  code: 'ARCHIVED_OPTION';
  familyId: string;
  definitionId: string;
  owner: Owner;
  variantId: string | null;
  optionCode: string;
};
type EditorialState = {
  cycle: number | null;
  draft: {
    revision: number;
    basePublishedRevision: number | null;
    document: Document;
  } | null;
  published: { revision: number; document: Document } | null;
  warnings?: ArchivedWarning[];
};
type StateResponse = {
  contractVersion: 2;
  vocabularyRevision: string;
  state: EditorialState;
};
type VocabularyResponse = {
  contractVersion: 2;
  vocabularyRevision: string;
  vocabulary: Vocabulary;
};
```
R exact syntax: «ev2-sha256-» followed by64lowercase ASCIIhex; no trimming/uppercase/list/leading/trailing whitespace (including newline). Export a primitive revision guard for later transport; no hash computation or global identity assumption. Stored response counters positiveint32; null cycle requires null draft/published («No state means cycle/draft/published all null»). Positive cycle with cleared slots is valid. Nullable basePublishedRevision can be historical; do not enforce equality with current Published. Warning objects closed; IDs/optionCode scalar nonblank, exact code/owner; preserve ordering, omission versus present-empty warnings, all original strings. Request counter validation is a DIFFERENT boundary and must not inherit storageint32 limits ahead of receipt lookup.
T4a public readers decodeEditorialStateResponse and decodeEditorialVocabularyResponse return complete detached typed envelope or null, no partial state/vocabulary or data wrapper. Direct document slots only, reuse new document reader without fresh validation; no old raw-state fallback, document modes or invented warning/evidence/attestation fields. Vocabulary reader invokes existing S16 qualifier; no canonical hashing/producer admission. Header/bodyR matching and request pinning are later T4 transport, no HTTP/network in this unit. All keys required except warnings; reject unknown/extra fields. No existing consumers/helpers changed.

S18. T4 exact transport excerpts from backend c90e2e0 attachment re-sent seq30 (target, not live implementation):
> Paths below are controller-relative (retain any existing deployment API prefix).
> All seven paths/statuses are retained; no internal create or media route is added.
> No query parameters are accepted. Product IDs use the existing UUID validation.
> Document/context GET reject nonempty decoded bodies; GETs take no input document.

| Operation | Method and relative path | Success / body |
| --- | --- | --- |
| Vocabulary | `GET /catalog-editorial/vocabulary` | `200 VocabularyResponse` |
| Document | `GET /products/:productId/editorial` | `200 StateResponse` |
| Context | `GET /products/:productId/editorial/context` | `200 Context` |
| Initialize | `POST /products/:productId/editorial/draft/initialize` | `201 StateResponse` |
| Save | `PUT /products/:productId/editorial/draft` | `200 StateResponse` |
| Publish | `POST /products/:productId/editorial/draft/publish` | `200 StateResponse` |
| Discard | `POST /products/:productId/editorial/draft/discard` | `200 StateResponse` |

```ts
type InitializeBody = { expectedCycle: number | null };
type TransitionBody = { expectedCycle: number; expectedRevision: number };
type SaveBody = TransitionBody & { document: Document };
type Context = { variants: { id: string; name: string }[] };
```
> Context is unchanged: complete variants sorted by name then id, no pagination,
> SKU, stock, prices, flags, R envelope or invented revision semantics.
> Header names are case-insensitive; semantic values are exact, untrimmed tokens.
> Inspect raw occurrences: duplicate or comma-list semantic headers and malformed
> values are `400 MALFORMED`, including when otherwise prohibited. Presence of a
> prohibited header, even empty, fails. No version header is needed on requests.

| Request | `Editorial-Vocabulary-Revision` | `Idempotency-Key` | `Editorial-Care-Confirmation` |
| --- | --- | --- | --- |
| Vocabulary GET | Forbidden | Forbidden | Forbidden |
| Document GET | Required R | Forbidden | Forbidden |
| Initialize/save/discard | Required R | Required | Forbidden |
| Publish | Required R | Required | Only exact `review-v1`; conditional below |

> R syntax: `ev2-sha256-` followed by 64 lowercase hex digits. Write keys retain the
> existing 1–200 character, untrimmed contract. Context retains existing header
> behavior; do not attach new pinning/idempotency requirements to it. The obsolete
> **request** headers `Editorial-Contract-Version` and `Editorial-Adoption` are
> forbidden on this editorial surface and produce `400 MALFORMED`.
> Publish parses a supplied confirmation token before lookup. After receipt miss
> and locked CAS, fresh care publish requires it; fresh non-care publish forbids it.
> The identical token/null belongs to receipt intent, never an implicit UI default.
> All editorial successes/errors: `Cache-Control: no-store`.
> Vocabulary/document/write successes: `Editorial-Contract-Version: 2` and
> `Editorial-Vocabulary-Revision: R`, equal to envelope R (recorded R on replay).
> Context: unchanged `{variants}` response; no semantic revision/version envelope.
> Target editorial errors: informational `Editorial-Contract-Version: 2`, no
> `Editorial-Vocabulary-Revision`, no document or vocabulary in error body.
> CORS allows `Authorization`, `Content-Type`, `Editorial-Vocabulary-Revision`,
> `Idempotency-Key`, `Editorial-Care-Confirmation`; exposes
> `Editorial-Contract-Version` and `Editorial-Vocabulary-Revision`. Obsolete request
> version/adoption headers are not supported CORS inputs.
> Dynamic Date/request IDs and JSON byte layout are not replay guarantees.
> Malformed nonpositive/noninteger request counters are 400; do not invent a new
> pre-lookup safe-integer or storage-bound wire rule.
> Same intent→exact recorded status/body/R/warnings acknowledgement, not current GET, no restoration or
> republish.
> Editorial envelope is exactly `{statusCode,error}`, no message/timestamp/field
> hints/document/R. The complete target error enum is:

| Status | error |
| --- | --- |
| 400 | MALFORMED |
| 401 | UNAUTHORIZED |
| 403 | FORBIDDEN |
| 404 | NOT_FOUND |
| 409 | CONFLICT |
| 409 | VOCABULARY_CHANGED |
| 500 | EDITORIAL_VOCABULARY_UNREPRESENTABLE |
| 500 | INTERNAL_ERROR |

> No 406, unsupported, adoption or upgrade errors.
> Framework invalid JSON/413/unmatched-route errors
> remain outside this local envelope; FE handles non-envelope failures generically.
> On either 409 retain edits and offer explicit reload/reconciliation;
> no autosave retry, inferred success or automatic new key.
Implementation boundary: add isolated editorial-contract.api.ts and request/error types, with Axios adapter tests; existing product-editorial.api.ts and shared HTTP/auth untouched until T5 cutover. Seven methods retain deployment prefix/shared authenticated GET no-cache behavior. Use T4a success readers and require expected status, exact response version header and valid header/body R equality; pinned state/write response R also equals the supplied original R, never a later global/current R. Invalid success becomes sanitized UNKNOWN protocol failure, not invented backend error. Context stays unpinned and preserves returned variant ordering; closed shape without fresh reference admission. Normalize only exact status/error pairs with closed envelope; all non-envelope/network/abort/invalid-success failures are safe generic errors, no raw payload/message propagation. No new local domain/request-counter bounds, key generation, retries, global cache or care inference. Caller supplies R/key and publish token/null explicitly; pass optional AbortSignal through for later scoped reads without custom header escape hatch. Preserve exact body/key/R/token on caller retransmissions; shared auth refresh remains shared HTTP responsibility, not changed here. Browser raw duplicate header visibility is limited by Axios/browser normalization; reject observable lists/arrays/malformed tokens and do not claim inspection of inaccessible raw occurrences. Server owns raw header admission, cache-control and CORS configuration. Add no request version/adoption headers or compatibility branch.

S19. T5a coherent-read orchestration, exact target excerpts (backend c90e2e0 §1/§10):
> Quick FE path: vocabulary first → document GET pinned to its R and context GET in
> parallel → install a coherent vocabulary/document pair atomically. Implement one
> strict reader.
> FE installs vocabulary/document only with equal R and API/account/product scope.
> If requests race metadata changes, discard the incoherent pair and reload explicitly;
> context is parallel current identity information, not R-pinned. Preserve local buffer.
> On either 409 retain edits and offer explicit reload/reconciliation;
> no autosave retry, inferred success or automatic new key.
T5a implementation boundary: pure asynchronous loadEditorialContractSnapshot with dependency-injected read port (getVocabulary/getState/getContext matching T4), productId and required AbortSignal. Return one complete `{vocabulary: EditorialVocabularyResponse, state: EditorialStateResponse, context: EditorialContractContext}` only after all reads succeed and both envelope R values match. Vocabulary resolves before state/context start; state receives exactly vocabulary R, context has no R argument, all calls receive the same signal. Check cancellation before first call, after vocabulary and before returning the complete result, even if a test port ignores cancellation. Rejections/409/mismatch/cancellation return no partial result and cause no automatic retry. Preserve upstream error identity; helper-generated cancellation/mismatch errors contain fixed safe messages only, never response content. No refs/store/cache/auth policy, no local buffer mutation or install callback; no re-decoding already validated T4 results. API/account/tenant/product/generation guards and atomic reactive installation remain existing lifecycle owner's integration responsibility, not a claim that this isolated helper establishes authority. No shared HTTP/auth or current consumers changed. Risk:item4 (async ordering/cancellation) requires independent verification after checks. Integration waits for T6/T7/T8 dependencies; do not temporarily mix contracts.

S20. T6a fresh evidence admission, exact c90e2e0 §3:
> Evidence capture: sourceRef 1–1000 Unicode scalar code points, nonblank under
> ECMAScript trim, no lone surrogate or C0/DEL control; verifiedOn exactly real
> Gregorian ASCII `YYYY-MM-DD`, year 0001–9999. No expiry/future-date rule, URL fetch,
> source authenticity or automatic file access. Supplied malformed evidence fails
> fresh admission even on drafts. Missing per-value evidence may remain incomplete
> on save; publish requires it when the selected rule says so. Title needs no evidence.
T6a isFreshEditorialEvidence(unknown):boolean validates supplied Evidence only; null/absence is not supplied Evidence and returns false, while callers separately decide whether absence is allowed. Reuse unchanged primitive evidenceSchema/snapshotJson, then source length/trim/control and Gregorian date checks. Never mutate/trim/normalize input or perform IO/time-dependent checks. Keep primitive stored readers unchanged; they must still read scalar evidence that fails fresh limits. No document/requiredness/publication policy inference, URL validation, source fetch, prose-control ban outside sourceRef, or integration. Pure boundary tests cover exact lengths including astral scalars, every C0/DEL, surrogate invalidity, calendar month/leap/year edges, non-ASCII/malformed/trailing-newline dates, future acceptance, immutable input, closed primitive shape and getter safety.

S21. T6b basic fresh admission, exact c90e2e0 §3 excerpts:
> Fresh admission uses unique `[code,variantId]`; code/type/owner must match the
> actual selected family binding/definition. Product owner requires null variant;
> sellable owner uses actual context identity. Family null requires values/facts `[]`.
> Media are unique private asset IDs of this product, not URLs. Single/multi values
> use exact option codes; multi is unique, no group/alias expansion or inference.
> Unknown, omission, known false, known empty and NA are distinct.
> Finite numbers and finite ordered inclusive range endpoints (`min <= max`, equal
> allowed) use exact definition unit membership. Range unit is non-null; no mixed
> units, conversions, numeric strings, dimension calculation or free-text substitute.
> Resolved numeric policy applies integer/bounds/inclusivity to scalar and both
> endpoints. S33: pending numeric policy allows incomplete known numeric draft save,
> but publish rejects it with `400 MALFORMED`; pending never means reviewed unbounded.
> Finite/order/unit checks still apply on save.
> Fresh save/publish bounds: title ≤200 and description ≤20000 Unicode code points;
> media ≤20, values ≤200, facts ≤200; text payload has no separate limit beyond the
> framework's existing 100 kB serialized JSON ceiling.
> Initialize copies and recorded acknowledgements are not fed
> through fresh bounds. GET does not turn into fresh domain/completeness admission.
> Supplied malformed evidence fails
> fresh admission even on drafts. Missing per-value evidence may remain incomplete
> on save; publish requires it when the selected rule says so. Title needs no evidence.

T6b boundary: inspectEditorialBasicAdmission({document:unknown,vocabulary:EditorialContractVocabulary,context:EditorialContractContext}) returns `{document:EditorialContractDocument|null,issues:EditorialBasicIssue[]}`; never a `canSave`, `authorized` or complete-admission verdict. Metadata/context arguments are already validated results from T4/S16; no second metadata engine. Decode document with existing primitive reader. On structural failure return null document +structure issue; otherwise preserve detached decoded document and report deterministic issues (root codes or valueIndex) without rewriting/filtering. Check quoted caps, duplicate media identities only (NOT ownership/URL authority), family membership/null-empty, unique `[code,variantId]`, bindings/definition identity/type/owner, product-null and sellable actual context membership (emptycontext→null), exact option/unit membership and unique multi, finite/range ordering and resolved numeric integer/bounds/inclusivity. Pending numeric allowed for this draft-only basic check; no publication verdict. Known text/boolean/empty optional values remain structurally distinct; unknown/NA still require correct binding/owner/subject but have no payload to type-check. Check every supplied per-value evidence with S20; absent evidence is not a basic error. No arbitrary code/ID trimming or prototype-key hazards. No separate text cap or request-size limit invention; framework serialized-body ceiling remains separate.
Explicit exclusions before any save authorization: facts/care fresh capture and reference checks beyond root facts count/family-null, media ownership, archived conservation, selected NA authorization, policy evaluation, publication/E/care confirmation, permissions/CAS. An empty issues array means ONLY basic checks passed, including for NA/archived options; tests must demonstrate those remain outside this partial helper rather than claim permission. Keep every current reader/helper/consumer unchanged; no runtime cutover.

S22. T6c care capture admission, exact c90e2e0 §4:
> Presentation/basis and care prose are nonblank Unicode scalar strings, preserved;
> the C0/DEL prohibition belongs only to sourceRef, not all prose.
> Care requirements/warnings ≤32 each, unique exact keys in separate namespaces;
> keys 1–80, descriptions/bases/handlingBasis 1–2000, warning text 1–4000,
> jurisdiction 1–200, intendedUse 1–1000. Each evidence array ≤16 unique exact
> sourceRef/date pairs; empty allowed on draft. requirementKeys ≤32 unique keys
> resolving within this row's requirements, never cross-row.
> Unknown/missing facts and structurally valid contradictory declarations can save as
> incomplete drafts. Invalid evidence, reference, duplicate identity or capture bound
> is malformed and changes no revision. Capture, reference admission, evidence
> sufficiency, NA permission and publication readiness are separate gates (§7).
T6c isFreshEditorialCareCapture(unknown):boolean checks a supplied CareReview only, reusing unchanged decodeEditorialCareReview and S20 evidence validator. `{state:'unknown'}` passes capture, null/absence returns false (caller decides optionality/family). Prepared prose uses quoted scalar counts and ECMAScript trim nonblank, no mutation/normalization/IO; sourceRef alone forbids C0/DEL. Each evidence array (review, requirements, warnings) enforces≤16, valid supplied evidence and unique exact pair via collision-safe identities. Requirement and warning keys each unique locally but may coincide across namespaces; warning requirementKeys resolve only to this review, unique and≤32. Preserve strings/order; no Date-now rule or global identities.
This is capture-only: do NOT require nonempty evidence/requirements for draft, reject unresolved/conflicting/public_required states for readiness, enforce determination-to-array readiness correspondence, infer legal truth or family/care eligibility, or evaluate E/confirmation. Those later checks remain required. Primitive readers unchanged and continue to read scalar historical content that exceeds fresh capture limits. No active callers, no private data exposure or mutation.

S23. T6d facts/declaration capture, exact c90e2e0 §4:
> One row per actual sellable; no sibling/product inheritance. Presentation is exact
> manufacturer subject/presentation prose, 1–300 code points. Declarations ≤12,
> unique key. Known declarations, including false/empty, require Evidence and basis
> 1–2000; unknown has no value/basis. No invented known facts for absent rows.
> Presentation/basis and care prose are nonblank Unicode scalar strings, preserved;
> the C0/DEL prohibition belongs only to sourceRef, not all prose.
> Unique subsets: dimensions ≤8, fit ≤3, capacity ≤2, equipment ≤5, toyTypes ≤15,
> optionalNonpertinenceCodes ≤68. Preserve submitted order.
> Unknown/missing facts and structurally valid contradictory declarations can save as
> incomplete drafts. Invalid evidence, reference, duplicate identity or capture bound
> is malformed and changes no revision. Capture, reference admission, evidence
> sufficiency, NA permission and publication readiness are separate gates (§7).
T6d isFreshEditorialFactsCapture(unknown):boolean checks a supplied facts array (≤200 from S21), decoding every row through unchanged decodeEditorialSellableFacts. Emptyarray passes; nonarray/malformedchild rejects wholearray. Unique exact variantId per supplied row (null counts as one identity), presentation scalar/nonblank1–300; declarations≤12 unique key; known evidence passes S20 and basis scalar/nonblank1–2000 even for false/empty. Unknown declarations retain primitive closed shape. Known array subsets enforce listed caps and exact uniqueness; relevantDimensionCodes codes and toyTypes each have own limit/identity set. Reuse primitive finite code unions, never invent options, inheritance, defaults, sorting or trimming. Nonnull careReview passes S22 capture; null allowed at this layer. Getter-safe/immutable input, no IO.
This is capture-only, not full fresh admission: actual context membership, family permissions (including custom subset), bound axes/content magnitude/toy options/optional fact-rule references, family-null facts, E coverage, contradictions/readiness and care-only eligibility remain next relational gates. Passing here does not authorize save or publish. No primitive reader/helper/consumer changes. Existing documented incomplete draft representations remain readable even when capture fails.

S24. Human baseline clarification (interactive selection, after backend seq33 identified target gap): question «Which rule should govern whether saved data can justify keeping an archived option? This concerns the saved baseline; the new draft must still pass all fresh checks.» Selected «Context/reference checks only (recommended)», description «Reject structurally invalid or context-invalid baselines, but do not disqualify them solely for unrelated new evidence, numeric-policy or facts validation failures.» Whole structural/context invalidity still grants no conservation; do not turn this into identity-only/per-row baseline qualification. Fresh candidate checks remain required; historical readability remains separate. Media ownership remains server-authoritative; no FE ownership source, new route/editing scope or exact-sequence save restriction inferred. Relayed to backend for target alignment.

S25. T6e reference/family admission. Exact c90e2e0 §4 excerpts:
> Axes must be bound;
> toyTypes resolve exact `toy.type` options, non-toy requires `[]`.
> Content magnitude maps mass→`measure.net_mass`, volume→`measure.net_volume`,
> count→`measure.content_count`, length→`measure.coverage.length`,
> area→`measure.coverage.area`; corresponding measure must be bound.
> Production permissions: consumable/animalApplied hygiene only; dimensions
> toy/hygiene/accessory/habitat/care; fit flag/codes accessory; capacity flag
> accessory, capacity codes accessory/habitat (accessory container only);
> electrical flag/codes accessory/habitat; presentationKind care only.
> Content magnitude and optional lists follow their bound/route checks in all seven.
> **S34 custom subset:** only contentMagnitude with bound canonical measure, and
> unknown or known-empty optionalNonpertinenceCodes. Reject nonempty optional lists
> and every production-only declaration, even unknown. Custom policy metadata does
> not confer production rights. Non-null careReview is care-only.
> Optional lists are further restricted to the selected family's exact `optional`
> fact_rule parameters, not `optional_equipment` or merely `when_asserted` bindings.
Backend seq35 retained S34 clarification (not new policy): «unknown contentMagnitude IS allowed for an admitted selected custom family even with zero bindings.» «family-key permission before unknown; unknown skips only value references; KNOWN magnitude resolves bound canonical measure.» Evidence reported domain/editorial-facts-references-v2.ts67–81 and spec306–329, guide18–20. Do not copy stale minimum-version language. Unknown optional lists also permitted for custom; known nonempty rejected. Existing family/document/subject/shape checks still apply.
T6e inspectEditorialFactsReferences({facts:EditorialSellableFacts[],family:EditorialFamily|null,vocabulary:EditorialContractVocabulary,context:EditorialContractContext}) returns deterministic issue array with rowIndex/declarationIndex where relevant, no save/publish verdict. Inputs are primitive-decoded rows and selected admitted/qualified metadata/context; capture S23 is separate and must NOT be called here (this reference layer can participate in S24 baseline qualification later without fresh-domain rules). Nonempty facts require selected family; every supplied row must match current actual sellable identity (empty variants→null, otherwise exact current variant ID), no inheritance or E-only filtering. Require declaration family permission before unknown skips value checks. For known values apply exact bound-axis/magnitude/toy-option/optional-route rules above; custom content known requires canonical bound measure, custom optional known[] allowed, all other custom declarations reject even unknown. Optional production codes must match selected-family binding's fact_rule with ruleId optional and exact parameter; no widening from when_asserted or optional_equipment. Accessory capacity list only container; habitat permits its bound capacity subset. Nonnull careReview restricted to care. No option/group/alias expansion or code trimming, current stock/E evaluation, evidence/fresh caps/numeric domains, contradiction checks or publication completeness. Preserve inputs, no helper/consumer changes. This partial reference inspector never replaces primitive/capture/basic/policy/conservation/server checks.

S26. T6f reference-only prerequisite implements S24 using existing S21/S22/S23/S25 identity/reference rules, not new domain admission. Add inspectEditorialDocumentReferences over primitive-decoded Document plus qualified vocabulary/context; return deterministic indexed issues only. Separate/export a reusable basic reference subset so existing inspectEditorialBasicAdmission reuses it WITHOUT changing its public result, issue codes/order, per-value aggregation, exclusions or decoded-document behavior. New full document inspector composes unchanged facts-reference inspector and local identity/reference checks; it does not authorize save/conservation by itself.
Reference-only coverage: family/null-content, unique media/assignment identities, current binding/owner/subject/type, exact choice/unit membership and multi uniqueness; unique fact subjects/declaration keys/known subset members; care requirement/warning key uniqueness in separate namespaces, each evidence-array exact pair uniqueness, warning requirementKeys uniqueness and local resolution. Evidence duplicates are identity checks, NOT evidence source/date admission. Unknown/NA still require binding/owner/subject validity but never supply previous known option payloads. All identities exact, collision-safe, no trim or alias/group expansion. Compose S25 family/current-context/value references for every fact row; missing family remains failure. Inputs already satisfy primitive scalar/finite/closed shapes, and metadata is already qualified; do not duplicate producer metadata admission.
Explicitly do NOT run fresh capture validators or filter their output to qualify history: no title/description/array caps, prose nonblank/length, evidence source/date rules, numeric range order/integer/bounds, readiness/contradictions/selected-policy checks, or media ownership/sequence restrictions. Oversized but unique referenced collections remain reference-valid. Existing primitive decoding remains outside this typed inspector. Whole-baseline qualification and exact archived matching are the NEXT unit, not implemented here.
Preserve inspectEditorialBasicAdmission behavior exactly, including root order, ascending valueIndex, EVIDENCE after DUPLICATE_VALUE and before other value checks, numeric-domain errors after UNIT_UNKNOWN, and no new facts/care-reference errors in that partial API. Keep its existing tests unchanged and compare representative results with the base revision in a scratch-only differential probe; no committed tests reading Git history. Risk:item3 because shared basic-inspector implementation changes; independent verification required even though no live consumers change.

S27. T6g archived conservation, exact c90e2e0 §8:
> Archived assignments conserve only identical family/definition/owner/variant/type/
> option identity: save baseline is stored Draft; publish baseline current Published
> (null→empty), initialize source Published. No new/moved/re-added archived option.
> Invalid baseline grants no conservation; corrected fresh candidates remain possible.
> Valid conservation warnings use exact IDs/fields above; fresh empty warning array
> omitted, GET does not fabricate warnings from invalid history. Recorded warnings
> are preserved exactly, including ordering/presence, never rebuilt on replay.
Apply human S24 and verified S26: qualifyEditorialConservationBaseline(raw,vocabulary,context) returns detached primitive-decoded document iff the entire reference-only inspector has no issues, else null. Never use fresh-capture/basic validators; unrelated fresh prose/evidence/numeric-domain/cap failures do not invalidate baseline. Null/absent Published gives empty conservation, not a fabricated document. Current qualified metadata resolves both baseline/candidate family/definition IDs from exact codes; documents contain no historical IDs, so do not invent historical-ID comparison.
inspectEditorialArchivedConservation({document:unknown,baseline:unknown,vocabulary:EditorialContractVocabulary,context:EditorialContractContext}) returns `{document:EditorialContractDocument|null,issues:EditorialConservationIssue[],warnings:EditorialArchivedWarning[]}`. Decode candidate and require its reference integrity before matching; structural/reference failures return nonempty diagnostics and no warnings, no partial pruning. This is only reference/conservation inspection, never a fresh-save/publication verdict. On valid referenced candidate, compare each known single/multi selected archived option against qualified baseline's known choices using exact resolved family/definition, owner, nullable subject, payload type and option. Unknown/NA/omission/active alternatives do not conserve an archived selection. Match individual multi members; no same-label/group/alias/trim/sibling transfer. Removed archived options produce no warning; re-add after baseline removal fails. Invalid baseline alone is not an error when candidate has no archived selections. Warnings follow unchanged candidate value/option order and exact S17 fields with current IDs; diagnostics identify valueIndex/optionCode for unconserved archived choices. Warnings array here is helper output, not a wire envelope; caller omits fresh empty arrays, and never uses helper to rebuild recorded acknowledgements.
Caller supplies correct baseline explicitly: save=stored Draft, publish=current Published, not local edits/Draft as publish authority. Tests show identical candidate differs when given those baselines, but no lifecycle state owner is added. Initialize remains server copy behavior unchanged. No media ownership/sequence checks, family switches/UI/API/runtime integration or other admission policies. Existing helper/source/test files unchanged.

S28. Backend seq37 authority handoff: verbatim c90e2e0963faa538e41c92d62e6778b92437e181 docs/catalog-editorial-single-contract.md:464–486. Historical TARGET, not current runtime evaluator proof; S24 baseline clarification and S25 custom unknown clarification remain authoritative.
> Each binding selects exactly one route, never option matching after fact_rule.
> For option_cases: AND tests; empty when unconditional. Read each tested binding's
> owner/subject (product→null; sellable→current subject). Known single is a singleton,
> known multi its exact set. equals_set means equality, contains_all means all expected
> members, intersects means any common member; order ignored. Expected sets nonempty;
> missing/unknown/NA never match. No aliases/groups/evidence prerequisite for matching.
> Exactly one case must match; zero/multiple/pending fails closed as unresolved. Static
> checks reject contradictory/overlapping custom cases and selector dependency cycles.
>
> For every E subject evaluate always bindings, including absent assignments, plus
> when_asserted bindings with known/NA assertion and selected option-case dependencies.
> Omitted/unknown optional assertions do not seed evaluation. Potentially required
> cases must be always; dependencies are not unrelated mandatory evidence checks.
> NA admission requires selected applicability=not_applicable AND allowNA=true;
> applicable/unresolved forbids NA. Known assertions contradicting a selected NA result
> may save but cannot publish. Required implies applicable, and requires known at
> publish; unresolved evaluated applicability/documentary status blocks. Required
> single/text/multi must be nonempty (ECMAScript trim only to test text emptiness);
> valid boolean/number/range can satisfy required. Optional known false/empty remains
> a known assertion. Policy `documentary` is readiness metadata, never product legal
> compliance or evidence. Product-owned rules evaluate once, not once per variant.
Backend boundary verbatim: «These are invalid-input cases, not additional members of §7's explicit missing/unknown/NA nonmatch list. There is no completed BE runtime option-case helper/test to cite for an invented wrong-type fallback result or new public error/result union.» Wrong payload type/reference integrity must remain distinct from selected-policy unresolved. Metadata admission requires bound same-family single/multi selectors; cross-owner selectors are allowed. Existing static overlap oracle is not a runtime evaluator. No FE authorization of backend budget exception or delivery.
T6h scope is being mapped before implementation: typed option-case selection for already qualified metadata/reference-valid documents, explicit current subject, no fact_rule fallback; NA predicate uses selected applicability and allowNA only. Full evaluation seeds/dependency traversal, E eligibility, production fact_rule engine, publication readiness and lifecycle integration remain separate unless exact later scope is recorded. No new wire errors or guessed runtime behavior.

T6h implementation boundary after explorer mvuckmr1-q-eonu and parent spotcheck document-references.ts:24–64: selectEditorialOptionCase accepts pending/option_cases only, selected family, qualified definitions, reference-valid values and explicit currentSubject. Pending/zero/multiple returns null; unique case returns detached case. Caller has already qualified same metadata and all document references; this helper does not replace those gates. Missing tested binding/choice definition, mismatched known payload (including single versus multi), or runtime fact_rule misuse throws a local invariant Error, distinct from unresolved; no new wire error/result union. Match tested binding owner, never target owner; caller schedules product rules once separately. No subject iteration/dependency traversal/fact evaluation. allowsEditorialNotApplicable accepts applicability/allowNA (or null) and implements only the required conjunction; null denies. New module and tests only, existing helpers unchanged. Test-first inline unit with focused regressions/types; no UI/API/permissions change.

S29. T6i authority: backend seq38 supplied historical c90e2e0 policy-mapping §1/§2/§4 verbatim; seq39 correction withdraws claim that S35 §7 explicitly cites §2/§4. S35 §5 links §1; mapping labels resolve normative and earlier joint acceptance is reported, not new runtime proof. S35 and S24/S25 prevail; no minimumContractVersion, old E definition, provisioning/checker execution or wire revival. Any concrete discrepancy requires clarification before implementation.
Exact mapping §2:
> Outcomes [applicability,required,allowNA,evidenceRequired,documentary]: O=[applicable,false,false,true,resolved], R=[applicable,true,false,true,resolved], N=[not_applicable,false,true,true,resolved], U=[unresolved,false,false,true,resolved]. Documentary resolved means this policy is specified, NEVER actual care/legal clearance. Conflicts yield U/reject when evaluated. For E, independently reject a known false fit/capacity/electrical flag with its known nonempty subset, mismatched toyTypes, or content.kind contradicting known contentMagnitude, even if no attribute assertion seeds a rule; missing optional inputs alone are not conflicts.
> The checker function `resolve` below is the normative finite decision table over **already shape/evidence-validated** facts: missing/None=omitted/unknown; false/[] are explicit evidenced known findings. It covers every route, family and parameter without expression evaluation. Project declaration key→value only for known, otherwise None: dimensions=relevantDimensionCodes.codes, fits=relevantFitCodes, capacities=relevantCapacityCodes, equipment=relevantEquipmentCodes; all other helper keys equal declaration keys. Before resolving E, require dimension toyTypes=selected known toy.type exactly for toy (including empty negative findings), [] otherwise. Fact evidence validation precedes trusting any negative.
Exact route table/helpers from mapping §4 (specification text only; do not execute documentation checker):
```python
content = dict(zip(['mass','volume','count','length','area'],['measure.net_mass','measure.net_volume','measure.content_count','measure.coverage.length','measure.coverage.area']))
def subset(c,x,required=True): return 'U' if x is None else ('N' if not x else ('R' if required and c in x else 'O'))
def flag(c,x,ss,required=True):
    if x is False: return 'U' if ss else 'N'
    if x is True: return 'U' if not ss else subset(c,ss,required)
    return 'U' if required else 'O'
def resolve(f,c,r,x):
    if r=='required': return 'R'
    if r=='optional': return 'N' if c in (x.get('optionalNonpertinenceCodes') or []) else 'O'
    if r in {'animal','form'}: return 'N' if x.get('animalApplied' if r=='animal' else 'consumable') is False else ('R' if x.get('animalApplied' if r=='animal' else 'consumable') is True else 'U')
    if r=='content':
        if f not in {'food','treat','hygiene','care'}: return 'O'
        if f=='hygiene' and x.get('consumable') is False: return 'N'
        if f=='hygiene' and x.get('consumable') is not True: return 'U'
        k=x.get('contentMagnitude'); return 'U' if k not in content or (f=='treat' and k not in {'mass','volume','count'}) else ('R' if c==content[k] else 'O')
    if r=='dimensions': return subset(c,x.get('dimensions'))
    if r=='space':
        if x.get('dimensions') is None or x.get('capacities') is None: return 'U'
        return subset(c,x['dimensions'] if c.startswith('measure.dimensions.') else x['capacities'])
    if r in {'fit','capacity','equipment','optional_equipment'}:
        a,b={'fit':('fitDeterminesChoice','fits'),'capacity':('capacityDeterminesChoice','capacities'),'equipment':('electricalApplies','equipment'),'optional_equipment':('electricalApplies','equipment')}[r]
        return flag(c,x.get(a),x.get(b),r!='optional_equipment')
    if r=='presentation': return 'U' if x.get('presentationKind') not in {'formulation','device','packaging'} else ('R' if c=={'formulation':'care.form','device':'care.device','packaging':'pack.form'}[x['presentationKind']] else 'O')
    raise AssertionError(r)
```
Implementation boundary: resolveEditorialFactRule(rule:EditorialFactRule,facts:EditorialSellableFacts|null):EditorialRuleResult. Caller supplies one selected subject row (or null), already shape/evidence/reference-validated, and one admitted production fact_rule from the qualified snapshot. The FE metadata qualifier alone is NOT full production dispatch admission; do not claim otherwise. Projection uses only known declaration values; absent/unknown=null, known false/empty preserved; no sibling/product fallback. Return fresh detached five-field outcome, no mutation. Local exhaustive-rule invariant failure is programmer misuse, not a new wire error. Exactly the twelve routes above; no fallback option matching, custom borrowing or implicit route selection from parameter prefixes (space's documented axis distinction only).
No production provisioning/dispatch validator or mapping expansion, E scheduling, independent fact contradictions/toyTypes equality, per-value evidence/readiness, care checks, NA whole-document admission, save/publication authority or integration in this unit. Preserve all existing helpers. Tests use public resolver for all twelve routes and complete flag/subset branches, every magnitude/presentation selection and other-measure optionality, null/unknown projection equivalence, optional-equipment special required=false semantics, selected-row isolation and frozen input/output detachment. Negative findings are trusted only under documented prerequisites; do not silently accept raw invalid evidence as proven facts.

S30. Human decision after backend seq40 confirmed undefined product-owned rule aggregation. Question: «How should product-level rules handle dependencies on variant-level choices? For example, variant A permits “not applicable” but variant B forbids it.» Selected «Keep product rules product-only (recommended)» (product_rules_product_selectors_only). Exact selected description: «Reject policy metadata where a product-level rule depends on a variant-level selector. Variant-level rules may still read product-level selectors. This avoids ambiguous aggregation.» This supersedes S16/S28 unrestricted cross-owner acceptance only for product target→sellable selector. Product→product, sellable→product and sellable→sellable remain permitted. Apply to every option-case test, including inactive/unmatched cases, with whole metadata rejection, no pruning. Pending/unconditional cases unaffected. Reuse existing graph checks; no all/any/first/null or E aggregation. Parent relayed human decision to backend before source change; seq41's earlier recommendation is not additional authority.
T3d narrow qualifier/test amendment: table covers all four owner directions and ensures primitive vocabulary decoding still preserves structurally valid metadata independently of admission. No other public helper/API/runtime changes. T6j read-only map confirmed basic+facts/care+conservation composition is separable; selected-NA composition follows this prerequisite.

S31. T6j isolated fresh-candidate capture/conservation composition of S21/S23/S26/S27, after read-only map mvud8f6g-r-v3ck and parent readback of basic/conservation APIs. inspectEditorialCandidateCapture({document:unknown,storedDraft:unknown,vocabulary,context}) returns detached candidate or null, stage-separated basicIssues, factsCapture ('not_checked'|'valid'|'invalid'), referenceConservationIssues (null if not checked), and conservation-only warnings. No overall valid/canSave/canPublish result. Structural failure returns only basic STRUCTURE, skips facts/baseline/reference/conservation and yields warnings[]. On decoded input, retain exact basic issues/order, run facts capture once (already includes care), and run unchanged conservation on detached candidate with storedDraft explicitly as baseline; conservation already includes whole references. Do not separately rerun full-reference/care checks. Preserve stage overlap explicitly, never concatenate/deduplicate away diagnostics; facts invalid is aggregate, no invented row/cause. Conservation warnings may coexist with capture/basic errors and never imply overall acceptance. Baseline must remain primitive/reference-only, never fresh-capture validated. Repeated decoding inside unchanged public helpers is intentional, not a refactor requirement.
Vocabulary/context are already qualified for the same scope; this helper does not establish production dispatch admission. Selected NA remains a separate subsequent stage (T6k), despite S30 resolving product subject ambiguity. Media ownership, framework serialized size, permissions/CAS, policy completeness/known-fact consistency/E/care readiness/publication are NOT evaluated. Never use for initialize copies, GET or receipt replay. Existing helper source/tests remain unchanged. Tests assert structural short-circuit/getter safety, all-stage diagnostics and ordering, incomplete/pending drafts, captured care validation without readiness, invalid versus fresh-invalid baseline, archived warning independence, exact storedDraft choice, frozen inputs and detached output. No API/UI/runtime integration.

S32. T6k selected-NA-only inspection composes unchanged S28/S29 helpers after S30 qualification and successful fresh candidate capture/reference gates. Exact target rule (S28): «NA admission requires selected applicability=not_applicable AND allowNA=true; applicable/unresolved forbids NA.» inspectEditorialNotApplicableAdmission({document:EditorialContractDocument,vocabulary:EditorialContractVocabulary}) returns ordered {code:'NA_NOT_ALLOWED',valueIndex}[] for explicit not_applicable assignments only. It is not overall save/publication authority. Caller already establishes same-scope qualified metadata (including S30), all candidate shape/capture/evidence/reference integrity and admitted production dispatch; ordinary FE metadata qualification alone is not full production dispatch proof. No revalidation/filtering of raw invalid evidence here; local missing family/binding is a programmer invariant failure, not policy unresolved or a wire error.
Resolve each explicit NA once using its actual binding: pending denies; option_cases calls exact selector helper with currentSubject=value.variantId (product null is unambiguous because S30 forbids sellable selectors; sellable reads its own subject plus product selectors). fact_rule calls production resolver with only the exact-subject facts row or null; never option-case fallback, inheritance or sibling lookup. Apply conjunction only, no documentary/evidence-requiredness inference. Ignore omission/unknown/known, including known assertions contradicting selected N (draft correction allowed), without evaluating their rules. No E filtering; check all supplied explicit NA including inactive subjects. Preserve order/inputs and return no permission boolean. S31 and this typed inspector stay separate until integration can enforce prerequisites; no runtime/editor changes. Tests cover all policy routes, zero/multiple/pending, NA flag truth table, exact subject isolation/product lookup/simple null, missing/unknown fact projection versus evidenced false/empty, known contradictions skipped, ordered mixed failures and frozen data. Existing helpers unchanged.

S33. T7a raw assignment input foundation for S4/S8 target controls. Parent spotchecked existing EditorialAttributeField.vue:44–85 (flat assignments/local NaN sentinel) and target value/definition primitives. New pure mapper only, no Vue/runtime changes in this unit. Component boundary for subsequent T7b: controlled target attribute field receives definition, target identity, parent-owned raw input, disabled state and conservation/diagnostic presentation; emits raw input updates, never owns HTTP/buffer/history. Existing draft owner must retain raw incomplete input across remount/reconciliation; mapper alone does not prove that integration. Keep existing Spanish style/tokens, browser checks when actual UI changes.
EditorialAssignmentInput distinguishes omitted, unknown, not_applicable and known. Known payload inputs preserve text/single/multi strings, boolean true/false/null (null=unselected), number/range raw decimal strings, and unit undefined (unselected) versus number unit null (actual no-unit choice). Single null means unselected, unlike explicit known text/choice strings or empty multi. Evidence null is deliberate absence; evidence object with blank/partial/invalid fields is incomplete, never silently dropped. toEditorialAssignmentInput takes primitive-decoded saved assignment or null, returns detached input preserving values/evidence and finite numeric spelling via String; no metadata/fresh revalidation of history. resolveEditorialAssignmentInput(target,input) returns {status:'complete',assignment:EditorialValue|null} or {status:'incomplete'} without any old-assignment fallback. Complete means control encoding only, NOT fresh admission/NA/reference/conservation authority. Omitted yields null; unknown/NA have null evidence/no payload. Known input converts only finite decimal/exponent numeric text (optional leading minus, decimal point, exponent sign; no whitespace-only/hex/Infinity/NaN/numeric junk; no silent blank-to-zero), requires selected boolean/single/unit, range unit nonnull, and validates supplied evidence with S20. Exact text/evidence preserved; no trim storage/unit conversion. Primitive assignment reader provides detached closed output. Numeric domain/range ordering, membership/archive checks, requiredness and selected NA stay downstream. Typed local input is not a new wire schema. Tests cover all6payloads/states, false/empty, invalid/partial numbers and evidence, unit distinction, no old valid fallback after raw-state serialization, immutable inputs and history-to-control roundtrip. No new media capability.
Explorer integration recommendation to remove the media publication restriction is rejected: exact S35 §3 says «Publish additionally requires non-null ECMAScript-trim-nonblank title and media `[]`; preserve strings exactly, never trim on storage.» This restriction remains; do not infer it from ownership or discard drafts automatically. E/live publication controls and final authority remain server-owned.

S34. T7b controlled target attribute field, S4/S8/S33. New EditorialContractAttributeField.vue only, unmounted from active editor until coordinated cutover. Props: id, definition, target identity, modelValue raw EditorialAssignmentInput, disabled, optional issue and conservedOptions (exact option codes supplied by caller from qualified baseline/identity, display hint not save authority). Emit update:modelValue on each edit including incomplete numeric/evidence input; never retain a saveable old assignment or reset on remount. Parent owns raw input; component owns no history/store/HTTP. Spanish state choices distinguish Sin asignación / Desconocido / No aplica / Valor conocido. Explicit state changes may drop payload/evidence; never auto-select known false, option, unit or evidence. Known defaults: empty text/multi, unselected boolean/single, blank number/range and unselected unit. Controlled six payload controls; raw number/range text inputs preserve partial strings, unit null distinct from unselected. Existing mismatched payload type stays visible as an issue until explicit state correction, not converted. Known evidence null has Añadir evidencia; explicit removal yields null; source/date text preserve partial input. Labels/IDs/error associations, keyboard focus, disabled attributes AND handler suppression; no unsafe HTML.
Preserve exact option order/labels, archived annotations and disabled nonconserved archived choices; missing selected codes/units remain visible with No disponible text, not pruned. No alias/group expansion or own baseline qualification. Use existing --hf-* tokens/native control style, minimum44px controls/focus outline and responsive evidence/range layout. No redesign or new theme/dependency. Controlled wrapper tests must retain raw numeric/evidence text across keyed child remount with parent alive and mapper still incomplete; all states/payloads, false/empty/unit-null, archive/missing, disabled event suppression, immutable props and evidence handling. Browser isolated scratch entry excluded from delivery, actual component mounted without src/main.ts/router/auth, local-only requests, wide/narrow light/dark screenshots+functional checks; externally imported fonts blocked so disclose system fallback. No actual app cutover proof from fixture. Existing components/tests untouched.

S35. T7c declaration input leaf foundation (implementation decomposition of S4/S8/S11/S20/S33, not a change to the backend target S35). New utils/editorial-contract-declaration-input.ts and its __tests__/editorial-contract-declaration-input.spec.ts only. Export EditorialDeclarationInput, EditorialDeclarationInputResult, toEditorialDeclarationInput(declaration: EditorialDeclaration|null), resolveEditorialDeclarationInput(input). Input omission is {state:'omitted'}; unknown carries exact key/state only; known carries exact correlated key/value, evidence:EditorialEvidence|null (null is locally unselected, not a valid known wire declaration), and basis:string. Boolean and finite enum values additionally permit null as locally unselected; object/list values retain their exact existing shapes, with [] a real known value. No declaration NA or number branch. Reuse existing declaration types/static finite unions; do not widen them to arbitrary strings. toInput receives primitive-decoded history or null and returns deeply detached raw state, preserving strings, false, ordering, nested dimension/toy arrays, evidence and even fresh-invalid prose/evidence/history without fresh validation. resolve returns {status:'complete',declaration:EditorialDeclaration|null} or {status:'incomplete'} only; no previous declaration parameter/fallback. Omitted yields null; unknown encodes exact key/state/evidence:null; known unselected value/evidence or invalid supplied evidence (S20) is incomplete. Reuse isFreshEditorialEvidence and the existing detached primitive declaration decoder for output. All string values/basis preserve exact spelling; empty/overlong basis and other primitive-readable but fresh-invalid capture content remain encoding-complete and are rejected by downstream capture, not silently repaired here. Completion is encoding only, NOT references/family admission/production dispatch/save/publication permission. No state-transition/reset factory, row ownership, UI, HTTP, token/revision, new dispatch rules or edits to shared helpers. Tests: all12 correlated keys, omitted/unknown/known, null-unselected vs false/known[]/empty dimension arrays, explicit evidence null/partial/invalid/calendar, exact strings and order, frozen inputs/deep detachment both directions, history roundtrip without fresh validation, known invalid basis remains downstream, primitive invalid value fails atomically, raw edit→incomplete never old-known fallback. Source API comments document trust and completion boundaries. Separate work-unit commit after parent verification.

S36. T7c care input leaf foundation (implementation decomposition of S4/S8/S12/S20/S22/S33). New utils/editorial-contract-care-input.ts and __tests__/editorial-contract-care-input.spec.ts only, independent of S35 declaration mapper. Export EditorialCareReviewInput, EditorialCareReviewInputResult, toEditorialCareReviewInput(review:EditorialCareReview|null), resolveEditorialCareReviewInput(input). Raw states distinguish {state:'omitted'}, {state:'unknown'}, prepared. Prepared retains all exact existing content fields; determination additionally allows null (unselected); each requirement disposition and warning disclosure additionally allow null. Prose/date/source fields remain raw strings; evidence arrays, requirement/warning arrays and requirementKeys preserve ordering, duplicates and dangling edited references without cascaded changes. No new local IDs or rename/delete/transition helpers in this leaf mapper; UI identity/reset decisions belong to later controls. No revision/token fields exist in care content; request review-v1 and lifecycle R/CAS remain outside. toInput takes primitive-decoded history or null, deeply detaches and preserves even fresh-invalid content without fresh revalidation. resolve returns {status:'complete',careReview:EditorialCareReview|null} or {status:'incomplete'}; omitted yields null, unknown encodes {state:'unknown'}, any unselected enum or invalid supplied evidence entry at any depth makes the whole result incomplete, without pruning or old-value fallback. Empty evidence arrays are explicit and permitted. Reuse isFreshEditorialEvidence and existing detached primitive care decoder. Other primitive-readable fresh-invalid prose, list caps, duplicate requirement/warning keys, dangling warning requirement references and contradictory/unresolved dispositions are retained as encoding-complete; existing capture/reference/readiness stages decide their admissibility. Do not call whole-care fresh validation to convert completion into permission. Tests cover all states/enums and null-unselected variants including child rows, empty arrays, evidence invalid/partial at each depth and atomic failure, exact text/order/duplicates/dangling references preserved, frozen inputs/deep detachment both ways, stored history roundtrip without fresh validation, supplied raw edit cannot restore previous valid value. No UI, facts composition, family reset, save/publication authority, token or revision. Source API comments document the boundaries. Separate work-unit commit after parent verification; this unit must not depend on S35 worker files.

## Tasks
T1 | S1,S3,S4 | delegated (context backstop) | done | Worker assertion RED11fail/36pass then GREEN49pass; parent full3file readback/diff-check and job-3 exit0 after20s:139/139 across6files, app vue-tsc exit0. LSP1unconfirmed plus7auxiliary hints; typecheck provides type evidence. ASSESS unavailable for untracked scope, not approval. Risk:none. Commit2cd9acb15524d1548912ad2b6e654863f65c6c81 (328 authored lines incl tracking); delivery feature-branch-chain; no live integration. Native assessment unavailable even committed-only; no native approval claimed.
T3a | S3,S9,S10 | delegated (context backstop) | done | Worker assertion RED71fail/26pass then GREEN97. Parent full readback and job-4 exit0 after17s:146/146tests across2suites, explicit test-file tsc and app vue-tsc pass. LSP1auxiliary unknown-input hint only. Native assess unavailable/untracked, not approval. Risk:none; no existing consumer/helper changed. Commit00ec542f73550b8eb52959f1e6f28936cefa69a7 (319 authored lines including tracking); no metadata integration.
T2a | S3,S4,S9,S11 | delegated (context backstop) | done | Worker RED33fail/61pass then94/94GREEN. Parent readback and job-5 exit0 after26s:191/191tests, explicit test-file tsc and app vue-tsc passed. Only3additive exports in existing helpers, bodies unchanged; Risk:none. LSP11auxiliary hints/warnings only; no type errors. Native assess unavailable, no approval. Commita46db57e3de7f1a13d0e3912d4a9e54a03c59d6a (371authoredlines incl spec/evidence); no integration.
T2b | S3,S4,S12 | delegated (context backstop) | done | Worker assertion RED34fail/58pass then93/93GREEN. Parent full3file readback and job-6 exit0 after19s:235/235tests, explicit care-test tsc +app vue-tsc pass. LSP2auxiliary findings only. Native assess unavailable/untracked, no approval. Risk:none, helpers unchanged. No publication/UI integration; commit6c11e0950e256a45ad2680c7bc134300cc30f563 (312authoredlines incl spec/evidence).
T2 | S3,S4,S6,S9,S13 | delegated (context backstop) | done | Worker assertion RED6fail/153pass then159/159GREEN. Parent full3file readback and job-7 exit0 after19s:256/256tests +explicit document-test tsc +app vue-tsc pass. LSP6auxiliary findings only. Native assess unavailable, no approval. Risk:none; helpers/consumers unchanged. Commitd596024340b0de4edde616cc12e8dae021e73cd1 (300authoredlines incl spec/evidence).
T3b | S3,S9,S14 | delegated (context backstop) | done | Worker assertion RED20fail/201pass then223/223GREEN. Parent full3file readback and job-8 exit0 after20s:430/430tests +explicit definition-test tsc +app vue-tsc passed. LSP2auxiliary findings only. Native assess unavailable, no approval. Risk:none; helpers/consumers unchanged. Commitee831c744663bff7bfc565a93863553bef7aaadb (353authoredlines incl spec/evidence).
T3c | S3,S9,S15 | delegated (context backstop) | done | Worker RED113fail/310pass then425/425GREEN. Parent full readback +Family obsolete-field regression; job-9 exit0 after21s:681/681tests +explicit vocab-test tsc +app vue-tsc pass. LSP3unconfirmed, explicit typechecks provide proof. Risk:none, no helper/consumer change. Native assess unavailable, no approval. Commit13abb12a764aa844f2ee6ef7f1f5a9db3f3cc880 (399authoredlines incl spec/evidence).
T3 | S3,S9,S16 | delegated (context backstop) | done | Worker45intended assertionRED plus1fixed test-helper failure, final319/319GREEN. Parent full2file readback and job-10 exit0 after24s:749/749tests +explicit qualifier-test tsc +app vue-tsc passed. LSP2unconfirmed; explicit types proof observed. Risk:none, helpers/consumers unchanged. Native assess unavailable, no approval. Commita09cd572cc78e0c10edb6ad013498602587b1855 (379authoredlines incl spec/evidence).
T4a | S3,S5,S17 | delegated (context backstop) | done | Worker369lines; RED20assertion failures/248passes, final281/281GREEN. Parent full3file readback; job-11 exit0 after24s:941/941tests across9suites +response-test tsc +app vue-tsc passed. LSP3unconfirmed, native assess unavailable/untracked (no approval). Risk:none; no HTTP/helpers/consumers changed. Commit1448aab2984111939d7740fef6cb08248a48c2b3 (409authoredlines including specs/evidence).
T4 | S3,S5,S18 | delegated (context backstop) | done | Worker334lines, RED65assertions/26existingpasses and GREEN97/97. Parent read3files; job-12 exit0 after27s:1038/1038tests across11suites, alias-aware scoped API-test vue-tsc and app vue-tsc passed. LSP2unconfirmed plus intentional 2^53 test-literal hint. Native assess unavailable/untracked, no approval. Risk:none; shared auth/current consumers untouched; commitef0f3d45861f0a82e9cad986077a04a676f78e67 (336authoredlines).
T5a | S5,S19 | delegated (context backstop) | done | Worker RED8fail/10pass, GREEN18/18. Parent full2file readback/LSP2clean; job-13 exit0 after25s:1056/1056tests, test-tsc/app-vue-tsc passed. Independent mvua8iil-g-2uop PASS S5/S19, isolated scratch18/18tests, no findings or repo mutation. Risk:item4 concurrency verified for isolated helper only. Native assess unassessable/untracked, no approval. No runtime cutover; commitda9671577dfd0e762bf4400215c29fe5e0a99b9b (313authoredlines).
T5 | S5,S6 | delegated (context backstop) | pending | Explorer mapped lifecycle and parent spot-checked editor55–92: independent installation/no R confirmed. Existing lifecycle retains sole buffer/intent ownership; coordinated cutover depends on T6/T7/T8. No consumer changes yet; commit pending.
T6a | S4,S20 | inline | done | Pure evidence validator +100public tests. RED20assertionfailures/80passes; job-14 exit0 after23s GREEN1156/1156tests across13suites +explicit test-tsc/app-vue-tsc passed. LSP initial missing-module finding stale, compiler proof passed; advisory lint only. Risk:none, existing readers unchanged. Native assessment unavailable, no approval. Commit5544db709f34591526bbc1a63b5e01925d8c8991 (90authoredlines).
T6b | S4,S6,S20,S21 | delegated (context backstop) | done | Worker308lines/47tests; RED32assertionfailures/112passes, GREEN147/147. Parent full readback; job-15 exit0 after31s:1203/1203tests across14suites, explicit test-tsc/app-vue-tsc passed. LSP no compiler errors, advisory imports/nested ternary only. Native assess unavailable/untracked, no approval. Risk:none, existing helpers/consumers unchanged. Explicitly partial; no save authorization/media ownership/conservation/selected policy. Commit4b03b78877374a333fd99edf3c74ee64734978b5 (341authoredlines).
T6c | S11,S12,S20,S22 | delegated (context backstop) | done | Worker278lines/34tests; RED32fail/2pass, GREEN178/178. Parent full2file readback; job-16 exit0 after27s:1237/1237tests across15suites +care-test-tsc/app-vue-tsc passed. LSP no compiler errors, advisory imports/unknown-boundary hints. Native assess unavailable/untracked, no approval. Risk:none, existing consumers/helpers unchanged; capture-only, not publication readiness. Commit6276475953a577942f6e4633c7fc366f8c431006 (296authoredlines).
T6d | S11,S13,S20,S22,S23 | delegated (context backstop) | done | Worker268lines/54tests, RED22assertionfailures/85passes (empty-array parameter expansion corrected), final109/109GREEN. Parent full2file readback; job-17 exit0 after29s:1291/1291tests across16suites +facts-test-tsc/app-vue-tsc passed. LSP no compiler errors, advisories only. Native assessment unavailable/untracked, no approval. Risk:none; existing helpers/consumers unchanged. Capture-only, no family/context/reference authorization. Commit969e4ee6743f5d9558a2b03043f26d4c80c4b089 (293authoredlines).
T6e | S9,S11,S24,S25 | delegated (context backstop) | done | Worker309lines/298tests; RED159assertionfailures/89passes, GREEN352/352. Parent full2file readback; job-18 exit0 after29s:1589/1589tests across17suites +reference-test-tsc/app-vue-tsc passed. LSP no compiler errors, advisories only. Native assess unavailable/untracked, no approval. Risk:none, existing helpers/consumers unchanged. Reference-only, no whole-save authorization or integration; commitb5b0138c6eabd291646ba991530700766c53e40c (332authoredlines).
T6f | S6,S24,S25,S26 | delegated (context backstop) | done | Worker mvubtyu1-n-u75z delivered reference extraction; RED10fail/3pass, final365/365 including scratch differential54/54 identical public results. Parent read3files/probe; job-19 exit0 after29s:1609/1609tests across19suites (includes differential), explicit2test-tsc/app-vue-tsc passed. LSP no compiler errors/advisories only. Independent mvuc21sr-o-nnyi PASS S24/S25/S26:365/365tests in isolated scratch,54/54 differential results identical, baseline provenance verified, no repo mutation. Risk:item3 independently verified. Native assess unassessable/untracked, no approval. Scratch .editorial-reference-differential.MuKSU8 excluded from delivery. No baseline/conservation/integration yet; commit1f77d43bc3ada8e6f23fed14b0f5aa64924bf36f (346authoredlines).
T6g | S6,S17,S24,S26,S27 | delegated (context backstop) | done | Worker272lines/52tests; RED45fail/20pass, final71/71GREEN (test-helper undefined-default corrected). Parent full2file readback; job-20 exit0 after30s:1660/1660tests across19suites +conservation-test-tsc/app-vue-tsc passed. LSP no compiler errors/advisories only. Native assess unavailable/untracked, no approval. Risk:none; existing helpers/consumers unchanged, explicit caller baseline, no lifecycle/full-save authority. Commit d044b82d38b7cd5ac9ffe0b49011281f01d6e7fa (287authoredlines).
T6h | S4,S6,S9,S15,S16,S28 | inline | done | Explorer map reviewed/reference spotcheck; pure selection+NA, explicit subject and distinct invariant failures. RED18fail/20pass→GREEN57/57 across2suites+testtsc. Normalization fixture made metadata-valid afterward. Expanded job-21 exit0 after28s:1698/1698tests across20suites/testtsc/appvue-tsc/diff-check passed; commit c6baa1b833af548b31aefce58a5fe51802436a73 (217authoredlines). LSP no compiler errors, exhaustive-union switch advisory only. Native assess unavailable/untracked, no approval; initial codemode call refused then direct assess returned. Risk:none, existing helpers unchanged; no publication/integration authority.
T6i | S6,S9,S15,S28,S29 | inline | done | Backend seq38 mapping/seq39 precedence correction retained. Bounded typed twelve-route resolver implemented with36tests; RED26fail/10pass, test union typing corrected; GREEN74/74 across2suites+test-tsc. Expanded job-22 exit0 after30s:1734/1734tests across21suites/testtsc/appvue-tsc/diff-check passed. LSP no compiler errors, nested-ternary advisory. Native assess unavailable/untracked, no approval. Risk:none, existing helpers unchanged; prerequisites and separate E/conflict/publication gates explicit. Commit5fefd2889521b3e57fc8d02f33d1ac4fdaffc05f (275authoredlines).
T3d | S16,S28,S30 | inline | done | Human restriction implemented narrow guard+5tests; RED1fail/72pass. Parent job-23 exit0 after33s:1739/1739tests across21suites/testtsc/appvue-tsc/diff-check passed. Risk:item3 shared qualifier verified; independent mvudfz4d-s-s4k0 PASS S30:129/129tests across3suites, exit0, authorized workspace fallback, no unexpected mutation. All-case coverage by inspection; graph implementation unchanged, existing cycle fixtures may reject earlier at owner guard. Native assess unavailable/untracked (escalation acknowledged), no approval. Backend seq42 acknowledged human decision as S44, no backend runtime change claimed. Commit593072a88cf81f08bba36a52b716a407e7475011 (37authoredlines).
T6j | S6,S20-S31 | inline | done | Implemented stage-separated capture/reference/conservation composer+11tests; RED11fail, intermediate10pass/1test expected diagnostic corrected to unchanged subject code. Final job-24 exit0 after33s:1750/1750tests across22suites/testtsc/appvue-tsc/diff-check passed. LSP no compiler errors/import advisories only. Native assess unavailable/untracked, no approval. Risk:none, existing helper bodies unchanged. Selected-NA composition remains T6k. Commit0ae401dc0dbf71faa713df5f56c1823287745661 (171authoredlines).
T6k | S28-S32 | inline | done | Typed explicit-NA-only inspector+18tests; RED14fail/4pass→GREEN18/18+testtsc. Parent job-25 exit0 after29s:1768/1768tests across23suites/testtsc/appvue-tsc/diff-check passed. Risk:none; existing helpers unchanged, prerequisites documented, no overall save verdict/integration. Native assess unavailable/untracked, no approval. Commit2082f937008a429fa95f50ab3e91fb081a8982e5 (179authoredlines).
T6 | S4,S6,S9,S20-S32 | parent orchestration | pending | Capture/reference/conservation/selected-NA foundations verified through2082f93; map remaining frontend integration requirements before new implementation. Server media ownership/E remain authoritative; no all-context-subject publication gate or new route. Existing editor unchanged; no overall T6 completion.
T7a | S4,S8,S33 | inline | done | Pure raw assignment mapper+46tests; RED27fail/19pass→GREEN46/46+testtsc. Corrected test fixture return union typing; tsc confirms prior LSPerror stale. Job-26 exit0 after30s:1814/1814tests across24suites/testtsc/appvue-tsc/diff-check passed. LSP re-probe2unconfirmed (push-only); explicit compiler checks provide type proof. Risk:none, existing helpers unchanged. Native assess unavailable/untracked, no approval. No component/runtime change/browser claim; parent-owned remount behavior remains T7b/integration proof. Commitfc1f1250b38d75d5fcc11a5d2c09b3cb13881f5e (194authoredlines).
T7b | S4,S8,S33,S34 | inline | done | Harness map reviewed and controlled-parent/theme spotcheck complete. Implement isolated controlled field+component tests, then local-only scratch browser verification. Active UI unchanged; RED25fail→GREEN25/25. Evidence fixtures corrected to sourceRef/verifiedOn before RED. Initial job27:1861tests/types PASS. Visual review found multi select:value array did not render selection; browser selectedOptions[] reproduced, regressionRED1fail/25pass→GREEN26/26 with per-option selected binding. Post-fix job30:1862/1862tests27suites+component/preview/appvue-tsc/diffcheck PASS; ESLint PASS. Browser first post-fix assertion assumed pre-HMR fixture data; diagnosis showed reset fixture raw['old'] and matching selected['old'], not another source defect. Fresh setup PASS four states/six payloads/single and multi selected DOM/empty/archived/missing/null-unit, partial number/range/evidence remount, disabled synthetic events, keyboard tab order. 1280/390 widths x light/dark captured: no overflow, all controls>=44px, visible solid focus. Four initial full images reviewed, corrected selection crops reviewed after fix; fresh full captures retained under .editorial-field-preview/*-final.png. External font requests blocked, system fallback typography; zero JS page errors. Browser isolated only, no app-lifecycle proof. LSP plain-TS Vue import2307 marked false-positive with explicit vue-tsc evidence; component probe inconclusive, no clean-LSP claim. Native assessment unavailable/untracked, no native approval. Risk:none: additive isolated component+tests, no existing consumers/helpers changed. Commit0d164ca055b9b1d47c2288c71885150f3ab5fe46 (284authoredlines). Scratch preview/server excluded from delivery; server stopped.
T7c | S11,S12,S20,S22,S33,S35,S36 | parallel independent leaf writers | done | Declaration worker mvufgf10-w-9apb delivered195lines/63tests: RED39fail24pass (38assertions+stub fixture guard), GREEN208/208 across3suites and strict test-tsc. Care worker mvufgf2t-x-baci delivered228lines/38tests: RED16fail21pass (15assertions+stub TypeError), GREEN116/116 across3suites and strict test-tsc. Parent full readback of all4files: S35/S36 matched, no cross-worker dependency/shared-helper/consumer edits. LSP4paths: no compiler errors,5 extensionless-import advisories matching existing bundler convention. Native assess unavailable/untracked after each delivery, no approval. Parent job31 exited0 after42s:1963/1963tests across29explicit suites, strict two-test tsc/appvue-tsc/diffcheck PASS. Both leaf outcomes verified; no UI/browser check applies. Risk:none: isolated new leaf encoding, no existing shared code modified. Separate commits remain planned.
T7 | S4,S7,S8,S9,S33 | parent orchestration | pending | T7a/b complete; T7c isolated leaves underway after explorer map and care-type spotcheck. Existing editor/facts composition/family reset stay unchanged. No automatic cascading requirement references, invented care revision or publication authority.
T8 | S5,S6,S8 | delegated (context backstop) | pending | Faithful history/comparison, publication blockers and explicit care review; commit pending.
T9 | S1–S9 | parent + independent verifier for named risk | pending | Final docs/regressions/typecheck/browser/contract integration; no DB/reset or live activation; commit pending.

## Log
L1. Original change request: «si hermano, justamente lo que pensaba es que realmente no es necesario mantener compatibilidad con la version 1, realmente aun no hay gente usandolo en produccion REAL, no hay productos reales, etc... podemos quitar la v1 por completo ( de lo que estamos hablando de que es?? es sobre los productos? )».
L2. User follow-up: «si hermano, y de hecho, de nuevo, no hay productos reales aun en produccion, podriamos borrar todos los productos y no paasaria nada, todo lo que hay es de prueba.» No database target selected; no deletion needed for FE implementation.
L3. Backend S35 final target c90e2e0963faa538e41c92d62e6778b92437e181 received in full and technically aligned; exact pure catalog received separately. Target not live. Existing frontend has one old contract, no implemented compatibility layer to simply remove. Parent spotchecked transport and useEditorialEditor. Explorer outputs mvu4ylx3-1-eua2 and mvu5n6o5-2-gne8 map dependencies, not behavioral proof.
L4. Parent corrected planner: initialize still copies Published; S33 pending numeric policy never admits NaN or invalid primitive numbers. API/account scope protection retained, not compatibility baggage.
L5. Family-change human response: «Limpiar con confirmación (recomendado)» to S7 exact question. Local-only clear on confirmation, cancel unchanged, no autosave or Published mutation.
L6. Initial worktree on main contained only pre-existing untracked docs/redesign/production-vocabulary-normalized-proposal.md. Created feat/editorial-single-contract; preserve that file unchanged and exclude it from work-unit commits. Source implementation begins only after file/memory/todo reconciliation. Forecast requires delivery strategy decision before first commit, not before local bounded T1 implementation.
L7. Worker focused command `pnpm run test:unit -- run src/features/POS/products/utils/__tests__/editorial-contract-value.spec.ts --exclude '.worktrees/**'` timed out at30s after Vitest4.1.0 RUN; not RED evidence. Parent stopped implementation/retries. Human explicitly selected «Sí, ejecutar en segundo plano» to authorize one new run. Started parent job-1; awaiting completion event, no polling. Worker returned tests-only partial result; previous timed-out process survival unknown. No behavioral proof yet.
L8. User: «lleva media hora corriendo ese job y tengo los nuclos del cpu al 100.» Parent immediately stopped job-1. Read first90 log lines: actual invocation `$ vitest -- run ... --exclude '.worktrees/**'`, widespread unintended worktree/e2e suites, >68k remaining log lines. vitest.config.ts excludes only normal defaults/e2e, not worktrees; forwarded separator caused intended filtering/options not to work. Parent process check found no remaining vitest/tinypool/pnpm-test processes. No other-session processes stopped. No automatic restart. Proposed future command uses direct local Vitest, explicit run/path/exclusion, maxWorkers1, no file parallelism and hard60s timeout; requires new human authorization after incident. Tests remain unverified; implementation paused.
L9. Human authorized corrected bounded run: «si, adelante,». Started job-2: `timeout --signal=TERM --kill-after=5s 60s ./node_modules/.bin/vitest run src/features/POS/products/utils/__tests__/editorial-contract-value.spec.ts --exclude '.worktrees/**' --maxWorkers=1 --no-file-parallelism`. No polling or automatic retry; await exit event. 60s execution deadline, at most5s additional forced-kill grace.
L10. job-2 exited1 after2s; parent read full log: exactly requested test file, failed import ../editorial-contract-value, no assertions executed. Corrected bounded runner established; worker continued as mvu7mkid-4-ehsa to use minimal stub for assertion RED before implementation/GREEN. All runs direct local Vitest with explicit paths, worktree exclusion, maxWorkers1/no-file-parallelism; broader checks parent-managed with hard deadline. No T1 completion claimed.
L11. Worker delivery: isolated target decoder/types and49tests, assertion RED11fail/36pass, GREEN47 then49. Parent full readback matches S4 closed shape/fresh-admission separation; no existing consumers/helpers changed. Risk: none (standalone unconsumed shape decoder, no security/permission guard, no shared contract replacement yet). Native ASSESS unassessable due untracked declaration; no review approval. Parent launched job-3: explicit six editorial test paths, one worker/no parallelism/worktree exclusion, then app vue-tsc sequentially; hard60s per step. Await results. LSP check has1unconfirmed file and7auxiliary hints for unknown/typeof at actual decoding boundary; no blanket clean claim. T1 remains in_progress.
L12. Parent job-3 completed exit0 after20s: six explicitly selected suites139/139 passed, followed by app vue-tsc exit0. T1 outcome verified and marked done; no live integration. Initial timeout/runaway failures remain historical failed checks, not omitted. No browser checks applicable to this pure unconsumed decoder. Need human delivery-shape choice before first work-unit commit because feature forecast exceeds400lines; no push/PR created.
L13. Human selected «Cadena sobre rama de la funcionalidad (recomendado)» (feature-branch-chain). Tracker/integration feat/editorial-single-contract; first slice T1 decoder plus tests/tracking, subsequent slices dependency-ordered. No main changes/push/PR now. Authored count recorded from commits; no oversized accumulated PR.
L14. T1 committed2cd9acb15524d1548912ad2b6e654863f65c6c81,328authored lines. Native assess remains unavailable due original unrelated untracked proposal even with committedOnly; no approval invented and no mutation to unrelated proposal. T1 functional/type proof remains valid. Dependency refinement: do exact finite catalog T3a before facts T2 so facts/types do not widen ProductionDefinitionCode to arbitrary string. This is the already-agreed S9 input, not new inventory policy. Subsequent review slice starts after2cd9acb; tracker branch retained, no publication.
L15. T3a parent read exact catalog/test sources;97tests worker GREEN. Parent runs both new-unit suites plus explicit tsc on compile-time assertions because tsconfig.app.json excludes __tests__, then app vue-tsc; job-4, maxWorkers1 and hard60s per step. No additional runtime integration or rule changes.
L16. job-4 completed exit0 after17s:146/146 focused tests, test-file tsc assertions valid, app vue-tsc clean. T3a verified/done. Risk:none; no existing consumers touched. Native assessment remains unavailable, not an approval. No browser check applies to pure isolated catalog. Commit includes catalog/tests/spec evidence only.
L17. T3a committed00ec542f73550b8eb52959f1e6f28936cefa69a7. Chain slice boundaries: slice1 parent→2cd9acb (T1,328 authored lines); slice2 2cd9acb→00ec542 (T3a,319 authored lines); accumulated authored sum647, net branch diff tool641. These are separate future review/PR slices on feature-branch-chain, NOT a single641-line candidate; no push/PR created. Native assess of committed slice2 unavailable/untracked, no approval. Next slice begins00ec542. T2 split declaration primitive behavior T2a, then care/document composition T2; existing remaining IDs kept.
L18. T2a readback: exact12key/value correlation, closed envelopes, static subset identities, detached snapshot, fresh admission excluded. Existing value decoder diff is three additive export modifiers only; no body/control-flow/contract removals. Risk:none (additive unconsumed API, no behavioral change to existing helper). Parent job-5 verifies declarations/value/catalog and compile assertions, then app types with bounded sequential execution. Existing Vite extensionless imports are repository convention, auxiliary lint suggestions not TS errors; do not reconfigure tooling.
L19. job-5 completed exit0 after26s;191/191tests across3explicit suites plus declaration test tsc and app vue-tsc pass. T2a verified/done. Advisory about incomplete callgraph is informational; no blocker emitted. No browser checks applicable to isolated primitives. Work-unit commit will contain317source/test authoredlines plus exact spec/evidence.
L20. T2a committeda46db57e3de7f1a13d0e3912d4a9e54a03c59d6a; separate chain slice3=00ec542→a46db57,371authoredlines, next slice startsa46db57. Native assessment unavailable/untracked, no approval; no retry/authority bypass. Total authored commit sum1018 (net branch tool1002), NOT one review candidate. T2b care primitive separated from subsequent document composition for cohesive review, no new behavior.
L21. T2b parent read complete3files; target shapes/enums match S12, snapshot reused unchanged, contradictory/unresolved capture preserved. Risk:none (new isolated decoder, existing helpers untouched). Parent job-6 runs four bounded primitive suites then explicit compile assertions/app types. LSP import-extension warning follows existing bundler convention; unknown-input hint is at actual decoder boundary. Await proof, no completion claimed.
L22. Parent job-6 completed exit0 after19s:235/235tests in4focused suites, care-test tsc and app vue-tsc pass. T2b verified/done. No browser check applicable; pi-lens callgraph advisory is informational. No live code/permissions/publication behavior changed.
L23. T2b commit6c11e0950e256a45ad2680c7bc134300cc30f563; separate chain slice4 a46db57→6c11e09,312authoredlines; next boundary6c11e09. Accumulated authored sum1330, net branch tool1310; never one review candidate. Native assessment unavailable/untracked, no approval. Proceed T2 composition using exact S13; no old consumer changes.
L24. T2 parent readback: exact S13 composition, nullable care not missing field, atomic nested failure, no normalization/adoption/pruning, deep detachment. Risk:none (isolated new readers, reused helpers unchanged). Parent job-7 checks5explicit primitive suites and compile/app types sequentially with60s deadlines. No browser checks apply to this pure unit; pending result before completion.
L25. job-7 exited0 after19s:256/256tests in5focused suites, document-test tsc and app vue-tsc passed. T2 verified/done. Whole-document decoding now composed, still not connected to existing editor/API. No failed or missing applicable functional proof for this unit; native assessment unavailable and prior resource incident remain explicitly recorded.
L26. T2 committedd596024340b0de4edde616cc12e8dae021e73cd1. Separate chain slice5=6c11e09→d596024,300authoredlines; next boundaryd596024. Sum1630authoredlines, net tool1606; no accumulated review candidate/push/PR. Native assess unavailable/untracked, no approval. T3b definition primitive next; cross-field/relational/full metadata qualification explicitly remains T3, not lost in decomposition.
L27. T3b parent readback confirms S14 six closed definition branches, safe integer order and nonblank labels preserve originals; magnitude remains scalarstring. Relational numeric/null/unique/reference/production qualification still deferred explicitly, not editor authority. Risk:none. job-8 runs6focused suites plus compile/app types,1worker/60s perstep. No browser needed for isolated reader; await observed checks.
L28. Parent job-8 exit0 after20s:430/430tests across6focused suites, definition-test tsc and app vue-tsc passed. T3b verified/done. pi-lens callgraph advisory informational, no blocker. No live reader integration or fullmetadata-admission claim.
L29. T3b commitee831c744663bff7bfc565a93863553bef7aaadb; slice6=d596024→ee831c7,353authoredlines; next boundaryee831c7. Sum1983authoredlines (net branch tool1955), separate review slices. Native assessment unavailable/untracked, no approval. T3c full vocabulary primitive next; T3 qualification is separate consumer-safety checks, not duplicate backend provisioning/static Unicode17/production admission engine.
L30. T3c parent readback confirms exact S15 routes/fields/static enums and unchanged child decoder; no crossqualification claimed. Added explicit obsolete field rejection at Family location, not just root; no meaningful new RED because strict family extras already reject. Risk:none, helpers/consumers unchanged. job-9 bounded7suite/tsc/app checks pending; LSP3files unconfirmed despite no diagnostics, use explicit typechecks as evidence.
L31. job-9 exited0 after21s:681/681tests in7explicit suites, vocabulary-test tsc and app vue-tsc pass. T3c verified/done. Generic callgraph extraction advisory informational only. No browser applicable, no live vocabulary admission or UI change.
L32. T3c committed13abb12a764aa844f2ee6ef7f1f5a9db3f3cc880. Slice7=ee831c7→13abb12,399authoredlines; next boundary13abb12. Sum2382authoredlines, net branch2350; separate feature-chain review slices, not one candidate. Native assessment unavailable/untracked, no approval. S16 now pins consumer qualification subset before live integration; no extra business rule or browser Unicode engine.
L33. T3 parent readback confirms Map/Set exactidentity lookup, numeric/null flags, group/alias references, per-family selectorgraphKahn traversal, requiredconsistency/factrulecoherence. Risk:none (new isolated qualifier, existing readers unchanged). Worker RED included45real expected failures plus1testhelper mistake later fixed; record separately, not all46behavioral. Parent job-10 explicit8suites+testtsc+apptypes running bounded sequentially; LSPsilent/unconfirmed, use actual typecheck proof.
L34. Parent job-10 exit0 after24s:749/749tests across8focused suites, qualifier-test tsc and app vue-tsc pass. T3 verified/done; generic callgraph advisory informational, no blocker. Client metadata qualification is ready but not wired. No native approval, publication or full backend-admission claim.
L35. T3 commita09cd572cc78e0c10edb6ad013498602587b1855; separate slice8=13abb12→a09cd57,379authoredlines; next boundarya09cd57. Sum2761authoredlines/nettool2725; no accumulated candidate/push/PR. Native assess unavailable/untracked, no approval. T4a success envelopes next before HTTP wiring, so parsing/state-counter limits are not mixed into request primitive admission.

L36. T4a verified job-11 exit0 after24s:941/941tests, explicit response-test tsc and app vue-tsc passed. Commit1448aab2984111939d7740fef6cb08248a48c2b3; separate slice9=a09cd57→1448aab,409authoredlines including specs/evidence; next boundary1448aab. Existing helpers/consumers unchanged, Risk:none. LSP3unconfirmed and native assessment unavailable, no approval claim. Requested exact transport excerpts from backend peer before T4; waiting for asynchronous reply, no speculative wire implementation.

L37. Documentation slice10=1448aab→cfddcb21c3952fe3e1dc7cf1f7799fa58ec1d652,86authoredlines, pins exact S18 target. Transport slice11=cfddcb2→ef0f3d45861f0a82e9cad986077a04a676f78e67,336authoredlines; next boundaryef0f3d4. Parent job-12 exit0 after27s:1038/1038tests in11suites, scoped API-test vue-tsc and app vue-tsc passed. LSP2unconfirmed plus intentional large-counter literal hint; no type errors. Native assess unavailable, no review approval. Risk:none for isolated T4; existing helpers/auth/consumers unchanged. Started read-only T5 mapping task mvu9zb01-e-f7of before selecting integration units; no live cutover.

L38. Independent T5a verifier mvua8iil-g-2uop PASS S5/S19,18/18 isolated tests, no findings. Slice12=ef0f3d4→da9671577dfd0e762bf4400215c29fe5e0a99b9b,313authoredlines; Risk:item4 independently verified only isolated helper. T6a inline supplied-evidence validator RED20fail/80pass then job-14exit0after23s1156/1156tests13suites+test-tsc/app-vue-tsc. Slice13=da96715→5544db709f34591526bbc1a63b5e01925d8c8991,90authoredlines; nextboundary5544db7. Risk:none for T6a, primitive readers unchanged. LSP initial missingmodule stale; actualtypes passed. Native assess unavailable/no approval. T6 read-only routing map mvuaghp1-h-rzy8 launched; no consumer integration.

L39. Backend seq33 normative readback: target does not enumerate whole-baseline eligibility effects of unrelated new evidence/numeric/facts invalidity. Existing whole-document contextual validation does not authorize extending fresh V2 policy gates; exact target clarification is a human decision. Media ownership is server-only tenant/product private_media_assets lookup; no target exact baseline sequence rule and no FE ownership route. Do not infer unchanged sequence proves ownership or add media editing/routes. Facts capture remains independent. Pending human baseline decision; recommendation retain structural/current-reference qualification without retroactively imposing fresh-domain rules.
