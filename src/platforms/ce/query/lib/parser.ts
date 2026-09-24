// Ported from fluentui-extended's QueryBuilder (github.com/garethcheyne/npm-fluentui-extended),
// src/components/QueryBuilder/QueryBuilder.parser.ts. Keep in step with it.
/**
 * QueryBuilder Parser
 * 
 * Parses FetchXML to QueryBuilder state.
 */

import type {
    QueryBuilderCondition,
    QueryBuilderField,
    QueryBuilderGroup,
    QueryBuilderQueryOptions,
    QueryBuilderState,
} from './types';
import { ALL_OPERATORS } from './operators';

/**
 * Read the root <fetch> attributes. Only attributes actually present are returned,
 * so an absent attribute falls through to the serializer default rather than being
 * pinned to whatever the parser guessed.
 */
const parseQueryOptions = (fetchEl: Element | null): QueryBuilderQueryOptions | undefined => {
    if (!fetchEl || fetchEl.tagName.toLowerCase() !== 'fetch') return undefined;

    const options: QueryBuilderQueryOptions = {};

    const distinct = fetchEl.getAttribute('distinct');
    if (distinct !== null) options.distinct = distinct.toLowerCase() === 'true';

    const noLock = fetchEl.getAttribute('no-lock');
    if (noLock !== null) options.noLock = noLock.toLowerCase() === 'true';

    const top = fetchEl.getAttribute('top');
    if (top !== null) {
        const parsed = Number.parseInt(top, 10);
        if (Number.isFinite(parsed) && parsed > 0) options.top = parsed;
    }

    return Object.keys(options).length > 0 ? options : undefined;
};

export interface ParseFetchXmlResult {
    state: QueryBuilderState | null;
    error: string | null;
}

/**
 * Map FetchXML operator to internal operator format
 */
const parseFetchXmlOperator = (op: string): string => {
    // Check if it's a valid ALL_OPERATORS key
    if (ALL_OPERATORS[op]) {
        return op;
    }

    // Legacy mappings
    const legacyMap: Record<string, string> = {
        'not-null': 'not-null',
        'notnull': 'not-null',
        // Like patterns are handled by the parser based on value pattern
        'like': 'like',
        'not-like': 'not-like',
    };

    return legacyMap[op] || op;
};

/**
 * Create a new condition with unique ID
 */
