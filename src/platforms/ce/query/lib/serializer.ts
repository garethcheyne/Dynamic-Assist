// Ported from fluentui-extended's QueryBuilder (github.com/garethcheyne/npm-fluentui-extended),
// src/components/QueryBuilder/QueryBuilder.serializer.ts. Keep in step with it.
/**
 * QueryBuilder Serializer
 * 
 * Converts QueryBuilder state to FetchXML and OData formats.
 */

import type {
    QueryBuilderCondition,
    QueryBuilderField,
    QueryBuilderODataUnsupported,
    QueryBuilderQueryOptions,
    QueryBuilderState,
    QueryBuilderApplyResult,
} from './types';
import { getOperatorByValue, isOperatorConvertibleToOData } from './operators';

/** Fallback field if none provided */
const FALLBACK_FIELD: QueryBuilderField = { id: 'name', label: 'Name', dataType: 'string' };

/** Root <fetch> defaults, matching what the Dynamics 365 advanced-find editor emits */
const DEFAULT_QUERY_OPTIONS: Required<Omit<QueryBuilderQueryOptions, 'top'>> = {
    distinct: true,
    noLock: false,
};

/**
 * Build the attribute list for the root <fetch> element.
 * Attribute order follows the Dynamics editor's own output so generated XML diffs
 * cleanly against queries copied out of advanced find.
 */
export const buildFetchAttributes = (options?: QueryBuilderQueryOptions): string => {
    const attributes = ['version="1.0"', 'mapping="logical"'];

    // top is dropped rather than clamped when nonsensical - a bad cap would silently
    // truncate results, whereas omitting it returns everything the filter matches
    const top = options?.top;
    if (typeof top === 'number' && Number.isFinite(top) && top > 0) {
        attributes.push(`top="${Math.floor(top)}"`);
    }

    attributes.push(`no-lock="${options?.noLock ?? DEFAULT_QUERY_OPTIONS.noLock}"`);
    attributes.push(`distinct="${options?.distinct ?? DEFAULT_QUERY_OPTIONS.distinct}"`);

    return attributes.join(' ');
};

/**
 * Escape XML special characters
 */
export const escapeXml = (value: string): string =>
    value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');

/**
 * Pretty print XML with indentation
 */
export const prettyPrintXml = (xml: string): string => {
    const INDENT = '  ';
    let formatted = '';
    let indent = 0;
    const tokens = xml.replace(/>\s*</g, '><').split(/(<[^>]+>)/g).filter(Boolean);

    for (const token of tokens) {
        if (token.startsWith('</')) {
            indent--;
            formatted += INDENT.repeat(Math.max(indent, 0)) + token + '\n';
        } else if (token.startsWith('<') && token.endsWith('/>')) {
            formatted += INDENT.repeat(indent) + token + '\n';
        } else if (token.startsWith('<')) {
            formatted += INDENT.repeat(indent) + token + '\n';
            indent++;
        } else {
            formatted += INDENT.repeat(indent) + token + '\n';
        }
    }

    return formatted.trim();
};

/**
 * Map internal operator names to FetchXML operator names.
 *
 * FetchXML has no "contains" operator - substring matching is expressed as `like`/`not-like`
 * with % wildcards around the value. Anything not listed here is already a FetchXML operator.
 * @see https://learn.microsoft.com/power-apps/developer/data-platform/fetchxml/reference/operators
 */
const FETCHXML_OPERATOR_MAP: Record<string, string> = {
    'notnull': 'not-null', // Legacy internal format
    // Substring operators have no FetchXML equivalent - they become wildcard LIKE patterns
    'contains': 'like',
    'not-contain': 'not-like',
    'notcontains': 'not-like', // Legacy alias
    'startswith': 'like', // Legacy alias
    'endswith': 'like', // Legacy alias
};

const getFetchXmlOperator = (operator: string): string => FETCHXML_OPERATOR_MAP[operator] || operator;

/**
 * Operators that carry their wildcards in the value rather than in the operator itself.
 * Maps the operator to how the raw value should be padded with % wildcards.
 */
