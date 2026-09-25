// Ported from fluentui-extended's QueryBuilder (github.com/garethcheyne/npm-fluentui-extended),
// src/components/QueryBuilder/QueryBuilder.operators.ts. Keep in step with it.
/**
 * QueryBuilder Operators
 * 
 * Based on Microsoft Dynamics 365 FetchXML condition operators.
 * Reference: FetchXMLBuilder by Jonas Rapp (https://github.com/rappen/FetchXMLBuilder)
 */

import type { QueryBuilderDataType } from './types';

export interface OperatorDefinition {
    /** FetchXML operator value (e.g., 'eq', 'like', 'last-x-days') */
    value: string;
    /** Display label for UI */
    label: string;
    /** Whether operator requires a value */
    requiresValue: boolean;
    /** Whether operator requires a second value (e.g., between) */
    requiresValue2?: boolean;
    /** Whether operator accepts multiple values (e.g., in, not-in) */
    multipleValues?: boolean;
    /** Value type expected (number for X-days operators, date for on/on-or-before) */
    valueType?: 'number' | 'date' | 'string' | 'same';
    /** OData equivalent operator or function */
    odataOperator?: string;
    /** If true, this is a FetchXML-only operator with no OData equivalent */
    fetchXmlOnly?: boolean;
    /** Category for grouping in UI */
    category?: 'comparison' | 'text' | 'null' | 'date' | 'relative-date' | 'user-context' | 'hierarchy' | 'multi-value';
}

/**
 * All FetchXML condition operators supported by Dynamics 365
 */
