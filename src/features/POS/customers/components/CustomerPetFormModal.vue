<script setup lang="ts">
/**
 * Create/edit form of a pet (handoff 27 §2–§3.3). Emits the form values; the owner builds the
 * payload (PATCH sends only what changed). An approximate age is edited by typing a new one while
 * the current `ageLabel` is shown as is.
 */
import { computed, reactive, ref, watch } from 'vue'
import {
  PET_SIZE_LABELS,
  PET_SPECIES_OPTIONS,
  emptyPetForm,
  petToForm,
  validatePetForm,
  type PetAgeMode,
  type PetFormValues,
} from '../pets/petForm'
import type { Pet, PetSize } from '../pets/pet.types'
import DateFieldPopover from '@/features/POS/sales/components/DateFieldPopover.vue'

const props = withDefaults(
  defineProps<{
    open: boolean
    pet?: Pet | null
    loading?: boolean
    /** Per-field copy from the server 400 (mapped by `property`). */
    errors?: Record<string, string>
  }>(),
  { pet: null, loading: false, errors: () => ({}) },
)

const emit = defineEmits<{ 'update:open': [value: boolean]; submit: [values: PetFormValues] }>()

const PORTAL = 'hf-theme hf-ui hf-form-overlay clients-form-portal'
const SELECT_PORTAL = 'hf-theme hf-ui clients-form-portal'

const state = reactive<PetFormValues>(emptyPetForm())
const localErrors = ref<Record<string, string>>({})
/** A new submit attempt hides the previous server errors until the owner sends new ones. */
const serverErrorsStale = ref(false)
watch(
  () => props.errors,
  () => {
    serverErrorsStale.value = false
  },
)
const fieldErrors = computed(() => ({
  ...(serverErrorsStale.value ? {} : props.errors),
  ...localErrors.value,
}))

// The select cannot hold null as a value: «Sin tamaño» maps to `size: null` (PATCH clears it).
const NO_SIZE = '__sin-tamano__'
const sizeItems = [
  { label: 'Sin tamaño', value: NO_SIZE },
  ...(Object.keys(PET_SIZE_LABELS) as PetSize[]).map((value) => ({
    label: PET_SIZE_LABELS[value],
    value,
  })),
]
const sizeModel = computed({
  get: () => state.size ?? NO_SIZE,
  set: (value: string) => {
    state.size = value === NO_SIZE ? null : (value as PetSize)
  },
})
const AGE_MODES: { value: PetAgeMode; label: string }[] = [
  { value: 'none', label: 'Sin edad' },
  { value: 'approx', label: 'Edad aproximada' },
  { value: 'date', label: 'Fecha de nacimiento' },
]

/** Today in the business timezone, only as the date picker's upper bound. */
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(
  new Date(),
)

const title = computed(() => (props.pet ? `Editar a ${props.pet.name}` : 'Nueva mascota'))
/** The server's label of a stored approximate age, kept unless a new one is typed. */
const currentApproxLabel = computed(() =>
  props.pet?.birthDate && props.pet.birthDatePrecision !== 'EXACT' ? props.pet.ageLabel : null,
)

watch(
  () => [props.open, props.pet?.id] as const,
  ([open]) => {
    if (!open) return
    Object.assign(state, props.pet ? petToForm(props.pet) : emptyPetForm())
    localErrors.value = {}
  },
  { immediate: true },
)

function onSubmit() {
  serverErrorsStale.value = true
  localErrors.value = validatePetForm(state, today, props.pet)
  if (Object.keys(localErrors.value).length > 0) return
  emit('submit', { ...state })
}
</script>