const WILDCARD_PATTERNS: Record<string, (value: string) => string> = {
    'contains': (value) => `%${value}%`,
    'not-contain': (value) => `%${value}%`,
    'notcontains': (value) => `%${value}%`,
    'startswith': (value) => `${value}%`,
    'endswith': (value) => `%${value}`,
};

/**
 * Convert a single condition to FetchXML
 */
const conditionToFetchXml = (
    condition: QueryBuilderCondition,
    field: QueryBuilderField
): string => {
    // Related entity conditions are handled separately as link-entity
    if (condition.kind === 'relatedEntity') {
        return '';
    }

    const attr = escapeXml(condition.fieldId);
    const operatorDef = getOperatorByValue(condition.operator);
    const fetchXmlOp = getFetchXmlOperator(condition.operator);
    
    // Build entityname attribute if condition references a link-entity alias
    const entityNameAttr = condition.entityAlias ? ` entityname="${escapeXml(condition.entityAlias)}"` : '';

    // Null operators - no value needed
    if (condition.operator === 'null' || condition.operator === 'not-null' || condition.operator === 'notnull') {
        return `<condition${entityNameAttr} attribute="${attr}" operator="${fetchXmlOp}" />`;
    }

    // No-value relative date operators (today, yesterday, this-week, etc.)
    if (operatorDef && !operatorDef.requiresValue) {
        return `<condition${entityNameAttr} attribute="${attr}" operator="${fetchXmlOp}" />`;
    }

    // Between operator - needs two values
    if (condition.operator === 'between') {
        // FetchXML uses <value> elements for between
        return `<condition${entityNameAttr} attribute="${attr}" operator="between"><value>${escapeXml(String(condition.value ?? ''))}</value><value>${escapeXml(String(condition.value2 ?? ''))}</value></condition>`;
    }

    // Not-between operator
    if (condition.operator === 'not-between') {
        return `<condition${entityNameAttr} attribute="${attr}" operator="not-between"><value>${escapeXml(String(condition.value ?? ''))}</value><value>${escapeXml(String(condition.value2 ?? ''))}</value></condition>`;
    }

    // Multi-value operators (in, not-in, contain-values, etc.)
    if (operatorDef?.multipleValues && (condition.operator === 'in' || condition.operator === 'not-in' ||
        condition.operator === 'contain-values' || condition.operator === 'not-contain-values')) {
        const values = Array.isArray(condition.value) ? condition.value : [condition.value];
        const valueElements = values
            .filter(v => v !== undefined && v !== null && String(v) !== '')
            .map(v => `<value>${escapeXml(String(v))}</value>`)
            .join('');
        return `<condition${entityNameAttr} attribute="${attr}" operator="${fetchXmlOp}">${valueElements}</condition>`;
    }

    // Fiscal period and year operators with two values
    if (condition.operator === 'in-fiscal-period-and-year' ||
        condition.operator === 'in-or-before-fiscal-period-and-year' ||
        condition.operator === 'in-or-after-fiscal-period-and-year') {
        return `<condition${entityNameAttr} attribute="${attr}" operator="${fetchXmlOp}"><value>${escapeXml(String(condition.value ?? ''))}</value><value>${escapeXml(String(condition.value2 ?? ''))}</value></condition>`;
    }

    // Standard value-based operators
    let value = condition.value;

    // Boolean conversion
    if (field.dataType === 'boolean') {
        value = value === true || value === 'true' || value === 1 || value === '1' ? '1' : '0';
    }

    // Substring operators are expressed as LIKE patterns with wildcards
    const wildcardPattern = WILDCARD_PATTERNS[condition.operator];
    if (wildcardPattern) {
        value = wildcardPattern(String(value ?? ''));
    }

    // Include uiname/uitype for lookup fields with display name
    if (field.dataType === 'lookup' && condition.valueDisplayName) {
        const uitype = field.targets?.[0]?.entityLogicalName || '';
        const uinameAttr = ` uiname="${escapeXml(condition.valueDisplayName)}"`;
        const uitypeAttr = uitype ? ` uitype="${escapeXml(uitype)}"` : '';
        return `<condition${entityNameAttr} attribute="${attr}" operator="${fetchXmlOp}" value="${escapeXml(String(value ?? ''))}"${uinameAttr}${uitypeAttr} />`;
    }

    return `<condition${entityNameAttr} attribute="${attr}" operator="${fetchXmlOp}" value="${escapeXml(String(value ?? ''))}" />`;
};