export const ALL_OPERATORS: Record<string, OperatorDefinition> = {
    // === Comparison Operators (all types) ===
    'eq': {
        value: 'eq',
        label: 'Equals',
        requiresValue: true,
        odataOperator: 'eq',
        category: 'comparison',
    },
    'ne': {
        value: 'ne',
        label: 'Does Not Equal',
        requiresValue: true,
        odataOperator: 'ne',
        category: 'comparison',
    },
    'gt': {
        value: 'gt',
        label: 'Greater Than',
        requiresValue: true,
        odataOperator: 'gt',
        category: 'comparison',
    },
    'ge': {
        value: 'ge',
        label: 'Greater Than Or Equal',
        requiresValue: true,
        odataOperator: 'ge',
        category: 'comparison',
    },
    'lt': {
        value: 'lt',
        label: 'Less Than',
        requiresValue: true,
        odataOperator: 'lt',
        category: 'comparison',
    },
    'le': {
        value: 'le',
        label: 'Less Than Or Equal',
        requiresValue: true,
        odataOperator: 'le',
        category: 'comparison',
    },

    // === Null Operators (all types) ===
    'null': {
        value: 'null',
        label: 'Is Empty',
        requiresValue: false,
        odataOperator: 'eq null',
        category: 'null',
    },
    'not-null': {
        value: 'not-null',
        label: 'Has Value',
        requiresValue: false,
        odataOperator: 'ne null',
        category: 'null',
    },

    // === Text/String Operators ===
    'like': {
        value: 'like',
        label: 'Like (Wildcard)',
        requiresValue: true,
        valueType: 'string',
        fetchXmlOnly: true, // OData uses functions
        category: 'text',
    },
    'not-like': {
        value: 'not-like',
        label: 'Not Like (Wildcard)',
        requiresValue: true,
        valueType: 'string',
        fetchXmlOnly: true,
        category: 'text',
    },
    'begins-with': {
        value: 'begins-with',
        label: 'Begins With',
        requiresValue: true,
        valueType: 'string',
        odataOperator: 'startswith',
        category: 'text',
    },
    'not-begin-with': {
        value: 'not-begin-with',
        label: 'Does Not Begin With',
        requiresValue: true,
        valueType: 'string',
        odataOperator: 'not startswith',
        category: 'text',
    },
    'ends-with': {
        value: 'ends-with',
        label: 'Ends With',
        requiresValue: true,
        valueType: 'string',
        odataOperator: 'endswith',
        category: 'text',
    },
    'not-end-with': {
        value: 'not-end-with',
        label: 'Does Not End With',
        requiresValue: true,
        valueType: 'string',
        odataOperator: 'not endswith',
        category: 'text',
    },
    'contains': {
        value: 'contains',
        label: 'Contains',
        requiresValue: true,
        valueType: 'string',
        odataOperator: 'contains',
        category: 'text',
    },
    'not-contain': {
        value: 'not-contain',
        label: 'Does Not Contain',
        requiresValue: true,
        valueType: 'string',
        odataOperator: 'not contains',
        category: 'text',
    },

    // === Multi-Value Operators ===
    'in': {
        value: 'in',
        label: 'Is One Of',
        requiresValue: true,
        multipleValues: true,
        odataOperator: 'in',
        category: 'multi-value',
    },
    'not-in': {
        value: 'not-in',
        label: 'Is Not One Of',
        requiresValue: true,
        multipleValues: true,
        fetchXmlOnly: true, // OData requires multiple ne conditions
        category: 'multi-value',
    },
    'between': {
        value: 'between',
        label: 'Between',
        requiresValue: true,
        requiresValue2: true,
        multipleValues: true,
        fetchXmlOnly: true, // OData uses ge/le combination
        category: 'multi-value',
    },
    'not-between': {
        value: 'not-between',
        label: 'Not Between',
        requiresValue: true,
        requiresValue2: true,
        multipleValues: true,
        fetchXmlOnly: true,
        category: 'multi-value',
    },

    // === Multi-Select Picklist Operators ===
    'contain-values': {
        value: 'contain-values',
        label: 'Contains Values',
        requiresValue: true,
        multipleValues: true,
        fetchXmlOnly: true,
        category: 'multi-value',
    },
    'not-contain-values': {
        value: 'not-contain-values',
        label: 'Does Not Contain Values',
        requiresValue: true,
        multipleValues: true,
        fetchXmlOnly: true,
        category: 'multi-value',
    },

    // === Date Comparison Operators ===
    'on': {
        value: 'on',
        label: 'On',
        requiresValue: true,
        valueType: 'date',
        odataOperator: 'eq',
        category: 'date',
    },
    'on-or-before': {
        value: 'on-or-before',
        label: 'On Or Before',
        requiresValue: true,
        valueType: 'date',
        odataOperator: 'le',
        category: 'date',
    },
    'on-or-after': {
        value: 'on-or-after',
        label: 'On Or After',
        requiresValue: true,
        valueType: 'date',
        odataOperator: 'ge',
        category: 'date',
    },
    'not-on': {
        value: 'not-on',
        label: 'Not On',
        requiresValue: true,
        valueType: 'date',
        odataOperator: 'ne',
        category: 'date',
    },

    // === Relative Date Operators (no value required) ===
    'today': {
        value: 'today',
        label: 'Today',
        requiresValue: false,
        fetchXmlOnly: true,
        category: 'relative-date',
    },
    'yesterday': {
        value: 'yesterday',
        label: 'Yesterday',
        requiresValue: false,
        fetchXmlOnly: true,
        category: 'relative-date',
    },
    'tomorrow': {
        value: 'tomorrow',
        label: 'Tomorrow',
        requiresValue: false,
        fetchXmlOnly: true,
        category: 'relative-date',
    },
    'this-week': {
        value: 'this-week',
        label: 'This Week',
        requiresValue: false,
        fetchXmlOnly: true,
        category: 'relative-date',
    },
    'last-week': {
        value: 'last-week',
        label: 'Last Week',
        requiresValue: false,
        fetchXmlOnly: true,
        category: 'relative-date',
    },
    'next-week': {
        value: 'next-week',
        label: 'Next Week',
        requiresValue: false,
        fetchXmlOnly: true,
        category: 'relative-date',
    },
    'this-month': {
        value: 'this-month',
        label: 'This Month',
        requiresValue: false,
        fetchXmlOnly: true,
        category: 'relative-date',
    },
    'last-month': {
        value: 'last-month',
        label: 'Last Month',
        requiresValue: false,
        fetchXmlOnly: true,
        category: 'relative-date',
    },
    'next-month': {
        value: 'next-month',
        label: 'Next Month',
        requiresValue: false,
        fetchXmlOnly: true,
        category: 'relative-date',
    },
    'this-year': {
        value: 'this-year',
        label: 'This Year',
        requiresValue: false,
        fetchXmlOnly: true,
        category: 'relative-date',
    },
    'last-year': {
        value: 'last-year',
        label: 'Last Year',
        requiresValue: false,
        fetchXmlOnly: true,
        category: 'relative-date',
    },
    'next-year': {
        value: 'next-year',
        label: 'Next Year',
        requiresValue: false,
        fetchXmlOnly: true,
        category: 'relative-date',
    },
    'last-seven-days': {
        value: 'last-seven-days',
        label: 'Last 7 Days',
        requiresValue: false,
        fetchXmlOnly: true,
        category: 'relative-date',
    },
    'next-seven-days': {
        value: 'next-seven-days',
        label: 'Next 7 Days',
        requiresValue: false,
        fetchXmlOnly: true,
        category: 'relative-date',
    },

    // === Relative Date Operators with X Value ===
    'last-x-hours': {
        value: 'last-x-hours',
        label: 'Last X Hours',
        requiresValue: true,
        valueType: 'number',
        fetchXmlOnly: true,
        category: 'relative-date',
    },
    'next-x-hours': {
        value: 'next-x-hours',
        label: 'Next X Hours',
        requiresValue: true,
        valueType: 'number',
        fetchXmlOnly: true,
        category: 'relative-date',
    },
    'last-x-days': {
        value: 'last-x-days',
        label: 'Last X Days',
        requiresValue: true,
        valueType: 'number',
        fetchXmlOnly: true,
        category: 'relative-date',
    },
    'next-x-days': {
        value: 'next-x-days',
        label: 'Next X Days',
        requiresValue: true,
        valueType: 'number',
        fetchXmlOnly: true,
        category: 'relative-date',
    },
    'last-x-weeks': {
        value: 'last-x-weeks',
        label: 'Last X Weeks',
        requiresValue: true,
        valueType: 'number',
        fetchXmlOnly: true,
        category: 'relative-date',
    },
    'next-x-weeks': {
        value: 'next-x-weeks',
        label: 'Next X Weeks',
        requiresValue: true,
        valueType: 'number',
        fetchXmlOnly: true,
        category: 'relative-date',
    },
    'last-x-months': {
        value: 'last-x-months',
        label: 'Last X Months',
        requiresValue: true,
        valueType: 'number',
        fetchXmlOnly: true,
        category: 'relative-date',
    },
    'next-x-months': {
        value: 'next-x-months',
        label: 'Next X Months',
        requiresValue: true,
        valueType: 'number',
        fetchXmlOnly: true,
        category: 'relative-date',
    },
    'last-x-years': {
        value: 'last-x-years',
        label: 'Last X Years',
        requiresValue: true,
        valueType: 'number',
        fetchXmlOnly: true,
        category: 'relative-date',
    },
    'next-x-years': {
        value: 'next-x-years',
        label: 'Next X Years',
        requiresValue: true,
        valueType: 'number',
        fetchXmlOnly: true,
        category: 'relative-date',
    },
    'older-than-x-minutes': {
        value: 'olderthan-x-minutes',
        label: 'Older Than X Minutes',
        requiresValue: true,
        valueType: 'number',
        fetchXmlOnly: true,
        category: 'relative-date',
    },
    'older-than-x-hours': {
        value: 'olderthan-x-hours',
        label: 'Older Than X Hours',
        requiresValue: true,
        valueType: 'number',
        fetchXmlOnly: true,
        category: 'relative-date',
    },
    'older-than-x-days': {
        value: 'olderthan-x-days',
        label: 'Older Than X Days',
        requiresValue: true,
        valueType: 'number',
        fetchXmlOnly: true,
        category: 'relative-date',
    },
    'older-than-x-weeks': {
        value: 'olderthan-x-weeks',
        label: 'Older Than X Weeks',
        requiresValue: true,
        valueType: 'number',
        fetchXmlOnly: true,
        category: 'relative-date',
    },
    'older-than-x-months': {
        value: 'olderthan-x-months',
        label: 'Older Than X Months',
        requiresValue: true,
        valueType: 'number',
        fetchXmlOnly: true,
        category: 'relative-date',
    },
    'older-than-x-years': {
        value: 'olderthan-x-years',
        label: 'Older Than X Years',
        requiresValue: true,
        valueType: 'number',
        fetchXmlOnly: true,
        category: 'relative-date',
    },

    // === Fiscal Period Operators ===
    'this-fiscal-year': {
        value: 'this-fiscal-year',
        label: 'This Fiscal Year',
        requiresValue: false,
        fetchXmlOnly: true,
        category: 'relative-date',
    },
    'this-fiscal-period': {
        value: 'this-fiscal-period',
        label: 'This Fiscal Period',
        requiresValue: false,
        fetchXmlOnly: true,
        category: 'relative-date',
    },
    'last-fiscal-year': {
        value: 'last-fiscal-year',
        label: 'Last Fiscal Year',
        requiresValue: false,
        fetchXmlOnly: true,
        category: 'relative-date',
    },
    'last-fiscal-period': {
        value: 'last-fiscal-period',
        label: 'Last Fiscal Period',
        requiresValue: false,
        fetchXmlOnly: true,
        category: 'relative-date',
    },
    'next-fiscal-year': {
        value: 'next-fiscal-year',
        label: 'Next Fiscal Year',
        requiresValue: false,
        fetchXmlOnly: true,
        category: 'relative-date',
    },
    'next-fiscal-period': {
        value: 'next-fiscal-period',
        label: 'Next Fiscal Period',
        requiresValue: false,
        fetchXmlOnly: true,
        category: 'relative-date',
    },
    'last-x-fiscal-years': {
        value: 'last-x-fiscal-years',
        label: 'Last X Fiscal Years',
        requiresValue: true,
        valueType: 'number',
        fetchXmlOnly: true,
        category: 'relative-date',
    },
    'last-x-fiscal-periods': {
        value: 'last-x-fiscal-periods',
        label: 'Last X Fiscal Periods',
        requiresValue: true,
        valueType: 'number',
        fetchXmlOnly: true,
        category: 'relative-date',
    },
    'next-x-fiscal-years': {
        value: 'next-x-fiscal-years',
        label: 'Next X Fiscal Years',
        requiresValue: true,
        valueType: 'number',
        fetchXmlOnly: true,
        category: 'relative-date',
    },
    'next-x-fiscal-periods': {
        value: 'next-x-fiscal-periods',
        label: 'Next X Fiscal Periods',
        requiresValue: true,
        valueType: 'number',
        fetchXmlOnly: true,
        category: 'relative-date',
    },
    'in-fiscal-year': {
        value: 'in-fiscal-year',
        label: 'In Fiscal Year',
        requiresValue: true,
        valueType: 'number',
        fetchXmlOnly: true,
        category: 'relative-date',
    },
    'in-fiscal-period': {
        value: 'in-fiscal-period',
        label: 'In Fiscal Period',
        requiresValue: true,
        valueType: 'number',
        fetchXmlOnly: true,
        category: 'relative-date',
    },
    'in-fiscal-period-and-year': {
        value: 'in-fiscal-period-and-year',
        label: 'In Fiscal Period And Year',
        requiresValue: true,
        requiresValue2: true,
        valueType: 'number',
        fetchXmlOnly: true,
        category: 'relative-date',
    },
    'in-or-before-fiscal-period-and-year': {
        value: 'in-or-before-fiscal-period-and-year',
        label: 'In Or Before Fiscal Period And Year',
        requiresValue: true,
        requiresValue2: true,
        valueType: 'number',
        fetchXmlOnly: true,
        category: 'relative-date',
    },
    'in-or-after-fiscal-period-and-year': {
        value: 'in-or-after-fiscal-period-and-year',
        label: 'In Or After Fiscal Period And Year',
        requiresValue: true,
        requiresValue2: true,
        valueType: 'number',
        fetchXmlOnly: true,
        category: 'relative-date',
    },

    // === User Context Operators ===
    'eq-userid': {
        value: 'eq-userid',
        label: 'Equals Current User',
        requiresValue: false,
        fetchXmlOnly: true,
        category: 'user-context',
    },
    'ne-userid': {
        value: 'ne-userid',
        label: 'Does Not Equal Current User',
        requiresValue: false,
        fetchXmlOnly: true,
        category: 'user-context',
    },
    'eq-userteams': {
        value: 'eq-userteams',
        label: 'Equals Current User Teams',
        requiresValue: false,
        fetchXmlOnly: true,
        category: 'user-context',
    },
    'eq-useroruserteams': {
        value: 'eq-useroruserteams',
        label: 'Equals Current User Or User Teams',
        requiresValue: false,
        fetchXmlOnly: true,
        category: 'user-context',
    },
    'eq-useroruserhierarchy': {
        value: 'eq-useroruserhierarchy',
        label: 'Equals Current User Or User Hierarchy',
        requiresValue: false,
        fetchXmlOnly: true,
        category: 'user-context',
    },
    'eq-useroruserhierarchyandteams': {
        value: 'eq-useroruserhierarchyandteams',
        label: 'Equals Current User Or User Hierarchy And Teams',
        requiresValue: false,
        fetchXmlOnly: true,
        category: 'user-context',
    },
    'eq-businessid': {
        value: 'eq-businessid',
        label: 'Equals Current Business Unit',
        requiresValue: false,
        fetchXmlOnly: true,
        category: 'user-context',
    },
    'ne-businessid': {
        value: 'ne-businessid',
        label: 'Does Not Equal Current Business Unit',
        requiresValue: false,
        fetchXmlOnly: true,
        category: 'user-context',
    },
    'eq-userlanguage': {
        value: 'eq-userlanguage',
        label: 'Equals Current User Language',
        requiresValue: false,
        fetchXmlOnly: true,
        category: 'user-context',
    },

    // === Hierarchy Operators ===
    'above': {
        value: 'above',
        label: 'Above',
        requiresValue: true,
        fetchXmlOnly: true,
        category: 'hierarchy',
    },
    'eq-or-above': {
        value: 'eq-or-above',
        label: 'Above Or Equal',
        requiresValue: true,
        fetchXmlOnly: true,
        category: 'hierarchy',
    },
    'under': {
        value: 'under',
        label: 'Under',
        requiresValue: true,
        fetchXmlOnly: true,
        category: 'hierarchy',
    },
    'eq-or-under': {
        value: 'eq-or-under',
        label: 'Under Or Equal',
        requiresValue: true,
        fetchXmlOnly: true,
        category: 'hierarchy',
    },
    'not-under': {
        value: 'not-under',
        label: 'Not Under',
        requiresValue: true,
        fetchXmlOnly: true,
        category: 'hierarchy',
    },
};

