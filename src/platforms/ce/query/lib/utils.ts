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
    QueryBuilderState,
    QueryBuilderDataType,
} from './types';
import { getOperatorsForType, getOperatorByValue, operatorRequiresValue } from './operators';

/** Fallback fields for when none are provided */
export const FALLBACK_FIELDS: QueryBuilderField[] = [
    { id: 'name', label: 'Name', dataType: 'string' },
    { id: 'createdon', label: 'Created On', dataType: 'datetime' },
    {
        id: 'statecode',
        label: 'State',
        dataType: 'optionset',
        options: [
            { label: 'Active', value: 0 },
            { label: 'Inactive', value: 1 },
        ],
    },
    { id: 'ownerid', label: 'Owner', dataType: 'lookup' },
];

/**
 * Validation error details
 */
export interface QueryBuilderValidationError {
    groupId: string;
    conditionId: string;
    fieldLabel: string;
    message: string;
}

/**
 * Validation result
 */
export interface QueryBuilderValidationResult {
    isValid: boolean;
    errors: QueryBuilderValidationError[];
    apiValidation?: {
        available: boolean;
        tested: boolean;
        success?: boolean;
        recordCount?: number;
        errorMessage?: string;
    };
}

/**
 * Validate the QueryBuilder state
 */
export const validateQueryBuilderState = (
    state: QueryBuilderState,
    fields: QueryBuilderField[]
): QueryBuilderValidationResult => {
    const errors: QueryBuilderValidationError[] = [];

    for (const group of state.groups) {
        if (group.conditions.length === 0) {
            errors.push({
                groupId: group.id,
                conditionId: '',
                fieldLabel: 'Group',
                message: 'Group has no conditions',
            });
            continue;
        }

        for (const condition of group.conditions) {
            if (condition.kind === 'relatedEntity') {
                validateRelatedEntityCondition(condition, group.id, errors);
                continue;
            }

            validateFieldCondition(condition, group.id, fields, errors);
        }
    }

    return {
        isValid: errors.length === 0,
        errors,
    };
};

/**
 * Validate a related entity condition
 */
const validateRelatedEntityCondition = (
    condition: QueryBuilderCondition,
    groupId: string,
    errors: QueryBuilderValidationError[]
): void => {
    if (!condition.relatedEntityName) {
        errors.push({
            groupId,
            conditionId: condition.id,
            fieldLabel: 'Related Entity',
            message: 'Related entity not selected',
        });
        return;
    }

    if (!condition.nestedConditions || condition.nestedConditions.length === 0) {
        errors.push({
            groupId,
            conditionId: condition.id,
            fieldLabel: 'Related Entity',
            message: 'At least one nested condition is required',
        });
        return;
    }

    // Validate each nested condition
    const nestedFields = condition.nestedFields || [];
    for (const nestedCond of condition.nestedConditions) {
        const nestedField = nestedFields.find((f) => f.id === nestedCond.fieldId);
        const nestedFieldLabel = nestedField?.label || nestedCond.fieldId || 'Field';

        // Skip value check for operators that don't require values
        const requiresValue = operatorRequiresValue(nestedCond.operator);
        if (!requiresValue) continue;

        // Check for empty value (handle arrays for in/not-in)
        if (isValueEmpty(nestedCond.value)) {
            errors.push({
                groupId,
                conditionId: nestedCond.id,
                fieldLabel: nestedFieldLabel,
                message: 'Value is required',
            });
        }
    }
};

/**
 * Validate a field condition
 */
const validateFieldCondition = (
    condition: QueryBuilderCondition,
    groupId: string,
    fields: QueryBuilderField[],
    errors: QueryBuilderValidationError[]
): void => {
    const field = fields.find((f) => f.id === condition.fieldId);
    const fieldLabel = field?.label || condition.fieldId;

    // Check if field exists
    if (!field) {
        errors.push({
            groupId,
            conditionId: condition.id,
            fieldLabel,
            message: `Unknown field: ${condition.fieldId}`,
        });
        return;
    }

    // Skip value check for operators that don't require values
    const requiresValue = operatorRequiresValue(condition.operator);
    if (!requiresValue) return;

    // Check for empty value
    if (isValueEmpty(condition.value)) {
        errors.push({
            groupId,
            conditionId: condition.id,
            fieldLabel,
            message: 'Value is required',
        });
    }

    // Check between/two-value operators have second value
    const operatorDef = getOperatorByValue(condition.operator);
    if (operatorDef?.requiresValue2) {
        if (isValueEmpty(condition.value2)) {
            errors.push({
                groupId,
                conditionId: condition.id,
                fieldLabel,
                message: 'Second value is required for this operator',
            });
        }
    }
};