/**
 * Generate link-entity XML for related entity conditions
 */
const relatedEntityToLinkEntity = (
    condition: QueryBuilderCondition,
    defaultField: QueryBuilderField
): string => {
    if (condition.kind !== 'relatedEntity' || !condition.relatedEntityTarget) {
        return '';
    }

    const targetEntityName = escapeXml(condition.relatedEntityTarget);
    const lookupField = escapeXml(condition.relatedEntityName || '');
    // Use provided alias or generate one from lookup field name
    const alias = condition.relatedEntityAlias
        ? escapeXml(condition.relatedEntityAlias)
        : `related_${lookupField}`;
    // Prefer the real primary key from metadata - the "<entity>id" convention is wrong for
    // activity entities (email, task, appointment... all use "activityid") among others
    const fromField = condition.relatedEntityPrimaryId
        ? escapeXml(condition.relatedEntityPrimaryId)
        : `${targetEntityName}id`;
    const toField = lookupField;

    // Build nested filter from nestedConditions
    let nestedFilterXml = '';
    if (condition.nestedConditions && condition.nestedConditions.length > 0) {
        const nestedFields = condition.nestedFields || [];
        const nestedConditionsXml = condition.nestedConditions
            .map((nestedCond) => {
                const nestedField = nestedFields.find((f) => f.id === nestedCond.fieldId) || defaultField;
                return conditionToFetchXml(nestedCond, nestedField);
            })
            .filter(Boolean)
            .join('');

        if (nestedConditionsXml) {
            nestedFilterXml = `<filter type="${condition.nestedLogic || 'and'}">${nestedConditionsXml}</filter>`;
        }
    }

    return `<link-entity name="${targetEntityName}" from="${fromField}" to="${toField}" link-type="inner" alias="${alias}">${nestedFilterXml}</link-entity>`;
};

/**
 * Quote a value for OData based on field data type
 */
const quoteODataValue = (val: any, field: QueryBuilderField): string => {
    const isLookup = field.dataType === 'lookup';

    if (field.dataType === 'number') return String(val ?? 0);
    if (field.dataType === 'optionset') return String(parseInt(val, 10) || 0);
    if (field.dataType === 'boolean') return val === true || val === 'true' || val === 1 || val === '1' ? 'true' : 'false';
    if (isLookup) {
        // Lookup GUIDs are not quoted in OData v4
        return String(val ?? '');
    }
    if (field.dataType === 'datetime') {
        const dateVal = String(val ?? '');
        if (dateVal.match(/^\d{4}-\d{2}-\d{2}/)) {
            return dateVal.includes('T') ? dateVal : `${dateVal}T00:00:00Z`;
        }
        const parsed = new Date(dateVal);
        return !isNaN(parsed.getTime()) ? parsed.toISOString() : dateVal;
    }
    return `'${String(val ?? '').replace(/'/g, "''")}'`;
};

/**
 * Convert a single condition to OData filter
 */
