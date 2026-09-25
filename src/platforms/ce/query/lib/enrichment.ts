// Ported from fluentui-extended's QueryBuilder (github.com/garethcheyne/npm-fluentui-extended),
// src/components/QueryBuilder/QueryBuilder.enrichment.ts. Keep in step with it.
/**
 * QueryBuilder Field Enrichment Functions
 * 
 * Reusable functions for enriching fields with lookup targets and optionset options.
 * These functions work for both main entity fields and related entity fields.
 */

import type { QueryBuilderField } from './types';
import { buildFieldOptions } from './utils';

const ODATA_HEADERS = {
    'OData-MaxVersion': '4.0',
    'OData-Version': '4.0',
    'Accept': 'application/json',
};

/**
 * Attribute type casts that carry selectable values, and the option properties each one exposes.
 *
 * Option metadata can't be expanded from the base Attributes collection, so every cast has to be
 * queried separately. Picklists expose an Options list; booleans expose TrueOption/FalseOption.
 */
const OPTIONSET_CASTS: { castType: string; optionSelect: string }[] = [
    { castType: 'PicklistAttributeMetadata', optionSelect: 'Options' },
    { castType: 'StateAttributeMetadata', optionSelect: 'Options' },
    { castType: 'StatusAttributeMetadata', optionSelect: 'Options' },
    { castType: 'BooleanAttributeMetadata', optionSelect: 'TrueOption,FalseOption' },
];

/**
 * Fetch option metadata for every optionset and boolean attribute on an entity.
 *
 * One request per attribute cast rather than one per field, so an entity with dozens of
 * choice fields still costs a handful of calls.
 *
 * @returns Map of attribute logical name to its raw option set metadata
 */
const fetchOptionSetMetadata = async (
    entityName: string,
    trace?: (message: string, data?: any) => void
): Promise<Map<string, any>> => {
    const results = await Promise.all(
        OPTIONSET_CASTS.map(async ({ castType, optionSelect }) => {
            const baseUrl = `/api/data/v9.2/EntityDefinitions(LogicalName='${entityName}')/Attributes/Microsoft.Dynamics.CRM.${castType}?$select=LogicalName`;
            const localSet = `OptionSet($select=${optionSelect})`;
            const globalSet = `GlobalOptionSet($select=${optionSelect})`;

            // An attribute bound to a global option set returns nothing under OptionSet, so ask for
            // both; retry with the local set alone if a cast rejects the combined expand.
            for (const expandClause of [`${localSet},${globalSet}`, localSet]) {
                try {
                    const response = await fetch(`${baseUrl}&$expand=${expandClause}`, { headers: ODATA_HEADERS });
                    if (!response.ok) continue;

                    const data = await response.json();
                    return (data.value || []).map((attr: any) => [
                        attr.LogicalName,
                        { OptionSet: attr.OptionSet, GlobalOptionSet: attr.GlobalOptionSet },
                    ] as [string, any]);
                } catch {
                    // Fall through to the narrower expand
                }
            }

            trace?.('[QueryBuilder] Failed to fetch option metadata', { entityName, castType });
            return [] as [string, any][];
        })
    );

    const optionSetMap = new Map<string, any>();
    for (const entries of results) {
        for (const [logicalName, optionSet] of entries) {
            optionSetMap.set(logicalName, optionSet);
        }
    }

    trace?.('[QueryBuilder] Fetched option metadata', { entityName, attributeCount: optionSetMap.size });
    return optionSetMap;
};

/**
 * Enrich optionset and boolean fields with their selectable values.
 * Web API limitation requires fetching option metadata separately with type casting.
 *
 * @param fields - Array of fields that may contain optionset or boolean fields
 * @param entityName - The entity that owns these fields
 * @param trace - Optional trace callback for debugging
 * @returns Fields with enriched options
 */
export const enrichOptionsetFields = async (
    fields: (QueryBuilderField & { _raw?: any })[],
    entityName: string,
    trace?: (message: string, data?: any) => void
): Promise<(QueryBuilderField & { _raw?: any })[]> => {
    const optionFields = fields.filter((f) => f.dataType === 'optionset' || f.dataType === 'boolean');

    trace?.('[QueryBuilder] Enriching option metadata', { entityName, fieldCount: optionFields.length });

    if (optionFields.length === 0) {
        return fields;
    }

    try {
        const optionSetMap = await fetchOptionSetMetadata(entityName, trace);

        for (const field of optionFields) {
            const options = buildFieldOptions(optionSetMap.get(field.id), field.dataType);
            if (options) {
                field.options = options;
            }
        }

        trace?.('[QueryBuilder] Enriched option metadata', {
            enriched: optionFields.filter((f) => !!f.options).length,
            missing: optionFields.filter((f) => !f.options).map((f) => f.id),
        });
    } catch (optError) {
        trace?.('[QueryBuilder] Failed to enrich option metadata', {
            entityName,
            error: optError instanceof Error ? optError.message : String(optError),
        });
    }

    return fields;
};
