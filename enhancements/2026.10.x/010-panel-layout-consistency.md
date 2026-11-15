# 010: The same layout in the Business Central and Dynamics 365 panels

**Platform:** Business Central, Dynamics 365. **Status:** Built, tested in a real
browser.

## What was asked

Both panels should be as consistent as possible, so people get used to where to look
for a function.

## What was different

The tabs already matched. Inside them, Tools ran Page, Record, Query in Business
Central and Query, Form, Option sets, List view, Debug in Dynamics 365, with Blur data
third on one and last on the other. The summary cards shared one button in the same
place, and the database icon meant the query builder on one and the Web API on the
other. Only Business Central had the query builder and admin center in its top bar.

## The layout now

| Where | Both panels |
| --- | --- |
| Tabs | The main tab, then Tools, Go to, Session. Parts and Errors are each panel's own |
| Tools sections | Query, then Page or Form, then Record. Dynamics 365's other sections follow |
| Query tiles | Query builder, Query this table, Table data |
| Page or Form tiles | Field or Logical names, Blur data, Expand |
| Record tiles | Copy record link, All fields or All columns |
| Summary card buttons | Copy record link, Query this table, the data, Open in a new tab |
| Top bar buttons | Query builder, Admin center, Read the page again |
| Go to | Where to go, then You |
| Session | You first, Environment last with its Admin center tile |

Names stay each product's own (Page and Form, FastTabs and tabs, Fields and Columns):
they're the words people see on the page.

To fill the gaps, Dynamics 365 gained Query this table, Table data, Copy record link
and All columns on the Tools tab, and Business Central gained Copy record link on the
Page tab. The query builders needed no change: their modes and results already match.

## Tests

The browser area `layout` reads both panels in the order they're drawn and checks each
row of the table above, so the two can't drift apart unnoticed.