const conditionToOData = (condition: QueryBuilderCondition, field: QueryBuilderField): string => {
    // Related entity conditions are handled separately
    if (condition.kind === 'relatedEntity') {
        return '';
    }

    const isLookup = field.dataType === 'lookup';
    const odataFieldName = isLookup ? `_${condition.fieldId}_value` : condition.fieldId;
    const quote = (val: any) => quoteODataValue(val, field);
    // Helper to always quote as string (for string functions like contains/startswith/endswith)
    const quoteAsString = (val: any) => `'${String(val ?? '').replace(/'/g, "''")}'`;
    const operatorDef = getOperatorByValue(condition.operator);

    // FetchXML-only operators cannot be converted to OData
    if (operatorDef?.fetchXmlOnly) {
        // For some operators, we can approximate
        switch (condition.operator) {
            case 'like': {
                // like with wildcards - can use contains/startswith/endswith
                const likeVal = String(condition.value ?? '');
                if (likeVal.startsWith('%') && likeVal.endsWith('%')) {
                    return `contains(${odataFieldName}, '${likeVal.slice(1, -1).replace(/'/g, "''")}')`;
                } else if (likeVal.endsWith('%')) {
                    return `startswith(${odataFieldName}, '${likeVal.slice(0, -1).replace(/'/g, "''")}')`;
                } else if (likeVal.startsWith('%')) {
                    return `endswith(${odataFieldName}, '${likeVal.slice(1).replace(/'/g, "''")}')`;
                }
                return `contains(${odataFieldName}, ${quoteAsString(condition.value)})`;
            }
            case 'not-like': {
                const notLikeVal = String(condition.value ?? '');
                if (notLikeVal.startsWith('%') && notLikeVal.endsWith('%')) {
                    return `not contains(${odataFieldName}, '${notLikeVal.slice(1, -1).replace(/'/g, "''")}')`;
                }
                return `not contains(${odataFieldName}, ${quoteAsString(condition.value)})`;
            }
            case 'not-in': {
                // OData doesn't have "not in", use multiple "ne" conditions with "and"
                const values = Array.isArray(condition.value) ? condition.value : [condition.value];
                const conditions = values.filter(v => v !== undefined && v !== null).map(v => `${odataFieldName} ne ${quote(v)}`);
                return conditions.length > 1 ? `(${conditions.join(' and ')})` : conditions[0] || '';
            }
            case 'between':
            case 'not-between': {
                // between can be expressed as ge/le
                const op1 = condition.operator === 'between' ? 'ge' : 'lt';
                const op2 = condition.operator === 'between' ? 'le' : 'gt';
                const logic = condition.operator === 'between' ? 'and' : 'or';
                return `(${odataFieldName} ${op1} ${quote(condition.value)} ${logic} ${odataFieldName} ${op2} ${quote(condition.value2)})`;
            }
            default:
                // No OData equivalent - omit rather than emit an invalid filter.
                // serializeQueryBuilderState reports these via odataUnsupported.
                return '';
        }
    }

    switch (condition.operator) {
        case 'eq':
            return `${odataFieldName} eq ${quote(condition.value)}`;
        case 'ne':
            return `${odataFieldName} ne ${quote(condition.value)}`;
        case 'gt':
            return `${odataFieldName} gt ${quote(condition.value)}`;
        case 'ge':
            return `${odataFieldName} ge ${quote(condition.value)}`;
        case 'lt':
            return `${odataFieldName} lt ${quote(condition.value)}`;
        case 'le':
            return `${odataFieldName} le ${quote(condition.value)}`;
        case 'null':
        case 'not-null':
            return `${odataFieldName} ${condition.operator === 'null' ? 'eq' : 'ne'} null`;
        case 'notnull': // Legacy format
            return `${odataFieldName} ne null`;
        case 'contains':
            return `contains(${odataFieldName}, ${quoteAsString(condition.value)})`;
        case 'notcontains':
        case 'not-contain':
            return `not contains(${odataFieldName}, ${quoteAsString(condition.value)})`;
        case 'startswith':
        case 'begins-with':
            return `startswith(${odataFieldName}, ${quoteAsString(condition.value)})`;
        case 'not-begin-with':
            return `not startswith(${odataFieldName}, ${quoteAsString(condition.value)})`;
        case 'endswith':
        case 'ends-with':
            return `endswith(${odataFieldName}, ${quoteAsString(condition.value)})`;
        case 'not-end-with':
            return `not endswith(${odataFieldName}, ${quoteAsString(condition.value)})`;
        case 'on':
            return `${odataFieldName} eq ${quote(condition.value)}`;
        case 'on-or-before':
            return `${odataFieldName} le ${quote(condition.value)}`;
        case 'on-or-after':
            return `${odataFieldName} ge ${quote(condition.value)}`;
        case 'not-on':
            return `${odataFieldName} ne ${quote(condition.value)}`;
        case 'in': {
            const inValues = Array.isArray(condition.value) ? condition.value : [condition.value];
            const quotedValues = inValues.filter(v => v !== undefined && v !== null).map(v => quote(v)).join(', ');
            return `${odataFieldName} in (${quotedValues})`;
        }
        default:
            return `${odataFieldName} eq ${quote(condition.value)}`;
    }
};

