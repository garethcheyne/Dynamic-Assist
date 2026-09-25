# Notes for reviewers

Chrome Web Store → Package → **Test instructions**, and Edge Partner Center →
Availability → **Notes for certification**. Reviewers can't test what they can't
reach, and a failed review over access costs days.

---

Dynamic Assist works on Microsoft Dynamics 365 and Power Apps, which need a Microsoft work account. If test account details are needed, they are in the dashboard's test-instructions field; otherwise free trials work:

- Business Central: free trial at https://dynamics.microsoft.com/business-central/overview/ (includes the CRONUS demo company)
- Dynamics 365 apps: free Dynamics 365 Sales trial at https://dynamics.microsoft.com/sales/overview/
- Power Apps: free Developer Plan at https://powerapps.microsoft.com/developerplan/

After installing, open one of the sites below and click the toolbar icon to open the side panel. If a tab was already open, reload it once so the extension can read it.

**Business Central**

1. Open Business Central and go to Customers, then open a customer card.
2. Page tab: the page (21) and table (18) IDs, type, app and fields appear. Hover a field and click {} to copy its schema name, or the copy icon to copy its value.
3. Parts tab: the FactBoxes are listed with their own page and table IDs.
4. Tools tab: click "Field names"; each caption on the page gets its table field name and number. Hover one for its type and the app that added it. Click it again to remove them.
5. Session tab: your user, company and environment, and an Admin center link.

The query builder and "All fields" need the optional, open-source Dynamic Assist Companion app installed in the environment (source in the repository's bc-companion folder). Without it those tools say so and link to its instructions; everything else works.

**Dynamics 365 app (e.g. Sales)**

1. Open an account record.
2. Record tab: the table, record ID, form and fields appear. Expand "All columns" and click "Load columns".
3. Record tab, Access: your privileges on the account table and your rights on this record. Pick another user to see theirs, or Compare two users.
4. Tools tab: click "Logical names"; the form's labels change to logical names with a copy button beside each. Click it again to restore them.
5. Tools tab: click "Query builder"; a query window opens over the page. Pick a few columns and click Run.
6. Go to tab: type "cont" in the table search and pick Contact, then click List.

**Power Apps maker portal**

1. Open https://make.powerapps.com and pick an environment.
2. The panel shows the environment's name and ID, with shortcuts to its solutions, tables and admin center.
3. Open a solution that has cloud flows: the panel lists them, with connection references and environment variables.

**Power Automate**

1. Open https://make.powerautomate.com, pick the same environment and open a solution flow.
2. The panel shows the flow's state, owner and IDs, its recent runs and its definition as JSON.
3. Turning flows on or off is the only thing the extension changes here, and only when you tick flows and click the button.

**Everywhere**

- The grid icon in the header lists this environment's other products, the Microsoft admin centres and recent environments.
- The house icon opens the home page (pinned and recent environments, history); click it again to go back to the page's tools.
- The ⋮ menu → Help opens the help page in a new tab.
- History (clock icon, also on the home page): the environments you opened. Pin one and rename it.