/**
 * Get operators available for a specific data type
 */
export const getOperatorsForType = (dataType: QueryBuilderDataType): OperatorDefinition[] => {
    // Base operators available for all types
    const base: OperatorDefinition[] = [
        ALL_OPERATORS['eq'],
        ALL_OPERATORS['ne'],
        ALL_OPERATORS['null'],
        ALL_OPERATORS['not-null'],
    ];

    switch (dataType) {
        case 'string':
            return [
                // Text-specific operators first
                ALL_OPERATORS['contains'],
                ALL_OPERATORS['not-contain'],
                ALL_OPERATORS['begins-with'],
                ALL_OPERATORS['not-begin-with'],
                ALL_OPERATORS['ends-with'],
                ALL_OPERATORS['not-end-with'],
                ALL_OPERATORS['like'],
                ALL_OPERATORS['not-like'],
                ...base,
            ];

        case 'number':
            return [
                ALL_OPERATORS['gt'],
                ALL_OPERATORS['ge'],
                ALL_OPERATORS['lt'],
                ALL_OPERATORS['le'],
                ALL_OPERATORS['between'],
                ALL_OPERATORS['not-between'],
                ...base,
                ALL_OPERATORS['in'],
                ALL_OPERATORS['not-in'],
            ];

        case 'datetime':
            return [
                // Comparison
                ALL_OPERATORS['on'],
                ALL_OPERATORS['on-or-before'],
                ALL_OPERATORS['on-or-after'],
                ALL_OPERATORS['not-on'],
                ALL_OPERATORS['gt'],
                ALL_OPERATORS['ge'],
                ALL_OPERATORS['lt'],
                ALL_OPERATORS['le'],
                ALL_OPERATORS['between'],
                ALL_OPERATORS['not-between'],
                ...base,
                // Relative dates (no value)
                ALL_OPERATORS['today'],
                ALL_OPERATORS['yesterday'],
                ALL_OPERATORS['tomorrow'],
                ALL_OPERATORS['this-week'],
                ALL_OPERATORS['last-week'],
                ALL_OPERATORS['next-week'],
                ALL_OPERATORS['this-month'],
                ALL_OPERATORS['last-month'],
                ALL_OPERATORS['next-month'],
                ALL_OPERATORS['this-year'],
                ALL_OPERATORS['last-year'],
                ALL_OPERATORS['next-year'],
                ALL_OPERATORS['last-seven-days'],
                ALL_OPERATORS['next-seven-days'],
                // Relative dates (with X value)
                ALL_OPERATORS['last-x-hours'],
                ALL_OPERATORS['next-x-hours'],
                ALL_OPERATORS['last-x-days'],
                ALL_OPERATORS['next-x-days'],
                ALL_OPERATORS['last-x-weeks'],
                ALL_OPERATORS['next-x-weeks'],
                ALL_OPERATORS['last-x-months'],
                ALL_OPERATORS['next-x-months'],
                ALL_OPERATORS['last-x-years'],
                ALL_OPERATORS['next-x-years'],
                ALL_OPERATORS['older-than-x-minutes'],
                ALL_OPERATORS['older-than-x-hours'],
                ALL_OPERATORS['older-than-x-days'],
                ALL_OPERATORS['older-than-x-weeks'],
                ALL_OPERATORS['older-than-x-months'],
                ALL_OPERATORS['older-than-x-years'],
                // Fiscal periods
                ALL_OPERATORS['this-fiscal-year'],
                ALL_OPERATORS['this-fiscal-period'],
                ALL_OPERATORS['last-fiscal-year'],
                ALL_OPERATORS['last-fiscal-period'],
                ALL_OPERATORS['next-fiscal-year'],
                ALL_OPERATORS['next-fiscal-period'],
                ALL_OPERATORS['last-x-fiscal-years'],
                ALL_OPERATORS['last-x-fiscal-periods'],
                ALL_OPERATORS['next-x-fiscal-years'],
                ALL_OPERATORS['next-x-fiscal-periods'],
                ALL_OPERATORS['in-fiscal-year'],
                ALL_OPERATORS['in-fiscal-period'],
                ALL_OPERATORS['in-fiscal-period-and-year'],
                ALL_OPERATORS['in-or-before-fiscal-period-and-year'],
                ALL_OPERATORS['in-or-after-fiscal-period-and-year'],
            ];

        case 'boolean':
            return base;

        case 'optionset':
            return [
                ...base,
                ALL_OPERATORS['in'],
                ALL_OPERATORS['not-in'],
            ];

        case 'lookup':
            return [
                ...base,
                ALL_OPERATORS['in'],
                ALL_OPERATORS['not-in'],
                // User context operators for owner/lookup fields
                ALL_OPERATORS['eq-userid'],
                ALL_OPERATORS['ne-userid'],
                ALL_OPERATORS['eq-userteams'],
                ALL_OPERATORS['eq-useroruserteams'],
                ALL_OPERATORS['eq-useroruserhierarchy'],
                ALL_OPERATORS['eq-useroruserhierarchyandteams'],
                ALL_OPERATORS['eq-businessid'],
                ALL_OPERATORS['ne-businessid'],
                // Hierarchy operators
                ALL_OPERATORS['above'],
                ALL_OPERATORS['eq-or-above'],
                ALL_OPERATORS['under'],
                ALL_OPERATORS['eq-or-under'],
                ALL_OPERATORS['not-under'],
            ];

        default:
            return base;
    }
};

