import type {
  PublicCatalogAttributeFacetDto,
  PublicCatalogProductsCategoryFacetDto,
} from '../interfaces/public-catalog-products.types'
import { buildAnimalStrip, type AnimalGroup } from './animal-groups'
import { mergeFacetOptions } from './facet-options'

/** The recipient («¿Para quién?») definition: it feeds the animal strip, never a sidebar group. */
export const RECIPIENT_FACET_CODE = 'animal.target'
/** Options shown before «Ver más». */
export const FILTER_VISIBLE_OPTIONS = 5

const RECIPIENT_PREFIX = `${RECIPIENT_FACET_CODE}:`

/** What choosing a row changes in the URL query. */
export type FilterOptionTarget =
  | { kind: 'category'; id: string }
  | { kind: 'facet'; tokens: string[] }

export interface FilterOption {
  key: string
  label: string
  count: number
  pressed: boolean
  ariaLabel: string
  target: FilterOptionTarget
}

export interface FilterGroup {
  /** `category` or the facet definition code. */
  key: string
  kind: 'category' | 'facet'
  label: string
  options: FilterOption[]
  /** Labels of the pressed options, for a collapsed header. */
  selectedLabel: string
}

export interface FilterGroupsInput {
  categories: PublicCatalogProductsCategoryFacetDto[]
  attributes: PublicCatalogAttributeFacetDto[]
  categoryId: string | null
  tokens: string[]
}

export interface FilterChip {
  kind: 'facet'
  key: string
  label: string
  tokens: string[]
  /** Overrides the default «Quitar filtro: <label>»; set by the whole-group chip. */
  ariaLabel?: string
}

const productsLabel = (count: number) => `${count} ${count === 1 ? 'producto' : 'productos'}`

/** The recipient facet exists only when the response carries it with at least one option. */
export function findRecipientFacet(
  attributes: PublicCatalogAttributeFacetDto[] | undefined,
): PublicCatalogAttributeFacetDto | null {
  return (
    attributes?.find((facet) => facet.code === RECIPIENT_FACET_CODE && facet.options.length > 0) ??
    null
  )
}

/** A choice carries one token, or several when same-label options were merged into it. */
export function toggleFacetTokens(current: string[], optionTokens: string[]): string[] {
  const pressed = optionTokens.some((token) => current.includes(token))
  return pressed
    ? current.filter((token) => !optionTokens.includes(token))
    : [...current, ...optionTokens.filter((token) => !current.includes(token))]
}

export function clearRecipientTokens(current: string[]): string[] {
  return current.filter((token) => !token.startsWith(RECIPIENT_PREFIX))
}

function groupOf(
  key: string,
  kind: FilterGroup['kind'],
  label: string,
  options: FilterOption[],
): FilterGroup | null {
  // Options without products are noise; a group is worth a section with two real choices,
  // or while something in it is selected (so it can always be unselected).
  const shown = options.filter((option) => option.count > 0 || option.pressed)
  if (shown.length < 2 && !shown.some((option) => option.pressed)) return null
  return {
    key,
    kind,
    label,
    options: shown,
    selectedLabel: shown
      .filter((option) => option.pressed)
      .map((option) => option.label)
      .join(', '),
  }
}

/**
 * Sidebar and sheet groups: Categoría, then every attribute definition except the recipient.
 * While the response carries a recipient facet and nothing is selected, only Categoría is
 * offered (artboards 01 and 02: stage and size appear once a recipient is chosen), and
 * `recipientHint` says that more filters are waiting.
 */