/**
 * Check if a value is empty
 */
const isValueEmpty = (value: any): boolean => {
    if (value === undefined || value === null) return true;
    if (Array.isArray(value)) {
        return value.length === 0 || value.every(v => v === undefined || v === null || String(v).trim() === '');
    }
    return String(value).trim() === '';
};

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
export const DEFAULT_BOOLEAN_OPTIONS: QueryBuilderOption[] = [
    { label: 'Yes', value: '1' },
    { label: 'No', value: '0' },
];

/**
 * Boolean condition values arrive in several shapes depending on their source:
 * '1'/'0' from FetchXML, 'true'/'false' from OData, and real booleans from consumers.
 */
export const isTrueValue = (value: unknown): boolean => {
    if (typeof value === 'boolean') return value;
    const normalized = String(value ?? '').trim().toLowerCase();
    return normalized === '1' || normalized === 'true';
};

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
 * Format a picked date as YYYY-MM-DD using its local calendar components.
 *
 * The date picker returns local midnight. Going through toISOString() converts to UTC first,
 * which rolls the date back a day everywhere east of Greenwich (e.g. NZ), so the user filters
 * on the day before the one they picked.
 */
export const formatDateOnly = (date: Date | null | undefined): string => {
    if (!date || isNaN(date.getTime())) return '';
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
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
 * Create a new related entity condition
 */
export const createRelatedCondition = (
    relatedEntityName?: string,
    relatedEntityTarget?: string
): QueryBuilderCondition => ({
    id: `rel_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
    kind: 'relatedEntity',
    fieldId: relatedEntityName || '__related_entity__',
    operator: 'containsdata',
    value: '',
    value2: '',
    relatedEntityName,
    relatedEntityTarget,
    nestedConditions: [],
    nestedLogic: 'and',
    nestedFields: [],
});

/**
 * Create a new group
 */
export const createGroup = (defaultField: QueryBuilderField): QueryBuilderGroup => ({
    id: `grp_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
    logic: 'and',
    conditions: [createCondition(defaultField)],
});

/**
 * Clone state for immutable updates
 */
export const cloneState = (
    state: QueryBuilderState | undefined,
    defaultField: QueryBuilderField
): QueryBuilderState => {
    if (!state?.groups?.length) {
        // Root <fetch> options survive an empty/absent group list - they describe the
        // query envelope, not the filter, so there is nothing to reset them alongside
        return { groups: [createGroup(defaultField)], queryOptions: state?.queryOptions };
    }

    return {
        queryOptions: state.queryOptions,
        groups: state.groups.map((group) => ({
            id: group.id || `grp_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
            logic: group.logic || 'and',
            conditions: (group.conditions || []).map((condition) => ({
                id: condition.id || `cond_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
                kind: condition.kind || 'field',
                fieldId: condition.fieldId || defaultField.id,
                operator: (condition.operator || 'eq') as any,
                value: condition.value ?? '',
                value2: condition.value2 ?? '',
                relatedEntityName: condition.relatedEntityName,
                relatedEntityTarget: condition.relatedEntityTarget,
                nestedConditions: condition.nestedConditions ? [...condition.nestedConditions] : undefined,
                nestedLogic: condition.nestedLogic,
                nestedFields: condition.nestedFields ? [...condition.nestedFields] : undefined,
            })),
        })),
    };
};

/**
 * Generate a unique ID
 */
export const generateId = (prefix: string = 'id'): string => {
    return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
};

/**
 * Deep compare two QueryBuilder states
 */
export const statesEqual = (a: QueryBuilderState, b: QueryBuilderState): boolean => {
    return JSON.stringify(a) === JSON.stringify(b);
};

/**
 * Get operators available for a data type (for UI dropdown)
 */
export const getOperatorOptionsForType = (
    dataType: QueryBuilderDataType
): Array<{ value: string; label: string }> => {
    return getOperatorsForType(dataType).map(op => ({
        value: op.value,
        label: op.label,
    }));
};

/**
 * Check if an operator is valid for a data type
 */
export const isOperatorValidForType = (operator: string, dataType: QueryBuilderDataType): boolean => {
    const operators = getOperatorsForType(dataType);
    return operators.some(op => op.value === operator);
};
