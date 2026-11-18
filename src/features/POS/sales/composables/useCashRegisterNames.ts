/**
 * Register names by id, for labelling a cash session by its till («Caja Principal») instead of
 * its raw id. Reads the principal-scoped register list (`read:CashRegister`); without that
 * ability, or while it loads, the map is empty and the label falls back to a generic «Caja».
 */
import { computed, type ComputedRef } from 'vue'
import { useCashRegisters } from '@/features/POS/cash-register/composables/useCashRegisters'

export function useCashRegisterNames(): ComputedRef<Record<string, string>> {
  const { registers } = useCashRegisters()
  return computed(() => Object.fromEntries(registers.value.map((register) => [register.id, register.name])))
}
