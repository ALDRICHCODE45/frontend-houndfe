import { reactive, computed } from 'vue'
import { z } from 'zod'

const roleSchema = z.object({
  name: z.string({ required_error: 'El nombre es obligatorio' }).min(2, 'Mínimo 2 caracteres'),
  description: z.string().optional(),
})

export type RoleFormValues = z.infer<typeof roleSchema>

function getInitialState(): RoleFormValues {
  return {
    name: '',
    description: '',
  }
}

export function useRoleForm() {
  const state = reactive<RoleFormValues>(getInitialState())
  const schema = computed(() => roleSchema)

  function resetForm() {
    Object.assign(state, getInitialState())
  }

  function setValues(values: Partial<RoleFormValues>) {
    Object.assign(state, getInitialState(), values)
  }

  return {
    schema,
    state,
    resetForm,
    setValues,
  }
}