/**
 * Get operator definition by value
 */
export const getOperatorByValue = (value: string): OperatorDefinition | undefined => {
    return ALL_OPERATORS[value];
};

/**
 * Check if an operator requires a value input
 */
export const operatorRequiresValue = (operator: string): boolean => {
    // Handle legacy aliases
    const legacyAliases: Record<string, string> = {
        'notnull': 'not-null',
        'startswith': 'begins-with',
        'endswith': 'ends-with',
        'notcontains': 'not-contain',
    };
    const normalized = legacyAliases[operator] || operator;
    const def = ALL_OPERATORS[normalized];
    return def?.requiresValue ?? true;
};

/**
 * Check if an operator accepts multiple values
 */
export const operatorIsMultiValue = (operator: string): boolean => {
    const def = ALL_OPERATORS[operator];
    return def?.multipleValues ?? false;
};

/**
 * Check if an operator requires a second value
 */
export const operatorRequiresValue2 = (operator: string): boolean => {
    const def = ALL_OPERATORS[operator];
    return def?.requiresValue2 ?? false;
};

/**
 * Get the expected value type for an operator (for X-days operators, this returns 'number')
 */
export const getOperatorValueType = (operator: string): 'number' | 'date' | 'string' | 'same' => {
    const def = ALL_OPERATORS[operator];
    return def?.valueType ?? 'same';
};

/**
 * FetchXML-only operators the serializer can still approximate in OData.
 * `like` becomes contains/startswith/endswith, `not-in` becomes chained `ne`,
 * and `between` becomes a ge/le pair.
 */
const ODATA_APPROXIMATED_OPERATORS = new Set([
    'like',
    'not-like',
    'not-in',
    'between',
    'not-between',
]);

/**
 * Check whether an operator can be expressed in an OData $filter at all.
 *
 * Relative dates, fiscal periods, user-context and hierarchy operators are evaluated by the
 * FetchXML engine itself and have no OData equivalent - a query using them can only run as FetchXML.
 */
export const isOperatorConvertibleToOData = (operator: string): boolean => {
    const def = ALL_OPERATORS[operator];
    if (!def) return true; // Unknown operators fall through to a plain comparison
    return !def.fetchXmlOnly || ODATA_APPROXIMATED_OPERATORS.has(operator);
};