const createParsedCondition = (
    attr: string,
    operator: string,
    value: string | (string | number)[],
    value2?: string | number,
    fieldMatch?: QueryBuilderField,
    valueDisplayName?: string,
    entityAlias?: string
): QueryBuilderCondition => ({
    id: `cond_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
    kind: 'field',
    fieldId: fieldMatch?.id || attr,
    operator: operator as any,
    value,
    value2: value2 ?? '',
    ...(valueDisplayName ? { valueDisplayName } : {}),
    ...(entityAlias ? { entityAlias } : {}),
    ...(!fieldMatch ? { isUnknownField: true } : {}),
});

/**
 * Parse a single condition element from FetchXML
 */
const parseConditionElement = (
    condEl: Element,
    fields: QueryBuilderField[]
): QueryBuilderCondition => {
    const attr = condEl.getAttribute('attribute') || '';
    const rawOp = condEl.getAttribute('operator') || 'eq';
    let value: string | (string | number)[] = condEl.getAttribute('value') || '';
    // Extract lookup display name from uiname attribute (used for resolved lookup values)
    const uiname = condEl.getAttribute('uiname') || undefined;
    // Extract entityname attribute (alias referencing a link-entity)
    const entityAlias = condEl.getAttribute('entityname') || undefined;
    let value2: string | number | undefined;

    // Handle in/not-in operators with multiple <value> child elements
    if (rawOp === 'in' || rawOp === 'not-in' || 
        rawOp === 'contain-values' || rawOp === 'not-contain-values') {
        const valueElements = condEl.querySelectorAll(':scope > value');
        if (valueElements.length > 0) {
            const values: (string | number)[] = [];
            valueElements.forEach((valEl) => {
                const text = valEl.textContent || '';
                const num = Number(text);
                values.push(!isNaN(num) && text.trim() !== '' ? num : text);
            });
            value = values;
        }
    }

    // Handle between/not-between with two <value> elements
    if (rawOp === 'between' || rawOp === 'not-between' ||
        rawOp === 'in-fiscal-period-and-year' ||
        rawOp === 'in-or-before-fiscal-period-and-year' ||
        rawOp === 'in-or-after-fiscal-period-and-year') {
        const valueElements = condEl.querySelectorAll(':scope > value');
        if (valueElements.length >= 2) {
            const v1 = valueElements[0].textContent || '';
            const v2 = valueElements[1].textContent || '';
            const num2 = Number(v2);
            // Keep value as string (for between, first value goes in value, second in value2)
            value = v1;
            value2 = !isNaN(num2) && v2.trim() !== '' ? num2 : v2;
        }
    }

    // Parse the operator
    let operator = parseFetchXmlOperator(rawOp);

    // Handle like patterns - convert to contains/startswith/endswith for UI
    if (rawOp === 'like' && typeof value === 'string') {
        if (value.startsWith('%') && value.endsWith('%')) {
            operator = 'contains';
            value = value.slice(1, -1);
        } else if (value.endsWith('%')) {
            operator = 'begins-with';
            value = value.slice(0, -1);
        } else if (value.startsWith('%')) {
            operator = 'ends-with';
            value = value.slice(1);
        }
        // If no wildcards, keep as 'like' operator
    }

    if (rawOp === 'not-like' && typeof value === 'string') {
        if (value.startsWith('%') && value.endsWith('%')) {
            operator = 'not-contain';
            value = value.slice(1, -1);
        } else if (value.endsWith('%')) {
            operator = 'not-begin-with';
            value = value.slice(0, -1);
        } else if (value.startsWith('%')) {
            operator = 'not-end-with';
            value = value.slice(1);
        }
    }

    const field = fields.find((f) => f.id === attr);
    return createParsedCondition(attr, operator, value, value2, field, uiname, entityAlias);
};

/**
 * Parse FetchXML string to QueryBuilder state
 */
export const parseFetchXmlToState = (xml: string, fields: QueryBuilderField[]): ParseFetchXmlResult => {
    try {
        const trimmed = xml.trim();
        if (!trimmed) {
            return { state: null, error: 'Please enter FetchXML content.' };
        }

        const parser = new DOMParser();
        const doc = parser.parseFromString(trimmed, 'application/xml');
        const parseError = doc.querySelector('parsererror');
        if (parseError) {
            const errorText = parseError.textContent || 'Unknown XML parsing error';
            return { state: null, error: `XML parsing error: ${errorText.slice(0, 200)}` };
        }

        const groups: QueryBuilderGroup[] = [];
        let groupCounter = 0;

        /**
         * Recursively process a filter element.
         * If it has direct conditions, create a group from them.
         * If it has child filters, recurse into them.
         */
        const processFilterElement = (filterEl: Element) => {
            const logic = (filterEl.getAttribute('type') || 'and').toLowerCase() as 'and' | 'or';
            const conditions: QueryBuilderCondition[] = [];

            // Get conditions directly under this filter (not in nested filters)
            filterEl.querySelectorAll(':scope > condition').forEach((condEl) => {
                conditions.push(parseConditionElement(condEl, fields));
            });

            if (conditions.length > 0) {
                groups.push({
                    id: `grp_${Date.now()}_${groupCounter++}`,
                    logic,
                    conditions,
                });
            }

            // Recurse into nested filters (handles the wrapper pattern from serializer)
            const nestedFilters = filterEl.querySelectorAll(':scope > filter');
            nestedFilters.forEach((nestedFilterEl) => {
                processFilterElement(nestedFilterEl);
            });

            // If filter has no conditions AND no nested filters, create a default group
            if (conditions.length === 0 && nestedFilters.length === 0) {
                const defaultFieldId = fields.length > 0 ? fields[0].id : 'name';
                groups.push({
                    id: `grp_${Date.now()}_${groupCounter++}`,
                    logic,
                    conditions: [{
                        id: `cond_${Date.now()}_default`,
                        kind: 'field',
                        fieldId: defaultFieldId,
                        operator: 'eq',
                        value: '',
                    }],
                });
            }
        };

        // Find the entity element
        const entityEl = doc.querySelector('fetch > entity, entity');

        if (entityEl) {
            // Find filter elements DIRECTLY under entity (not inside link-entity)
            const filterElements = entityEl.querySelectorAll(':scope > filter');

            // Also gather any standalone condition elements not inside a filter
            const topLevelConditions: QueryBuilderCondition[] = [];

            filterElements.forEach((filterEl) => {
                processFilterElement(filterEl);
            });

            // If no filter elements, look for conditions directly under entity
            if (filterElements.length === 0) {
                const entityConditions = entityEl.querySelectorAll(':scope > condition');
                entityConditions.forEach((condEl) => {
                    topLevelConditions.push(parseConditionElement(condEl, fields));
                });

                if (topLevelConditions.length > 0) {
                    groups.push({
                        id: `grp_${Date.now()}_0`,
                        logic: 'and',
                        conditions: topLevelConditions,
                    });
                }
            }

            // Parse link-entity elements for related entity conditions (direct children of entity only)
            // Each link-entity becomes its own separate group
            const linkEntities = entityEl.querySelectorAll(':scope > link-entity');
            linkEntities.forEach((linkEl, idx) => {
                const relatedEntityCondition = parseLinkEntity(linkEl, fields);
                if (relatedEntityCondition) {
                    // Create a separate group for each link-entity
                    groups.push({
                        id: `grp_${Date.now()}_link_${idx}`,
                        logic: 'and',
                        conditions: [relatedEntityCondition],
                    });
                }
            });
        } else {
            // No entity element - try to parse bare <filter> fragments
            const filterElements = doc.querySelectorAll('filter');
            filterElements.forEach((filterEl) => {
                processFilterElement(filterEl);
            });
        }

        // If still no groups, inform user no filter conditions were found
        if (groups.length === 0) {
            return {
                state: null,
                error: 'No filter conditions found in the FetchXML. The QueryBuilder imports <filter> and <condition> elements.',
            };
        }

        const queryOptions = parseQueryOptions(doc.documentElement);

        return { state: queryOptions ? { groups, queryOptions } : { groups }, error: null };
    } catch (err) {
        return { state: null, error: `Error parsing FetchXML: ${err instanceof Error ? err.message : 'Unknown error'}` };
    }
};

/**
 * Parse a link-entity element to a related entity condition
 */
const parseLinkEntity = (
    linkEl: Element,
    // Nested conditions resolve their own fields, so the outer list is not consulted
    _fields: QueryBuilderField[]
): QueryBuilderCondition | null => {
    const targetEntityName = linkEl.getAttribute('name') || '';
    const toField = linkEl.getAttribute('to') || '';
    const alias = linkEl.getAttribute('alias') || undefined;

    if (!targetEntityName || !toField) {
        return null;
    }

    // Find nested filter/conditions
    const nestedConditions: QueryBuilderCondition[] = [];
    const filterEl = linkEl.querySelector(':scope > filter');
    
    if (filterEl) {
        filterEl.querySelectorAll(':scope > condition').forEach((condEl) => {
            nestedConditions.push(parseConditionElement(condEl, []));
        });
    }

    return {
        id: `rel_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
        kind: 'relatedEntity',
        fieldId: toField,
        operator: 'containsdata',
        value: '',
        relatedEntityName: toField,
        relatedEntityTarget: targetEntityName,
        relatedEntityAlias: alias,
        nestedConditions,
        nestedLogic: (filterEl?.getAttribute('type') || 'and').toLowerCase() as 'and' | 'or',
        nestedFields: [],
    };
};

/**
 * Validate FetchXML syntax (basic XML validation)
 */
export const validateFetchXmlSyntax = (xml: string): { valid: boolean; error?: string } => {
    try {
        const trimmed = xml.trim();
        if (!trimmed) {
            return { valid: false, error: 'Empty FetchXML' };
        }

        const parser = new DOMParser();
        const doc = parser.parseFromString(trimmed, 'application/xml');
        const parseError = doc.querySelector('parsererror');
        
        if (parseError) {
            return { valid: false, error: parseError.textContent || 'XML parsing error' };
        }

        // Check for required elements
        const fetch = doc.querySelector('fetch');
        if (!fetch) {
            return { valid: false, error: 'Missing <fetch> element' };
        }

        const entity = doc.querySelector('entity');
        if (!entity) {
            return { valid: false, error: 'Missing <entity> element' };
        }

        return { valid: true };
    } catch (err) {
        return { valid: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
};
