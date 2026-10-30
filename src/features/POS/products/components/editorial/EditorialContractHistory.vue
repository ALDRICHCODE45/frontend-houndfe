<script setup lang="ts">
import type { EditorialContractDocument } from '../../interfaces/editorial-contract-document.types'
import type { EditorialContractVocabulary } from '../../interfaces/editorial-contract-vocabulary.types'
import type { EditorialContractContext } from '../../interfaces/editorial-contract-request.types'
import type { EditorialValue } from '../../interfaces/editorial-contract-value.types'

/** Read-only stored content only. Index keys preserve ordered duplicate targets;
 * current metadata labels never replace stored identities or evidence authority.
 */
const props = defineProps<{ document: EditorialContractDocument; vocabulary?: EditorialContractVocabulary | null; context?: EditorialContractContext | null }>()
const labels: Record<string, string> = {
  unknown: 'Desconocido', not_applicable: 'No aplica', prepared: 'Preparado', known: 'Conocido',
  satisfied: 'Satisfecho', unresolved: 'Sin resolver', conflicting: 'En conflicto', identified: 'Identificados', none_applicable: 'Ninguno aplicable',
  private_only: 'Solo privado', public_required: 'Requiere divulgación pública', state: 'Estado', evidence: 'Evidencia',
  sourceRef: 'Fuente', verifiedOn: 'Fecha de verificación', key: 'Clave', value: 'Valor', basis: 'Fundamento',
  jurisdiction: 'Jurisdicción', intendedUse: 'Uso previsto', determination: 'Determinación', requirements: 'Requisitos', warnings: 'Advertencias',
  description: 'Descripción', disposition: 'Resolución', requirementKeys: 'Referencias a requisitos', text: 'Texto', disclosure: 'Divulgación', handlingBasis: 'Fundamento del tratamiento',
}
function readable(value: unknown): string {
  if (value === null) return 'Sin valor'
  if (value === false) return 'No'
  if (value === true) return 'Sí'
  if (Array.isArray(value)) return value.length ? value.map((item, index) => `${index + 1}. ${readable(item)}`).join('\n') : 'Lista vacía'
  if (typeof value === 'object') return Object.entries(value).map(([key, item]) => `${labels[key] ?? key}: ${readable(item)}`).join('\n')
  if (value === '') return 'Texto vacío'
  return String(value)
}
function stateLabel(value: string) { return labels[value] ?? value }
function assignmentText(value: EditorialValue) {
  if (value.state !== 'known') return stateLabel(value.state)
  const payload = value.payload
  if (payload.type === 'range') return `${payload.min} – ${payload.max} ${payload.unit}`
  if (payload.type === 'number') return `${payload.value}${payload.unit === null ? ' · Sin unidad' : ` ${payload.unit}`}`
  if (payload.type === 'single' || payload.type === 'multi') {
    const definition = props.vocabulary?.definitions.find(item => item.code === value.code)
    const option = (code: string) => definition && (definition.type === 'single' || definition.type === 'multi')
      ? `${definition.options.find(item => item.code === code)?.label ?? code} (${code})` : code
    return payload.type === 'single' ? option(payload.value) : payload.value.length ? payload.value.map(option).join(' · ') : 'Lista vacía'
  }
  return readable(payload.value)
}
function subject(id: string | null) { return id === null ? 'Sin presentación' : `${props.context?.variants.find(item => item.id === id)?.name ?? 'Presentación no disponible'} · ${id}` }
</script>

