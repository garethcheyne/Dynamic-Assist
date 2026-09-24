// Ported from fluentui-extended's QueryBuilder (github.com/garethcheyne/npm-fluentui-extended),
// src/components/QueryBuilder/QueryBuilder.types.ts. Keep in step with it.

export type QueryBuilderDataType = 'string' | 'number' | 'datetime' | 'boolean' | 'optionset' | 'lookup';

export interface QueryBuilderOption {
  label: string;
  value: string | number;
}

/** Target entity for lookup fields */
export interface QueryBuilderLookupTarget {
  /** Logical name of the target entity (e.g., "contact") */
  entityLogicalName: string;
  /** Entity set name for OData queries (e.g., "contacts") */
  entitySetName?: string;
  /** Display name of the entity (e.g., "Contact") */
  displayName?: string;
  /** Primary name attribute for searching (e.g., "fullname") */
  primaryNameAttribute?: string;
  /** Primary key attribute (e.g., "contactid", or "activityid" for activity entities) */
  primaryIdAttribute?: string;
}

export interface QueryBuilderField {
  id: string;
  label: string;
  dataType: QueryBuilderDataType;
  /** Original normalized Dynamics attribute type (e.g. money, decimal, integer). */
  attributeType?: string;
  options?: QueryBuilderOption[];
  /** Schema name (PascalCase attribute name, e.g., "CreatedOn") */
  schemaName?: string;
  /** Target entities for lookup fields (which entities can be referenced) */
  targets?: QueryBuilderLookupTarget[];
}

/**
 * FetchXML condition operators.
 * 
 * Common operators are explicitly listed for IDE autocomplete.
 * Additional FetchXML operators are supported via the string type.
 * 
 * @see QueryBuilder.operators.ts for full list of operators
 */
export type QueryBuilderOperator =
  // Comparison operators
  | 'eq'
  | 'ne'
  | 'gt'
  | 'ge'
  | 'lt'
  | 'le'
  // Null operators
  | 'null'
  | 'not-null'
  | 'notnull' // Legacy alias
  // String operators
  | 'contains'
  | 'not-contain'
  | 'begins-with'
  | 'not-begin-with'
  | 'ends-with'
  | 'not-end-with'
  | 'like'
  | 'not-like'
  // Legacy aliases (for backward compatibility)
  | 'notcontains'
  | 'startswith'
  | 'endswith'
  | 'containsdata'
  // Multi-value operators
  | 'in'
  | 'not-in'
  | 'between'
  | 'not-between'
  | 'contain-values'
  | 'not-contain-values'
  // Date comparison operators
  | 'on'
  | 'on-or-before'
  | 'on-or-after'
  | 'not-on'
  // Relative date operators (no value)
  | 'today'
  | 'yesterday'
  | 'tomorrow'
  | 'this-week'
  | 'last-week'
  | 'next-week'
  | 'this-month'
  | 'last-month'
  | 'next-month'
  | 'this-year'
  | 'last-year'
  | 'next-year'
  | 'last-seven-days'
  | 'next-seven-days'
  // Relative date operators (with X value)
  | 'last-x-hours'
  | 'next-x-hours'
  | 'last-x-days'
  | 'next-x-days'
  | 'last-x-weeks'
  | 'next-x-weeks'
  | 'last-x-months'
  | 'next-x-months'
  | 'last-x-years'
  | 'next-x-years'
  | 'olderthan-x-minutes'
  | 'olderthan-x-hours'
  | 'olderthan-x-days'
  | 'olderthan-x-weeks'
  | 'olderthan-x-months'
  | 'olderthan-x-years'
  // Fiscal period operators
  | 'this-fiscal-year'
  | 'this-fiscal-period'
  | 'last-fiscal-year'
  | 'last-fiscal-period'
  | 'next-fiscal-year'
  | 'next-fiscal-period'
  | 'last-x-fiscal-years'
  | 'last-x-fiscal-periods'
  | 'next-x-fiscal-years'
  | 'next-x-fiscal-periods'
  | 'in-fiscal-year'
  | 'in-fiscal-period'
  | 'in-fiscal-period-and-year'
  | 'in-or-before-fiscal-period-and-year'
  | 'in-or-after-fiscal-period-and-year'
  // User context operators
  | 'eq-userid'
  | 'ne-userid'
  | 'eq-userteams'
  | 'eq-useroruserteams'
  | 'eq-useroruserhierarchy'
  | 'eq-useroruserhierarchyandteams'
  | 'eq-businessid'
  | 'ne-businessid'
  | 'eq-userlanguage'
  // Hierarchy operators
  | 'above'
  | 'eq-or-above'
  | 'under'
  | 'eq-or-under'
  | 'not-under'
  // Allow any string for future operators
  | (string & {});

