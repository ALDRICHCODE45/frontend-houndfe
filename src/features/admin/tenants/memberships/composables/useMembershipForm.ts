import { reactive, computed } from 'vue'
import {
  createMembershipSchema,
  updateMembershipSchema,
  type CreateMembershipFormValues,
  type UpdateMembershipFormValues,
} from '../interfaces/membership.types'

export type { CreateMembershipFormValues, UpdateMembershipFormValues }

function getCreateInitialState(): CreateMembershipFormValues {
  return {
    userId: '',
    roleId: '',
  }
}

function getEditInitialState(): UpdateMembershipFormValues {
  return {
    roleId: '',
  }
}

export function useMembershipForm(mode: 'create' | 'edit') {
  const createState = reactive<CreateMembershipFormValues>(getCreateInitialState())
  const editState = reactive<UpdateMembershipFormValues>(getEditInitialState())

  const schema = computed(() =>
    mode === 'create' ? createMembershipSchema : updateMembershipSchema,
  )

  function resetForm() {
    Object.assign(createState, getCreateInitialState())
    Object.assign(editState, getEditInitialState())
  }

  function setValues(values: Partial<UpdateMembershipFormValues>) {
    Object.assign(editState, getEditInitialState(), values)
  }

  return {
    schema,
    createState,
    editState,
    resetForm,
    setValues,
  }
}