/**
 * Generate OData filter for related entity conditions
 */
const relatedEntityToOData = (
    condition: QueryBuilderCondition,
    defaultField: QueryBuilderField
): string => {
    if (condition.kind !== 'relatedEntity' || !condition.relatedEntityName) {
        return '';
    }

    const navigationProperty = condition.relatedEntityName;

    if (!condition.nestedConditions || condition.nestedConditions.length === 0) {
        return '';
    }

    const nestedFields = condition.nestedFields || [];
    const nestedLogic = condition.nestedLogic || 'and';

    const nestedFilters = condition.nestedConditions
        .map((nestedCond) => {
            const nestedField = nestedFields.find((f) => f.id === nestedCond.fieldId) || defaultField;
            const isLookup = nestedField.dataType === 'lookup';
            const fieldName = isLookup ? `_${nestedCond.fieldId}_value` : nestedCond.fieldId;
            const odataFieldName = `${navigationProperty}/${fieldName}`;

            // Create a virtual field for quoting purposes
            const virtualField: QueryBuilderField = { ...nestedField, id: fieldName };
            const quote = (val: any) => quoteODataValue(val, virtualField);

            // Operators with no OData equivalent must be omitted, not silently coerced to `eq`
            // by the default branch below - serializeQueryBuilderState reports them instead
            if (!isOperatorConvertibleToOData(nestedCond.operator)) {
                return '';
            }

            switch (nestedCond.operator) {
                case 'eq':
                    return `${odataFieldName} eq ${quote(nestedCond.value)}`;
                case 'ne':
                    return `${odataFieldName} ne ${quote(nestedCond.value)}`;
                case 'gt':
                    return `${odataFieldName} gt ${quote(nestedCond.value)}`;
                case 'ge':
                    return `${odataFieldName} ge ${quote(nestedCond.value)}`;
                case 'lt':
                    return `${odataFieldName} lt ${quote(nestedCond.value)}`;
                case 'le':
                    return `${odataFieldName} le ${quote(nestedCond.value)}`;
                case 'null':
                    return `${odataFieldName} eq null`;
                case 'notnull':
                case 'not-null':
                    return `${odataFieldName} ne null`;
                case 'contains':
                    return `contains(${odataFieldName}, ${quote(nestedCond.value)})`;
                case 'notcontains':
                case 'not-contain':
                    return `not contains(${odataFieldName}, ${quote(nestedCond.value)})`;
                case 'startswith':
                case 'begins-with':
                    return `startswith(${odataFieldName}, ${quote(nestedCond.value)})`;
                case 'endswith':
                case 'ends-with':
                    return `endswith(${odataFieldName}, ${quote(nestedCond.value)})`;
                case 'between':
                    return `(${odataFieldName} ge ${quote(nestedCond.value)} and ${odataFieldName} le ${quote(nestedCond.value2)})`;
                case 'in': {
                    const values = Array.isArray(nestedCond.value) ? nestedCond.value : [nestedCond.value];
                    const quotedValues = values.filter(v => v !== undefined && v !== null).map(v => quote(v)).join(', ');
                    return `${odataFieldName} in (${quotedValues})`;
                }
                case 'not-in': {
                    const values = Array.isArray(nestedCond.value) ? nestedCond.value : [nestedCond.value];
                    const conditions = values.filter(v => v !== undefined && v !== null).map(v => `${odataFieldName} ne ${quote(v)}`);
                    return conditions.length > 1 ? `(${conditions.join(' and ')})` : conditions[0] || '';
                }
                default:
                    return `${odataFieldName} eq ${quote(nestedCond.value)}`;
            }
        })
        .filter(Boolean);

    if (nestedFilters.length === 0) {
        return '';
    }

    return nestedFilters.length > 1
        ? `(${nestedFilters.join(` ${nestedLogic} `)})`
        : nestedFilters[0];
};