export interface QueryBuilderCondition {
  id: string;
  kind?: 'field' | 'relatedEntity';
  fieldId: string;
  operator: QueryBuilderOperator;
  /** Single value or array of values (for in/not-in operators) */
  value?: string | number | boolean | (string | number)[];
  value2?: string | number | boolean;
  /** Display name for lookup values (the GUID is stored in value) */
  valueDisplayName?: string;
  /** Entity alias when condition references a link-entity (e.g., entityname="S" in FetchXML) */
  entityAlias?: string;
  /** The lookup field ID that creates this relationship (e.g., "ownerid") - used as "to" in link-entity */
  relatedEntityName?: string;
  /** The target entity logical name (e.g., "systemuser") - used as "name" in link-entity */
  relatedEntityTarget?: string;
  /**
   * Primary key attribute of the target entity - used as "from" in link-entity.
   * Falls back to "<entity>id" when absent, which is wrong for activity entities.
   */
  relatedEntityPrimaryId?: string;
  /** Alias for the link-entity (e.g., "S" in alias="S") */
  relatedEntityAlias?: string;
  /** Nested conditions for related entity (link-entity filter) */
  nestedConditions?: QueryBuilderCondition[];
  /** Logic operator for nested conditions */
  nestedLogic?: 'and' | 'or';
  /** Fields available for the related entity (loaded dynamically) */
  nestedFields?: QueryBuilderField[];
  /** True when the attribute from parsed FetchXML didn't match any known field */
  isUnknownField?: boolean;
}

export interface QueryBuilderGroup {
  id: string;
  logic: 'and' | 'or';
  conditions: QueryBuilderCondition[];
}

/**
 * Attributes emitted on the root <fetch> element. These mirror what the Dynamics 365
 * advanced-find editor produces, so a query imported from Dynamics keeps its options
 * instead of silently losing them on the next serialize.
 */
export interface QueryBuilderQueryOptions {
  /**
   * Emit distinct="true". Matters once link-entities are involved, where a single
   * record can otherwise match on several related rows. Defaults to true.
   */
  distinct?: boolean;
  /** Emit no-lock="true" to read without taking shared locks. Defaults to false. */
  noLock?: boolean;
  /** Emit top="N" to cap the row count. Omitted entirely when not set. */
  top?: number;
}

export interface QueryBuilderState {
  groups: QueryBuilderGroup[];
  /** Root <fetch> attributes. Omitted means "use the defaults". */
  queryOptions?: QueryBuilderQueryOptions;
}

/** A condition that has no OData equivalent and was omitted from the OData filter */
export interface QueryBuilderODataUnsupported {
  /** Logical name of the field the condition applies to */
  fieldId: string;
  /** Display label of the field */
  fieldLabel: string;
  /** The operator that cannot be translated (e.g., "last-x-days") */
  operator: string;
  /** Display label of the operator (e.g., "Last X Days") */
  operatorLabel: string;
}

export interface QueryBuilderApplyResult {
  state: QueryBuilderState;
  fetchXmlFilter: string;
  fetchXml: string;
  odataFilter: string;
  /** Full OData query URL (e.g., "accounts?$filter=...") - requires entitySetName */
  odataQuery?: string;
  /**
   * Conditions dropped from odataFilter because OData has no equivalent
   * (relative dates, fiscal periods, user context, hierarchy operators).
   * When non-empty the OData output is NOT equivalent to the FetchXML - use FetchXML instead.
   */
  odataUnsupported: QueryBuilderODataUnsupported[];
}

export interface QueryBuilderRelatedEntity {
  /** Unique identifier - typically the lookup field name (e.g., "primarycontactid") */
  id: string;
  /** Display label for the relationship (e.g., "Primary Contact (Contact)") */
  label: string;
  /** The lookup field that creates this relationship */
  lookupField?: string;
  /** The target entity logical name (e.g., "contact") */
  targetEntity?: string;
  /** The target entity set name for OData (e.g., "contacts") */
  targetEntitySetName?: string;
  /** The target entity's primary key attribute - used as "from" in the generated link-entity */
  targetPrimaryIdAttribute?: string;
}

export interface QueryBuilderLookupOption {
  /** Unique identifier (typically a GUID) */
  key: string;
  /** Display text */
  text: string;
  /** Optional secondary text */
  secondaryText?: string;
}
