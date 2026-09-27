import { reactive } from 'vue'
import { z } from 'zod'

const createUserSchema = z.object({
  name: z.string({ required_error: 'El nombre es obligatorio' }).min(2, 'Mínimo 2 caracteres'),
  email: z.string({ required_error: 'El email es obligatorio' }).email('Email inválido'),
  password: z
    .string({ required_error: 'La contraseña es obligatoria' })
    .min(8, 'Mínimo 8 caracteres'),
  roleId: z.string({ required_error: 'El rol es obligatorio' }).uuid('ID de rol inválido'),
})

export const editUserSchema = z.object({
  name: z.string({ required_error: 'El nombre es obligatorio' }).min(2, 'Mínimo 2 caracteres'),
  email: z.string().trim().email('Email inválido').optional(),
  roleIds: z
    .array(z.string().uuid('ID de rol inválido'))
    .min(1, 'Selecciona al menos un rol')
    .refine((ids) => new Set(ids).size === ids.length, 'Los roles no pueden repetirse')
    .optional(),
})

export function sameRoleIds(left: string[], right: string[]) {
  return left.length === right.length && left.every((id) => right.includes(id))
}

export type CreateUserFormValues = z.infer<typeof createUserSchema>
export type EditUserFormValues = z.infer<typeof editUserSchema>

function getCreateInitialState(): CreateUserFormValues {
  return {
    name: '',
    email: '',
    password: '',
    roleId: '',
  }
}

function getEditInitialState(): EditUserFormValues {
  return {
    name: '',
    email: '',
    roleIds: undefined,
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
