import type { QueryBuilderField } from "@/platforms/ce/query/lib/types"
import type { Relationship, TableInfo } from "@/platforms/ce/query/metadata"
import { staticMeta } from "@/platforms/ce/query/editor/meta"

const table = (
  logicalName: string,
  displayName: string,
  set: string
): TableInfo => ({
  logicalName,
  displayName,
  entitySetName: set,
  primaryIdAttribute: `${logicalName}id`,
  primaryNameAttribute: logicalName === "contact" ? "fullname" : "name",
})

export const TABLES = [
  table("account", "Account", "accounts"),
  table("contact", "Contact", "contacts"),
  table("systemuser", "User", "systemusers"),
]

const f = (
  id: string,
  label: string,
  dataType: QueryBuilderField["dataType"],
  extra: Partial<QueryBuilderField> = {}
): QueryBuilderField => ({
  id,
  label,
  dataType,
  attributeType: extra.attributeType ?? dataType,
  ...extra,
})

const STATUS = [
  { label: "Active", value: 0 },
  { label: "Inactive", value: 1 },
]

export const FIELDS: Record<string, QueryBuilderField[]> = {
  account: [
    f("accountid", "Account", "lookup", { attributeType: "uniqueidentifier" }),
    f("name", "Account Name", "string"),
    f("statecode", "Status", "optionset", {
      attributeType: "state",
      options: STATUS,
    }),
    f("revenue", "Annual Revenue", "number", { attributeType: "money" }),
    f("createdon", "Created On", "datetime"),
    f("ownerid", "Owner", "lookup", {
      attributeType: "owner",
      targets: [{ entityLogicalName: "systemuser" }],
    }),
    f("parentaccountid", "Parent Account", "lookup", {
      attributeType: "lookup",
      targets: [{ entityLogicalName: "account" }],
    }),
    f("donotemail", "Do not allow Emails", "boolean", {
      options: [
        { label: "Do Not Allow", value: "1" },
        { label: "Allow", value: "0" },
      ],
    }),
  ],
  contact: [
    f("contactid", "Contact", "lookup", { attributeType: "uniqueidentifier" }),
    f("fullname", "Full Name", "string"),
    f("parentcustomerid", "Company Name", "lookup", {
      attributeType: "customer",
      targets: [
        { entityLogicalName: "account" },
        { entityLogicalName: "contact" },
      ],
    }),
    f("statecode", "Status", "optionset", {
      attributeType: "state",
      options: STATUS,
    }),
  ],
  systemuser: [
    f("systemuserid", "User", "lookup", { attributeType: "uniqueidentifier" }),
    f("fullname", "Full Name", "string"),
  ],
}

export const RELATIONSHIPS: Record<string, Relationship[]> = {
  account: [
    {
      schemaName: "contact_customer_accounts",
      kind: "one-to-many",
      table: "contact",
      from: "parentcustomerid",
      to: "accountid",
    },
    {
      schemaName: "user_accounts",
      kind: "many-to-one",
      table: "systemuser",
      from: "systemuserid",
      to: "ownerid",
    },
  ],
  contact: [
    {
      schemaName: "contact_customer_accounts",
      kind: "many-to-one",
      table: "account",
      from: "accountid",
      to: "parentcustomerid",
    },
  ],
}

export const META = staticMeta(TABLES, FIELDS, RELATIONSHIPS)
