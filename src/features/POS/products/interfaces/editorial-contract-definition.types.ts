type EditorialUnit = { code: string | null; label: string | null; sortOrder: number }
type EditorialOption = {
  code: string;
  label: string;
  archived: boolean;
  sortOrder: number;
}
type EditorialGroup = { code: string; label: string; optionCodes: string[] }
type EditorialAlias = { label: string; optionCode: string }
export type EditorialNumericPolicy =
  | { status: 'pending' }
  | {
      status: 'resolved';
      magnitude: string;
      integer: boolean;
      lower: number | null;
      lowerInclusive: boolean;
      upper: number | null;
      upperInclusive: boolean;
    }
/** `description` is optional help text owned by the backend vocabulary; absent or null means none. */
export type EditorialDefinition = { id: string; code: string; label: string; description?: string | null } & (
  | { type: 'text' | 'boolean' }
  | { type: 'number' | 'range'; units: EditorialUnit[]; numericPolicy: EditorialNumericPolicy }
  | {
      type: 'single' | 'multi';
      options: EditorialOption[];
      groups: EditorialGroup[];
      aliases: EditorialAlias[];
    }
)
