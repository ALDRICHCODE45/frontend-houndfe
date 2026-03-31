import { reactive } from 'vue'
import { z } from 'zod'

const createUserSchema = z.object({
  name: z.string({ required_error: 'El nombre es obligatorio' }).min(2, 'Mínimo 2 caracteres'),
  email: z.string({ required_error: 'El email es obligatorio' }).email('Email inválido'),
  password: z
    .string({ required_error: 'La contraseña es obligatoria' })
    .min(8, 'Mínimo 8 caracteres'),
})

const editUserSchema = z.object({
  name: z.string({ required_error: 'El nombre es obligatorio' }).min(2, 'Mínimo 2 caracteres'),
})

export type CreateUserFormValues = z.infer<typeof createUserSchema>
export type EditUserFormValues = z.infer<typeof editUserSchema>

function getCreateInitialState(): CreateUserFormValues {
  return {
    name: '',
    email: '',
    password: '',
  }
}

function getEditInitialState(): EditUserFormValues {
  return {
    name: '',
  }
}

export function useUserForm(mode: 'create' | 'edit') {
  const createState = reactive<CreateUserFormValues>(getCreateInitialState())
  const editState = reactive<EditUserFormValues>(getEditInitialState())

  const schema = mode === 'create' ? createUserSchema : editUserSchema

  function resetForm() {
    Object.assign(createState, getCreateInitialState())
    Object.assign(editState, getEditInitialState())
  }

  function setEditName(name: string) {
    editState.name = name
  }

  return {
    schema,
    createState,
    editState,
    resetForm,
    setEditName,
  }
}
