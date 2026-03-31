import { reactive } from 'vue'
import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string({ required_error: 'El email es obligatorio' }).email('Email inválido'),
  password: z
    .string({ required_error: 'La contraseña es obligatoria' })
    .min(8, 'La contraseña debe tener al menos 8 caracteres'),
})

export type LoginFormValues = z.infer<typeof loginSchema>

function getInitialState(): LoginFormValues {
  return {
    email: '',
    password: '',
  }
}

export function useLoginForm() {
  const state = reactive<LoginFormValues>(getInitialState())

  function resetForm() {
    Object.assign(state, getInitialState())
  }

  return {
    schema: loginSchema,
    state,
    resetForm,
  }
}
