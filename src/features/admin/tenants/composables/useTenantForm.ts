import { reactive, computed, ref } from 'vue'
import { z } from 'zod'

const baseTenantSchema = z.object({
  name: z.string({ required_error: 'El nombre es obligatorio' }).min(2, 'Mínimo 2 caracteres'),
  slug: z
    .string({ required_error: 'El slug es obligatorio' })
    .min(2, 'Mínimo 2 caracteres')
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Solo minúsculas, números y guiones (sin guiones consecutivos, al inicio o al final)'),
  address: z.string().optional(),
  phone: z.string().optional(),
})

const createTenantSchema = baseTenantSchema

const editTenantSchema = baseTenantSchema.extend({
  isActive: z.boolean().optional(),
})

export type CreateTenantFormValues = z.infer<typeof createTenantSchema>
export type EditTenantFormValues = z.infer<typeof editTenantSchema>

function getCreateInitialState(): CreateTenantFormValues {
  return {
    name: '',
    slug: '',
    address: '',
    phone: '',
  }
}

function getEditInitialState(): EditTenantFormValues {
  return {
    name: '',
    slug: '',
    address: '',
    phone: '',
    isActive: undefined,
  }
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function useTenantForm(mode: 'create' | 'edit') {
  const createState = reactive<CreateTenantFormValues>(getCreateInitialState())
  const editState = reactive<EditTenantFormValues>(getEditInitialState())

  const isSlugManuallyEdited = ref(false)

  const schema = computed(() => (mode === 'create' ? createTenantSchema : editTenantSchema))

  function updateName(name: string) {
    if (mode === 'create') {
      createState.name = name
      if (!isSlugManuallyEdited.value) {
        createState.slug = slugify(name)
      }
    } else {
      editState.name = name
    }
  }

  function updateSlug(slug: string) {
    isSlugManuallyEdited.value = true
    if (mode === 'create') {
      createState.slug = slug
    } else {
      editState.slug = slug
    }
  }

  function resetForm() {
    Object.assign(createState, getCreateInitialState())
    Object.assign(editState, getEditInitialState())
    isSlugManuallyEdited.value = false
  }

  function setValues(values: Partial<EditTenantFormValues>) {
    Object.assign(editState, getEditInitialState(), values)
  }

  return {
    schema,
    createState,
    editState,
    isSlugManuallyEdited,
    updateName,
    updateSlug,
    resetForm,
    setValues,
  }
}