<template>
  <div class="history">
    <dl class="content">
      <div><dt>Título comercial editorial</dt><dd>{{ document.commercialTitle ?? 'Sin título editorial' }}</dd></div>
      <div><dt>Familia editorial</dt><dd>{{ vocabulary?.families.find(item => item.code === document.familyCode)?.label ?? document.familyCode ?? 'Sin familia' }}</dd></div>
      <div><dt>Descripción editorial</dt><dd>{{ document.description ?? 'Sin descripción editorial' }}</dd></div>
    </dl>
    <p>{{ document.mediaRefs.length }} referencias de medios conservadas · {{ document.values.length }} atributos guardados</p>
    <ul><li v-for="(reference, index) in document.mediaRefs" :key="index">{{ reference }}</li></ul>
    <h3>Atributos guardados</h3><p v-if="!document.values.length">Sin atributos.</p>
    <ol class="ordered">
      <li v-for="(value, index) in document.values" :key="index" data-history-assignment>
        <p class="label">{{ vocabulary?.definitions.find(item => item.code === value.code)?.label ?? value.code }} · {{ value.code }} · {{ value.owner === 'product' ? 'Producto' : subject(value.variantId) }}</p>
        <p>{{ assignmentText(value) }}</p>
        <p v-if="value.state === 'known'">{{ value.evidence ? `Evidencia · Fuente: ${value.evidence.sourceRef} · Fecha de verificación: ${value.evidence.verifiedOn}` : 'Sin evidencia' }}</p>
      </li>
    </ol>
    <h3>Hechos y revisiones de cuidado</h3><p v-if="!document.facts.length">Sin hechos.</p>
    <ol class="ordered">
      <li v-for="(row, index) in document.facts" :key="index" data-history-facts>
        <h4>{{ subject(row.variantId) }} · {{ row.presentation }}</h4>
        <h5>Declaraciones</h5><p v-if="!row.declarations.length">Sin declaraciones.</p>
        <dl class="content"><div v-for="(declaration, declarationIndex) in row.declarations" :key="declarationIndex">
          <dt>{{ declaration.key }} · {{ stateLabel(declaration.state) }}</dt>
          <dd v-if="declaration.state === 'known'">{{ readable(declaration.value) }}<br>Fundamento: {{ declaration.basis }}<br>Fuente: {{ declaration.evidence.sourceRef }} · Fecha de verificación: {{ declaration.evidence.verifiedOn }}</dd>
        </div></dl>
        <h5>Revisión de cuidado</h5>
        <p v-if="row.careReview === null">Sin revisión de cuidado.</p>
        <p v-else-if="row.careReview.state === 'unknown'">Desconocido</p>
        <template v-else>
          <dl class="content"><div><dt>Jurisdicción</dt><dd>{{ row.careReview.jurisdiction }}</dd></div><div><dt>Uso previsto</dt><dd>{{ row.careReview.intendedUse }}</dd></div>
            <div><dt>Determinación</dt><dd>{{ stateLabel(row.careReview.determination) }}</dd></div><div><dt>Fundamento</dt><dd>{{ row.careReview.basis }}</dd></div>
            <div><dt>Evidencia de la revisión</dt><dd>{{ readable(row.careReview.evidence) }}</dd></div></dl>
          <h5>Requisitos</h5><p v-if="!row.careReview.requirements.length">Sin requisitos.</p>
          <ol class="ordered"><li v-for="(requirement, requirementIndex) in row.careReview.requirements" :key="requirementIndex">
            <p>{{ requirement.key }} · {{ stateLabel(requirement.disposition) }}</p><p>{{ requirement.description }}</p>
            <p>Fundamento: {{ requirement.basis }}</p><p>{{ readable(requirement.evidence) }}</p>
          </li></ol>
          <h5>Advertencias</h5><p v-if="!row.careReview.warnings.length">Sin advertencias.</p>
          <ol class="ordered"><li v-for="(warning, warningIndex) in row.careReview.warnings" :key="warningIndex">
            <p>{{ warning.key }} · {{ stateLabel(warning.disclosure) }}</p><p>{{ warning.text }}</p>
            <p>Referencias a requisitos: {{ readable(warning.requirementKeys) }}</p><p>Fundamento del tratamiento: {{ warning.handlingBasis }}</p><p>{{ readable(warning.evidence) }}</p>
          </li></ol>
        </template>
      </li>
    </ol>
  </div>
</template>

<style scoped>
.history, .content { display: grid; gap: 12px; min-width: 0; overflow-wrap: anywhere; }
.content dd, .history p { margin: 4px 0; white-space: pre-wrap; }
.history h3, .history h4, .history h5, .content dt, .label { font-weight: 600; color: var(--hf-heading); }
.ordered { display: grid; gap: 16px; padding-inline-start: 24px; list-style: decimal; }
.ordered > li { min-width: 0; border-top: 1px solid var(--hf-border); padding-top: 12px; }
</style>
