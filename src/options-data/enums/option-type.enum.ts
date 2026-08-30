export const OPTION_TYPES = ['CALL', 'PUT'] as const;

export type OptionType = (typeof OPTION_TYPES)[number];

export const CONTRACT_TYPE_FILTERS = ['CALL', 'PUT', 'ALL'] as const;

/** Contract type selector accepted by callers; `ALL` keeps calls and puts. */
export type ContractTypeFilter = (typeof CONTRACT_TYPE_FILTERS)[number];
