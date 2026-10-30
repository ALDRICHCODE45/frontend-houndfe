export type EditorialUnit = { code: string | null; label: string | null; sortOrder: number }
export type EditorialOption = {
  code: string;
  label: string;
  archived: boolean;
  sortOrder: number;
}
export type EditorialGroup = { code: string; label: string; optionCodes: string[] }
export type EditorialAlias = { label: string; optionCode: string }
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
export type EditorialDefinition = { id: string; code: string; label: string } & (
  | { type: 'text' | 'boolean' }
  | { type: 'number' | 'range'; units: EditorialUnit[]; numericPolicy: EditorialNumericPolicy }
  | {
      type: 'single' | 'multi';
      options: EditorialOption[];
      groups: EditorialGroup[];
      aliases: EditorialAlias[];
    }
)
