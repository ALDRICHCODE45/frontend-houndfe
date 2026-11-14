import type { PublicCatalogAttributeFacetDto } from '../interfaces/public-catalog-products.types'
import { mergeFacetOptions } from './facet-options'

/** The animal facet definition; its tokens read `animal.target:<option code>`. */
export const ANIMAL_FACET_CODE = 'animal.target'
const ANIMAL_TOKEN_PREFIX = `${ANIMAL_FACET_CODE}:`
/** Species pills shown before «Ver más (n)» (design 05 E1: past 10, the row says there are more). */
export const ANIMAL_COLLAPSED_SPECIES = 10
/** From this many species, the expanded list offers a species search (design 01 A7). */
export const ANIMAL_SEARCH_FROM = 12
/** The strip needs two real animal options to be worth showing (design 05 E5). */
export const ANIMAL_MIN_OPTIONS = 2

export type AnimalFamily =
  | 'perro'
  | 'gato'
  | 'peces'
  | 'aves'
  | 'reptiles'
  | 'pequenos'
  | 'corral'
  | 'anfibios'
  | 'otros'

interface FamilyInfo {
  label: string
  /** The «all of the group» pill of the species row. */
  allLabel: string
  icon: string
  /** Tie-break when two groups have the same total; the primary order is the total. */
  order: number
}

/**
 * Front-end label, icon and order map (design 01 A0). The API sends no group: only the option
 * code, which is hierarchical, so the group comes from here and a code nobody mapped yet falls
 * into «Otros animales» instead of disappearing.
 */
const FAMILIES: Record<AnimalFamily, FamilyInfo> = {
  perro: { label: 'Perro', allLabel: 'Todos los perros', icon: 'i-lucide-dog', order: 0 },
  gato: { label: 'Gato', allLabel: 'Todos los gatos', icon: 'i-lucide-cat', order: 1 },
  peces: { label: 'Peces', allLabel: 'Todos los peces', icon: 'i-lucide-fish', order: 2 },
  aves: { label: 'Aves', allLabel: 'Todas las aves', icon: 'i-lucide-bird', order: 3 },
  reptiles: { label: 'Reptiles', allLabel: 'Todos los reptiles', icon: 'i-lucide-turtle', order: 4 },
  pequenos: {
    label: 'Pequeños mamíferos',
    allLabel: 'Todos los pequeños mamíferos',
    icon: 'i-lucide-rabbit',
    order: 5,
  },
  corral: {
    label: 'Aves de corral',
    allLabel: 'Todas las aves de corral',
    icon: 'i-lucide-bird',
    order: 6,
  },
  anfibios: {
    label: 'Anfibios',
    allLabel: 'Todos los anfibios',
    icon: 'i-lucide-paw-print',
    order: 7,
  },
  otros: {
    label: 'Otros animales',
    allLabel: 'Todos los otros animales',
    icon: 'i-lucide-paw-print',
    order: 8,
  },
}

/** First two segments of the option code → family. `ani.dom` is resolved by the full code. */
const PREFIX_FAMILY: Record<string, AnimalFamily> = {
  'ani.freshwater': 'peces',
  'ani.freshwater_group': 'peces',
  'ani.aquatic_other': 'peces',
  'ani.marine': 'peces',
  'ani.bird_pet': 'aves',
  'ani.bird_group': 'aves',
  'ani.lizard': 'reptiles',
  'ani.lizard_group': 'reptiles',
  'ani.snake': 'reptiles',
  'ani.reptile_group': 'reptiles',
  'ani.small': 'pequenos',
  'ani.small_group': 'pequenos',
  'ani.poultry': 'corral',
  'ani.poultry_group': 'corral',
  'ani.amphibian': 'anfibios',
  'ani.amphibian_group': 'anfibios',
}

export function animalFamilyOf(code: string): AnimalFamily {
  const [root, branch, leaf] = code.split('.')
  if (!root || !branch) return 'otros'
  const prefix = `${root}.${branch}`
  if (prefix === 'ani.dom') {
    if (leaf === 'dog') return 'perro'
    if (leaf === 'cat') return 'gato'
    return 'pequenos'
  }
  return PREFIX_FAMILY[prefix] ?? 'otros'
}

export interface AnimalSpecies {
  key: string
  label: string
  /** Every `animal.target:<code>` token behind this label, in server order. */
  tokens: string[]
  count: number
  selected: boolean
}

export interface AnimalGroup {
  key: AnimalFamily
  /** The family label; the species label when the group collapsed into a direct chip. */
  label: string
  allLabel: string
  icon: string
  species: AnimalSpecies[]
  /** Sum of the species counts; a product tagged with two species of the group counts twice. */
  total: number
  /** One species only: the chip is that species, with no species row. */
  single: boolean
  selectedCount: number
  whole: boolean
  partial: boolean
  pressed: boolean
}

export interface AnimalStrip {
  groups: AnimalGroup[]
  /** Species with products, or selected. */
  optionCount: number
  visible: boolean
  /** «Todos»: no `animal.target` token in the URL (other filters do not matter). */
  allPressed: boolean
}