/**
 * Serialize QueryBuilder state to FetchXML and OData
 */
export const serializeQueryBuilderState = (
    state: QueryBuilderState,
    fields: QueryBuilderField[],
    entityName: string,
    entitySetName?: string,
): QueryBuilderApplyResult => {
    const defaultField = fields[0] || FALLBACK_FIELD;

    // Record every condition OData can't express, so callers can explain the gap rather than
    // silently handing back a filter that means something different from the FetchXML
    const odataUnsupported: QueryBuilderODataUnsupported[] = [];
    const noteIfUnsupported = (condition: QueryBuilderCondition, availableFields: QueryBuilderField[]) => {
        if (condition.kind === 'relatedEntity' || isOperatorConvertibleToOData(condition.operator)) return;
        const field = availableFields.find((candidate) => candidate.id === condition.fieldId);
        odataUnsupported.push({
            fieldId: condition.fieldId,
            fieldLabel: field?.label || condition.fieldId,
            operator: condition.operator,
            operatorLabel: getOperatorByValue(condition.operator)?.label || condition.operator,
        });
    };

    state.groups.forEach((group) => {
        group.conditions.forEach((condition) => {
            noteIfUnsupported(condition, fields);
            condition.nestedConditions?.forEach((nested) =>
                noteIfUnsupported(nested, condition.nestedFields || [])
            );
        });
    });

    // Collect all link-entity elements from related entity conditions
    const linkEntities: string[] = [];
    state.groups.forEach((group) => {
        group.conditions.forEach((condition) => {
            if (condition.kind === 'relatedEntity') {
                const linkEntity = relatedEntityToLinkEntity(condition, defaultField);
                if (linkEntity) {
                    linkEntities.push(linkEntity);
                }
            }
        });
    });

    const filterParts = state.groups.map((group) => {
        // Filter out related entity conditions (they're handled as link-entity)
        const regularConditions = group.conditions.filter((c) => c.kind !== 'relatedEntity');

        const conditionsXml = regularConditions
            .map((condition) => {
                const field = fields.find((candidate) => candidate.id === condition.fieldId) || defaultField;
                return conditionToFetchXml(condition, field);
            })
            .join('');

        return conditionsXml ? `<filter type="${group.logic}">${conditionsXml}</filter>` : '';
    }).filter(Boolean);

    const fetchXmlFilter =
        filterParts.length > 1 ? `<filter type="and">${filterParts.join('')}</filter>` : filterParts[0] || '';

    // Combine filters and link-entities in the entity element
    const entityContent = fetchXmlFilter + linkEntities.join('');
    const fetchXml = `<fetch ${buildFetchAttributes(state.queryOptions)}><entity name="${escapeXml(entityName)}">${entityContent || '<filter type="and"></filter>'}</entity></fetch>`;

    const odataFilter = state.groups
        .map((group) => {
            const rowFilters = group.conditions
                .map((condition) => {
                    if (condition.kind === 'relatedEntity') {
                        return relatedEntityToOData(condition, defaultField);
                    }
                    const field = fields.find((candidate) => candidate.id === condition.fieldId) || defaultField;
                    return conditionToOData(condition, field);
                })
                .filter(Boolean);

            return rowFilters.length > 1 ? `(${rowFilters.join(` ${group.logic} `)})` : rowFilters[0] || '';
        })
        .filter(Boolean)
        .join(' and ');

    const odataQuery = entitySetName && odataFilter
        ? `${entitySetName}?$filter=${odataFilter}`
        : entitySetName
            ? entitySetName
            : undefined;

    return {
        state: JSON.parse(JSON.stringify(state)) as QueryBuilderState,
        fetchXmlFilter,
        fetchXml,
        odataFilter,
        odataQuery,
        odataUnsupported,
    };
};
