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

## Tasks
T1 | S1,S3,S4 | delegated (context backstop) | done | Worker assertion RED11fail/36pass then GREEN49pass; parent full3file readback/diff-check and job-3 exit0 after20s:139/139 across6files, app vue-tsc exit0. LSP1unconfirmed plus7auxiliary hints; typecheck provides type evidence. ASSESS unavailable for untracked scope, not approval. Risk:none. Commit2cd9acb15524d1548912ad2b6e654863f65c6c81 (328 authored lines incl tracking); delivery feature-branch-chain; no live integration. Native assessment unavailable even committed-only; no native approval claimed.
T3a | S3,S9,S10 | delegated (context backstop) | done | Worker assertion RED71fail/26pass then GREEN97. Parent full readback and job-4 exit0 after17s:146/146tests across2suites, explicit test-file tsc and app vue-tsc pass. LSP1auxiliary unknown-input hint only. Native assess unavailable/untracked, not approval. Risk:none; no existing consumer/helper changed. Commit00ec542f73550b8eb52959f1e6f28936cefa69a7 (319 authored lines including tracking); no metadata integration.
T2a | S3,S4,S9,S11 | delegated (context backstop) | done | Worker RED33fail/61pass then94/94GREEN. Parent readback and job-5 exit0 after26s:191/191tests, explicit test-file tsc and app vue-tsc passed. Only3additive exports in existing helpers, bodies unchanged; Risk:none. LSP11auxiliary hints/warnings only; no type errors. Native assess unavailable, no approval. Commita46db57e3de7f1a13d0e3912d4a9e54a03c59d6a (371authoredlines incl spec/evidence); no integration.
T2b | S3,S4,S12 | delegated (context backstop) | done | Worker assertion RED34fail/58pass then93/93GREEN. Parent full3file readback and job-6 exit0 after19s:235/235tests, explicit care-test tsc +app vue-tsc pass. LSP2auxiliary findings only. Native assess unavailable/untracked, no approval. Risk:none, helpers unchanged. No publication/UI integration; commit6c11e0950e256a45ad2680c7bc134300cc30f563 (312authoredlines incl spec/evidence).
T2 | S3,S4,S6,S9,S13 | delegated (context backstop) | done | Worker assertion RED6fail/153pass then159/159GREEN. Parent full3file readback and job-7 exit0 after19s:256/256tests +explicit document-test tsc +app vue-tsc pass. LSP6auxiliary findings only. Native assess unavailable, no approval. Risk:none; helpers/consumers unchanged. Commitd596024340b0de4edde616cc12e8dae021e73cd1 (300authoredlines incl spec/evidence).
T3b | S3,S9,S14 | delegated (context backstop) | done | Worker assertion RED20fail/201pass then223/223GREEN. Parent full3file readback and job-8 exit0 after20s:430/430tests +explicit definition-test tsc +app vue-tsc passed. LSP2auxiliary findings only. Native assess unavailable, no approval. Risk:none; helpers/consumers unchanged. Commit pending recording.
T3 | S3,S9 | delegated (context backstop) | pending | Policy/family/vocabulary types/composition and metadata qualification using T3a/T3b; may split coherent behavior units, commit pending.
T4 | S3,S5 | delegated (context backstop) | pending | Target transport headers/envelopes/error mapping with adapter tests; commit pending.
T5 | S5,S6 | delegated (context backstop) | pending | Coherent scoped reads and immutable R/care write intents, coordinated consumer transition; commit pending.
T6 | S4,S6,S9 | delegated (context backstop) | pending | Fresh document/assignment/evidence/facts qualification and conservation; commit pending.
T7 | S4,S7,S8,S9 | delegated (context backstop) | pending | Existing editor value/range/evidence/facts controls and confirmed family change, split by coherent behavior as needed; commit pending.
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
