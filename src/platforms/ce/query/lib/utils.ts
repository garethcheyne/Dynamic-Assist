// Ported from fluentui-extended's QueryBuilder (github.com/garethcheyne/npm-fluentui-extended),
// src/components/QueryBuilder/QueryBuilder.utils.ts. Keep in step with it.
/**
 * QueryBuilder Utils
 * 
 * Validation, helpers, and metadata utilities for QueryBuilder.
 */

import type {
    QueryBuilderCondition,
    QueryBuilderField,
    QueryBuilderGroup,
    QueryBuilderOption,
    QueryBuilderDataType,
} from './types';
import { getOperatorsForType } from './operators';

/**
 * Normalize a Dynamics attribute type to a bare comparable token.
 *
 * The two metadata properties spell the same type differently: AttributeType returns
 * "Money"/"Picklist"/"Boolean" while AttributeTypeName.Value returns "MoneyType"/"PicklistType"/
 * "BooleanType". Stripping the trailing "type" makes both forms compare equal.
 */
const normalizeAttributeType = (typeValue: unknown): string =>
    String(typeValue ?? '').toLowerCase().replace(/type$/, '');

/** Preserve the original Dynamics attribute type token for UI-level distinctions. */
export const attributeTypeFromAttribute = (attribute: any): string => {
    const typeValue = attribute?.AttributeTypeName?.Value || attribute?.AttributeType || attribute?.Type || '';
    return normalizeAttributeType(typeValue);
};

/**
 * Infer data type from Dynamics 365 attribute metadata
 */
export const dataTypeFromAttribute = (attribute: any): QueryBuilderDataType => {
    // Handle both AttributeType (string) and AttributeTypeName (object with Value property)
    const type = attributeTypeFromAttribute(attribute);

    // Check if the attribute has Targets array - definitive indicator of lookup
    if (attribute?.Targets && Array.isArray(attribute.Targets) && attribute.Targets.length > 0) {
        return 'lookup';
    }

    if (['picklist', 'state', 'status'].includes(type)) return 'optionset';
    if (['lookup', 'customer', 'owner', 'partylist', 'uniqueidentifier'].includes(type)) return 'lookup';
    if (['datetime'].includes(type)) return 'datetime';
    if (['boolean'].includes(type)) return 'boolean';
    if (['integer', 'decimal', 'double', 'money', 'bigint', 'int'].includes(type)) return 'number';

    return 'string';
};

/**
 * Labels shown for boolean fields before (or instead of) their metadata being loaded.
 * Values match the FetchXML representation of a boolean condition.
 */
const DEFAULT_BOOLEAN_OPTIONS: QueryBuilderOption[] = [
    { label: 'Yes', value: '1' },
    { label: 'No', value: '0' },
];

/** Read a localized label off an option set option, falling back when unlocalized */
const optionLabel = (option: any, fallback: string): string =>
    option?.Label?.UserLocalizedLabel?.Label
    || (typeof option?.Label === 'string' ? option.Label : undefined)
    || fallback;

/**
 * Build the selectable values for a field from Dynamics option set metadata.
 *
 * Covers the Options list on picklist/state/status attributes and the TrueOption/FalseOption
 * pair on boolean attributes, from either a local (OptionSet) or global (GlobalOptionSet) set.
 */
export const buildFieldOptions = (
    attribute: any,
    dataType: QueryBuilderDataType
): QueryBuilderOption[] | undefined => {
    const optionSet = attribute?.OptionSet || attribute?.GlobalOptionSet;
    if (!optionSet) return undefined;

    if (dataType === 'boolean') {
        if (!optionSet.TrueOption && !optionSet.FalseOption) return undefined;
        return [
            { label: optionLabel(optionSet.TrueOption, 'Yes'), value: '1' },
            { label: optionLabel(optionSet.FalseOption, 'No'), value: '0' },
        ];
    }

    if (dataType !== 'optionset' || !Array.isArray(optionSet.Options)) return undefined;

    const options = optionSet.Options
        .filter((option: any) => option?.Value !== undefined && option?.Value !== null)
        .map((option: any) => ({
            label: optionLabel(option, String(option.Value)),
            value: option.Value as string | number,
        }));

    return options.length > 0 ? options : undefined;
};

/**
 * Get default value for a field based on its type
 */
export const getDefaultValueForField = (field: QueryBuilderField): string | number | boolean => {
    if (field.dataType === 'optionset' && field.options && field.options.length > 0) {
        return String(field.options[0].value);
    }
    if (field.dataType === 'boolean') {
        return String(field.options?.[0]?.value ?? DEFAULT_BOOLEAN_OPTIONS[0].value);
    }
    return '';
};

/**
 * Create a new condition for a field
 */
export const createCondition = (defaultField: QueryBuilderField): QueryBuilderCondition => {
    const operators = getOperatorsForType(defaultField.dataType);
    return {
        id: `cond_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
        kind: 'field',
        fieldId: defaultField.id,
        operator: operators[0]?.value as any || 'eq',
        value: getDefaultValueForField(defaultField),
        value2: '',
    };
};

/**
 * Create a new group
 */
export const createGroup = (defaultField: QueryBuilderField): QueryBuilderGroup => ({
    id: `grp_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
    logic: 'and',
    conditions: [createCondition(defaultField)],
});

/**
 * Check if an operator is valid for a data type
 */
export const isOperatorValidForType = (operator: string, dataType: QueryBuilderDataType): boolean => {
    const operators = getOperatorsForType(dataType);
    return operators.some(op => op.value === operator);
};
