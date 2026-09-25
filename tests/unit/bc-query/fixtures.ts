/** Small stand-ins for what the companion returns about Customer (table 18). */
import type { BcApi } from "@/platforms/bc/query/api"
import type { BcField, BcQuery, BcTable } from "@/platforms/bc/query/bridge"

export const field = (
  no: number,
  name: string,
  type: string,
  cls = "Normal",
  extra: Partial<BcField> = {}
): BcField => ({
  no,
  name,
  caption: name,
  type,
  class: cls,
  length: 0,
  enabled: true,
  obsolete: false,
  pk: false,
  ...extra,
})

export const customer: BcTable = {
  id: 18,
  name: "Customer",
  caption: "Customer",
  perCompany: true,
  obsolete: false,
}

export const F = {
  no: field(1, "No.", "Code", "Normal", { pk: true }),
  name: field(2, "Name", "Text"),
  city: field(7, "City", "Text"),
  blocked: field(39, "Blocked", "Option", "Normal", {
    options: ["Ship", "Invoice", "All"],
  }),
  lastModified: field(54, "Last Date Modified", "Date"),
  dateFilter: field(55, "Date Filter", "Date", "FlowFilter"),
  balance: field(59, "Balance (LCY)", "Decimal", "FlowField"),
  sales: field(61, "Sales (LCY)", "Decimal", "FlowField"),
  privacy: field(80, "Privacy Blocked", "Boolean"),
  image: field(89, "Image", "MediaSet"),
  systemId: field(2000000000, "$systemId", "GUID"),
  createdAt: field(2000000001, "SystemCreatedAt", "DateTime"),
}
export const fields = Object.values(F)

export const query = (q: Partial<BcQuery> = {}): BcQuery => ({
  table: 18,
  fields: [1, 2],
  filters: [],
  sort: [],
  descending: false,
  top: 100,
  ...q,
})

export const ctx = { tenant: "t-1", environment: "Sandbox", companyId: "c-1" }

/** Microsoft's customers API (v2.0 and v1.0 versions of one page) */
export const customersApi: BcApi = {
  page: 30009,
  name: "APIV2 - Customers",
  publisher: "microsoft",
  group: "api",
  version: "v1.0,v2.0",
  entityName: "customer",
  entitySetName: "customers",
  view: "",
  fields: [
    { no: 1, name: "number" },
    { no: 2, name: "displayName" },
    { no: 7, name: "city" },
    { no: 39, name: "blocked" },
    { no: 59, name: "balance" },
    { no: 2000000000, name: "id" },
  ],
}

/** An ISV API with a filtered view */
export const isvApi: BcApi = {
  page: 70000,
  name: "Contoso Blocked Customers",
  publisher: "contoso",
  group: "crm",
  version: "beta",
  entityName: "blockedCustomer",
  entitySetName: "blockedCustomers",
  view: "WHERE(Blocked=FILTER(<>' '))",
  fields: [
    { no: 1, name: "no" },
    { no: 2, name: "name" },
    { no: 80, name: "privacyBlocked" },
  ],
}

/** Customer's lookups, and the tables they point to (real Base App names) */
export const salespersonCode = field(29, "Salesperson Code", "Code", "Normal", {
  relationTable: 13,
  relationField: 1,
})
export const paymentTermsCode = field(
  27,
  "Payment Terms Code",
  "Code",
  "Normal",
  {
    relationTable: 3,
  }
)
export const joinFields = [...fields, salespersonCode, paymentTermsCode]

export const related = {
  13: {
    name: "Salesperson/Purchaser",
    caption: "Salesperson/Purchaser",
    fields: [
      field(1, "Code", "Code", "Normal", { pk: true }),
      field(2, "Name", "Text"),
      field(3, "Commission %", "Decimal"),
      field(5102, "E-Mail", "Text"),
    ],
  },
  3: {
    name: "Payment Terms",
    caption: "Payment Terms",
    fields: [
      field(1, "Code", "Code", "Normal", { pk: true }),
      field(2, "Due Date Calculation", "DateFormula"),
      field(8, "Description", "Text"),
    ],
  },
}

export const salespersonJoin = (
  j: Partial<import("@/platforms/bc/query/bridge").BcJoin> = {}
): import("@/platforms/bc/query/bridge").BcJoin => ({
  id: "j1",
  field: 29,
  table: 13,
  key: 1,
  fields: [2],
  filters: [],
  inner: false,
  ...j,
})

export const paymentTermsJoin = (
  j: Partial<import("@/platforms/bc/query/bridge").BcJoin> = {}
): import("@/platforms/bc/query/bridge").BcJoin => ({
  id: "j2",
  field: 27,
  table: 3,
  key: 1,
  fields: [8],
  filters: [],
  inner: false,
  ...j,
})
