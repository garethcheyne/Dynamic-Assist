/**
 * Example queries for each builder, on standard tables, to show what a query
 * can do (joins, FlowFields, aggregates, relative dates). Listed with the
 * saved queries unless switched off in the panel's menu.
 */
import type { OmitEach, SavedQuery } from "./saved"
import { useStorage } from "@/lib/use-storage"

/** chrome.storage.local: false hides the examples */
export const SHOW_EXAMPLES_KEY = "showExampleQueries"

export function useShowExamples() {
  return useStorage<boolean>(SHOW_EXAMPLES_KEY, true)
}

export type ExampleQuery = SavedQuery & {
  /** What it shows off, under its name */
  description: string
}

const example = (
  id: string,
  description: string,
  query: OmitEach<SavedQuery, "id" | "savedAt" | "where">
) =>
  ({
    ...query,
    id: `example:${id}`,
    savedAt: 0,
    where: "Example",
    description,
  }) as ExampleQuery

const CE_EXAMPLES: ExampleQuery[] = [
  example(
    "ce-accounts-contacts",
    "Active accounts with their primary contact's email and phone: a linked table",
    {
      platform: "ce",
      name: "Accounts and their primary contacts",
      table: "Account",
      fetchXml: `<fetch top="100">
  <entity name="account">
    <attribute name="name" />
    <attribute name="accountnumber" />
    <attribute name="address1_city" />
    <attribute name="primarycontactid" />
    <order attribute="name" />
    <filter>
      <condition attribute="statecode" operator="eq" value="0" />
    </filter>
    <link-entity name="contact" from="contactid" to="primarycontactid" link-type="outer" alias="contact">
      <attribute name="emailaddress1" />
      <attribute name="telephone1" />
    </link-entity>
  </entity>
</fetch>`,
    }
  ),
  example(
    "ce-new-contacts",
    "Contacts created in the last 30 days, newest first: a relative date filter",
    {
      platform: "ce",
      name: "New contacts this month",
      table: "Contact",
      fetchXml: `<fetch>
  <entity name="contact">
    <attribute name="fullname" />
    <attribute name="emailaddress1" />
    <attribute name="parentcustomerid" />
    <attribute name="createdby" />
    <attribute name="createdon" />
    <order attribute="createdon" descending="true" />
    <filter>
      <condition attribute="createdon" operator="last-x-days" value="30" />
    </filter>
  </entity>
</fetch>`,
    }
  ),
  example(
    "ce-accounts-per-owner",
    "How many accounts each user owns: an aggregate, counted and grouped",
    {
      platform: "ce",
      name: "Accounts per owner",
      table: "Account",
      fetchXml: `<fetch aggregate="true">
  <entity name="account">
    <attribute name="ownerid" alias="owner" groupby="true" />
    <attribute name="accountid" alias="accounts" aggregate="count" />
    <order alias="accounts" descending="true" />
  </entity>
</fetch>`,
    }
  ),
  example(
    "ce-user-roles",
    "Every enabled user with each security role they hold, through the roles' link table",
    {
      platform: "ce",
      name: "Users and their security roles",
      table: "User",
      fetchXml: `<fetch>
  <entity name="systemuser">
    <attribute name="fullname" />
    <attribute name="businessunitid" />
    <order attribute="fullname" />
    <filter>
      <condition attribute="isdisabled" operator="eq" value="0" />
      <condition attribute="accessmode" operator="ne" value="4" />
    </filter>
    <link-entity name="systemuserroles" from="systemuserid" to="systemuserid" intersect="true">
      <link-entity name="role" from="roleid" to="roleid" alias="role">
        <attribute name="name" />
      </link-entity>
    </link-entity>
  </entity>
</fetch>`,
    }
  ),
]

const BC_EXAMPLES: ExampleQuery[] = [
  example(
    "bc-customer-balances",
    "Customers who owe money, largest balance first: a filter and sort on a FlowField",
    {
      platform: "bc",
      name: "Customers with a balance",
      table: "Customer",
      query: {
        table: 18,
        // No., Name, City, Country/Region Code, Balance (LCY)
        fields: [1, 2, 7, 35, 59],
        filters: [{ field: 59, filter: ">0" }],
        sort: [59],
        descending: true,
        top: null,
      },
    }
  ),
  example(
    "bc-low-stock",
    "Items with fewer than 10 in stock: Inventory is calculated per row",
    {
      platform: "bc",
      name: "Items low on stock",
      table: "Item",
      query: {
        table: 27,
        // No., Description, Base Unit of Measure, Inventory, Unit Price
        fields: [1, 3, 8, 68, 18],
        filters: [{ field: 68, filter: "<10" }],
        sort: [68],
        descending: false,
        top: null,
      },
    }
  ),
  example(
    "bc-sales-orders",
    "Sales orders with the customer's city, phone and salesperson: a joined table",
    {
      platform: "bc",
      name: "Sales orders with customer details",
      table: "Sales Header",
      query: {
        table: 36,
        // No., Sell-to Customer No., Sell-to Customer Name, Posting Date,
        // Amount Including VAT
        fields: [3, 2, 79, 20, 61],
        // Document Type
        filters: [{ field: 1, filter: "Order" }],
        sort: [3],
        descending: false,
        top: null,
        joins: [
          {
            id: "customer",
            field: 2,
            table: 18,
            key: 1,
            // City, Phone No., Salesperson Code
            fields: [7, 9, 29],
            filters: [],
            inner: false,
          },
        ],
      },
    }
  ),
  example(
    "bc-latest-gl",
    "The 50 most recent general ledger entries: a descending sort and a row limit",
    {
      platform: "bc",
      name: "Latest G/L entries",
      table: "G/L Entry",
      query: {
        table: 17,
        // Entry No., Posting Date, G/L Account No., Document No.,
        // Description, Amount
        fields: [1, 4, 3, 6, 7, 17],
        filters: [],
        sort: [1],
        descending: true,
        top: 50,
      },
    }
  ),
]

export const EXAMPLE_QUERIES: Record<SavedQuery["platform"], ExampleQuery[]> = {
  ce: CE_EXAMPLES,
  bc: BC_EXAMPLES,
}