<template>
  <UModal
    :open="open"
    :title="title"
    :dismissible="!loading"
    :ui="{ content: PORTAL }"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <form
        id="customer-pet-form"
        class="flex flex-col gap-4"
        novalidate
        @submit.prevent="onSubmit"
      >
        <UFormField label="Nombre" name="name" :error="fieldErrors.name" required>
          <UInput
            v-model="state.name"
            data-testid="pet-form-name"
            class="w-full"
            size="lg"
            maxlength="60"
            placeholder="Ej: Bruno"
          />
        </UFormField>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <UFormField label="Especie" name="species" :error="fieldErrors.species" required>
            <USelect
              v-model="state.species"
              :items="PET_SPECIES_OPTIONS"
              class="w-full"
              size="lg"
              :ui="{ content: SELECT_PORTAL }"
            />
          </UFormField>
          <UFormField
            v-if="state.species === 'OTHER'"
            label="¿Qué especie?"
            name="speciesOther"
            :error="fieldErrors.speciesOther"
            required
          >
            <UInput
              v-model="state.speciesOther"
              data-testid="pet-form-species-other"
              class="w-full"
              size="lg"
              maxlength="40"
              placeholder="Ej: Conejo"
            />
          </UFormField>
        </div>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <UFormField label="Raza" name="breed" :error="fieldErrors.breed">
            <UInput
              v-model="state.breed"
              class="w-full"
              size="lg"
              maxlength="80"
              placeholder="Ej: Chihuahua"
            />
          </UFormField>
          <UFormField label="Tamaño" name="size" :error="fieldErrors.size">
            <USelect
              v-model="sizeModel"
              :items="sizeItems"
              data-testid="pet-form-size"
              class="w-full"
              size="lg"
              :ui="{ content: SELECT_PORTAL }"
            />
          </UFormField>
        </div>

        <fieldset class="flex flex-col gap-3">
          <legend class="mb-1.5 text-sm font-medium text-(--hf-ink)">Edad</legend>
          <div class="flex flex-wrap gap-2" role="group" aria-label="Cómo indicar la edad">
            <UButton
              v-for="mode in AGE_MODES"
              :key="mode.value"
              :label="mode.label"
              :data-testid="`pet-form-age-${mode.value}`"
              :aria-pressed="state.ageMode === mode.value"
              :variant="state.ageMode === mode.value ? 'solid' : 'outline'"
              color="neutral"
              class="min-h-(--hf-control-height)"
              @click="state.ageMode = mode.value"
            />
          </div>
          <template v-if="state.ageMode === 'approx'">
            <p
              v-if="currentApproxLabel"
              class="text-sm text-(--hf-muted)"
              data-testid="pet-form-current-age"
            >
              Edad registrada: {{ currentApproxLabel }}. Escribe una nueva solo si quieres
              cambiarla.
            </p>
            <UFormField name="approxAge" :error="fieldErrors.approxAge">
              <div class="grid grid-cols-2 gap-4">
                <UInput
                  v-model.number="state.approxYears"
                  data-testid="pet-form-years"
                  type="number"
                  min="0"
                  max="50"
                  size="lg"
                  aria-label="Años"
                  placeholder="Años"
                />
                <UInput
                  v-model.number="state.approxMonths"
                  data-testid="pet-form-months"
                  type="number"
                  min="0"
                  max="600"
                  size="lg"
                  aria-label="Meses"
                  placeholder="Meses"
                />
              </div>
            </UFormField>
          </template>
          <UFormField
            v-else-if="state.ageMode === 'date'"
            label="Fecha de nacimiento"
            name="birthDate"
            :error="fieldErrors.birthDate"
          >
            <DateFieldPopover
              :model-value="state.birthDate || null"
              testid="pet-form-birth-date"
              placeholder="Elegir fecha de nacimiento"
              min-iso="1950-01-01"
              @update:model-value="(iso) => (state.birthDate = iso ?? '')"
            />
          </UFormField>
        </fieldset>

        <UFormField label="Alergias" name="allergies" :error="fieldErrors.allergies">
          <UTextarea
            v-model="state.allergies"
            class="w-full"
            :rows="2"
            maxlength="500"
            placeholder="Ej: Pollo"
          />
        </UFormField>
        <UFormField label="Notas" name="notes" :error="fieldErrors.notes">
          <UTextarea
            v-model="state.notes"
            class="w-full"
            :rows="2"
            maxlength="500"
            placeholder="Ej: Nervioso con el ruido"
          />
        </UFormField>
      </form>
    </template>

    <template #footer>
      <div class="flex w-full flex-col gap-2 sm:flex-row sm:justify-end sm:gap-3">
        <UButton
          label="Cancelar"
          color="neutral"
          variant="outline"
          :disabled="loading"
          class="min-h-11 justify-center sm:min-h-0"
          @click="emit('update:open', false)"
        />
        <UButton
          :label="pet ? 'Guardar cambios' : 'Añadir mascota'"
          type="submit"
          form="customer-pet-form"
          color="primary"
          :loading="loading"
          class="hf-primary-control min-h-11 justify-center sm:min-h-0"
        />
      </div>
    </template>
  </UModal>
</template>