const byRelevance = (a: AnimalSpecies, b: AnimalSpecies) =>
  b.count - a.count || a.label.localeCompare(b.label, 'es')

const hasAnimalToken = (tokens: string[]) =>
  tokens.some((token) => token.startsWith(ANIMAL_TOKEN_PREFIX))

/** The code behind a species token, to resolve its family. */
function codeOfToken(token: string): string {
  return token.startsWith(ANIMAL_TOKEN_PREFIX) ? token.slice(ANIMAL_TOKEN_PREFIX.length) : token
}

/**
 * Groups, species and selection state of the animal strip, from the `animal.target` facet and the
 * facet tokens in the URL. Options without products are noise unless selected, so a selected one
 * stays visible and removable.
 */
export function buildAnimalStrip(
  facet: PublicCatalogAttributeFacetDto | null,
  selectedTokens: string[],
): AnimalStrip {
  const allPressed = !hasAnimalToken(selectedTokens)
  if (!facet) return { groups: [], optionCount: 0, visible: false, allPressed }
  const selected = new Set(selectedTokens)
  const byFamily = new Map<AnimalFamily, AnimalSpecies[]>()
  let optionCount = 0
  for (const merged of mergeFacetOptions(facet)) {
    const isSelected = merged.tokens.some((token) => selected.has(token))
    if (merged.count <= 0 && !isSelected) continue
    optionCount += 1
    const family = animalFamilyOf(codeOfToken(merged.tokens[0]!))
    const list = byFamily.get(family) ?? []
    list.push({
      key: merged.tokens[0]!,
      label: merged.label,
      tokens: merged.tokens,
      count: merged.count,
      selected: isSelected,
    })
    byFamily.set(family, list)
  }

  const groups = [...byFamily].map(([key, list]): AnimalGroup => {
    const species = [...list].sort(byRelevance)
    const info = FAMILIES[key]
    const single = species.length === 1
    const selectedCount = species.filter((item) => item.selected).length
    const whole = selectedCount === species.length
    return {
      key,
      label: single ? species[0]!.label : info.label,
      allLabel: info.allLabel,
      icon: info.icon,
      species,
      total: species.reduce((sum, item) => sum + item.count, 0),
      single,
      selectedCount,
      whole,
      partial: selectedCount > 0 && !whole,
      pressed: selectedCount > 0,
    }
  })
  groups.sort(
    (a, b) =>
      b.total - a.total ||
      FAMILIES[a.key].order - FAMILIES[b.key].order ||
      a.label.localeCompare(b.label, 'es'),
  )
  return {
    groups,
    optionCount,
    visible: optionCount >= ANIMAL_MIN_OPTIONS || groups.some((group) => group.pressed),
    allPressed,
  }
}

const tokensOf = (group: AnimalGroup) => group.species.flatMap((item) => item.tokens)

/** Choosing a group selects every one of its species tokens (the server ORs them). */
export function selectAnimalGroup(current: string[], group: AnimalGroup): string[] {
  return [...current, ...tokensOf(group).filter((token) => !current.includes(token))]
}

export function clearAnimalGroup(current: string[], group: AnimalGroup): string[] {
  const own = new Set(tokensOf(group))
  return current.filter((token) => !own.has(token))
}

/**
 * Picking a species: inside a whole group it narrows the group to that species; otherwise it
 * adds or removes just that species, leaving every other animal and filter alone.
 */
export function toggleAnimalSpecies(
  current: string[],
  group: AnimalGroup,
  species: AnimalSpecies,
): string[] {
  if (group.whole && group.species.length > 1)
    return [...clearAnimalGroup(current, group), ...species.tokens]
  if (species.selected) return current.filter((token) => !species.tokens.includes(token))
  return [...current, ...species.tokens.filter((token) => !current.includes(token))]
}

/** The species pills a collapsed row shows; selected species are never hidden. */
export function collapseSpecies(
  group: AnimalGroup,
  expanded: boolean,
): { shown: AnimalSpecies[]; hidden: number } {
  if (expanded || group.species.length <= ANIMAL_COLLAPSED_SPECIES)
    return { shown: group.species, hidden: 0 }
  // A whole group is carried by its «Todos» pill; only a partial choice marks species.
  const shown = group.species.filter(
    (item, index) => index < ANIMAL_COLLAPSED_SPECIES || (group.partial && item.selected),
  )
  return { shown, hidden: group.species.length - shown.length }
}

/**
 * Scroll position that brings a selection into view in a horizontally scrolling row: centred
 * when it fits, otherwise starting near the left edge (design 05 `initScroll`).
 */
export function scrollOffsetToReveal(input: {
  start: number
  end: number
  viewport: number
}): number {
  const span = input.end - input.start
  const target =
    span < input.viewport ? input.start - (input.viewport - span) / 2 : input.start - 12
  return Math.max(0, target)
}