export function buildFilterGroups(input: FilterGroupsInput): {
  groups: FilterGroup[]
  recipientHint: boolean
} {
  const selected = new Set(input.tokens)
  const groups: FilterGroup[] = []
  const categoryGroup = groupOf(
    'category',
    'category',
    'Categoría',
    input.categories.map((category) => ({
      key: category.id,
      label: category.name,
      count: category.count,
      pressed: category.id === input.categoryId,
      ariaLabel: `Categoría: ${category.name}, ${productsLabel(category.count)}`,
      target: { kind: 'category' as const, id: category.id },
    })),
  )
  if (categoryGroup) groups.push(categoryGroup)

  const attributeGroups: FilterGroup[] = []
  for (const definition of input.attributes) {
    if (definition.code === RECIPIENT_FACET_CODE) continue
    const group = groupOf(
      definition.code,
      'facet',
      definition.label,
      mergeFacetOptions(definition).map((option) => ({
        key: option.tokens[0]!,
        label: option.label,
        count: option.count,
        pressed: option.tokens.some((token) => selected.has(token)),
        ariaLabel: `${definition.label}: ${option.label}, ${productsLabel(option.count)}`,
        target: { kind: 'facet' as const, tokens: option.tokens },
      })),
    )
    if (group) attributeGroups.push(group)
  }

  // The gate only makes sense while the animal strip is on screen to open it (a branch with a
  // single animal hides the strip, and then nothing could ever unlock the other groups).
  const gated =
    buildAnimalStrip(findRecipientFacet(input.attributes), input.tokens).visible &&
    input.tokens.length === 0
  if (gated) return { groups, recipientHint: attributeGroups.length > 0 }
  return { groups: [...groups, ...attributeGroups], recipientHint: false }
}

function groupChip(group: AnimalGroup): FilterChip {
  return {
    kind: 'facet',
    key: `group:${group.key}`,
    label: `${group.label} (todas)`,
    ariaLabel: `Quitar filtro: ${group.label}, todas las especies`,
    tokens: group.species.flatMap((species) => species.tokens),
  }
}

/**
 * Selected facet tokens grouped as one chip per option label; tokens no facet labels stay one chip.
 * With `animalFacet` (the branch's unfiltered animal.target facet, the one the animal strip is
 * built from), a whole multi-species animal group collapses into one «<Grupo> (todas)» chip that
 * carries every token of the group; a partial selection and single-species groups keep their
 * per-species chips. Without it nothing is grouped.
 */
export function buildFacetChips(
  attributes: PublicCatalogAttributeFacetDto[],
  tokens: string[],
  animalFacet: PublicCatalogAttributeFacetDto | null = null,
): FilterChip[] {
  const selected = new Set(tokens)
  const chips: FilterChip[] = []
  const labelled = new Set<string>()
  const wholeGroups = buildAnimalStrip(animalFacet, tokens).groups.filter(
    (group) => group.whole && !group.single,
  )
  const groupOfToken = new Map<string, AnimalGroup>()
  for (const group of wholeGroups)
    for (const species of group.species)
      for (const token of species.tokens) groupOfToken.set(token, group)
  const emitted = new Set<AnimalGroup>()
  const emitGroup = (group: AnimalGroup) => {
    if (emitted.has(group)) return
    emitted.add(group)
    group.species.forEach((species) => species.tokens.forEach((token) => labelled.add(token)))
    chips.push(groupChip(group))
  }
  for (const definition of attributes) {
    for (const option of mergeFacetOptions(definition)) {
      const optionTokens = option.tokens.filter((token) => selected.has(token))
      if (optionTokens.length === 0) continue
      const group = groupOfToken.get(optionTokens[0]!)
      if (group) {
        emitGroup(group)
        continue
      }
      optionTokens.forEach((token) => labelled.add(token))
      chips.push({
        kind: 'facet',
        key: optionTokens[0]!,
        label: option.label,
        tokens: optionTokens,
      })
    }
  }
  // A group the displayed facets no longer list is still one chip, not «Otros filtros».
  wholeGroups.forEach(emitGroup)
  const rest = tokens.filter((token) => !labelled.has(token))
  if (rest.length > 0)
    chips.push({ kind: 'facet', key: 'facet-rest', label: 'Otros filtros', tokens: rest })
  return chips
}
