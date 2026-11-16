# Notes for reviewers

Chrome Web Store → Package → **Test instructions**, and Edge Partner Center →
Availability → **Notes for certification**. Reviewers can't test what they can't
reach, and a failed review over access costs days.

---

Dynamic Assist works on Microsoft Dynamics 365 and Power Apps, which need a Microsoft work account. If test account details are needed, they are in the dashboard's test-instructions field; otherwise these free trials work:

- Business Central: https://dynamics.microsoft.com/business-central/overview/ (includes the CRONUS demo company)
- Dynamics 365 Sales: https://dynamics.microsoft.com/sales/overview/
- Power Apps Developer Plan: https://powerapps.microsoft.com/developerplan/

Open one of these sites and click the toolbar icon to open the side panel. If the tab was already open, reload it once. Every tool is described at https://dynamicassist.err403.com/docs/.

**Business Central**

1. Open a customer card. Page tab: the page (21) and table (18) IDs and every field appear; hover a field to copy its name or value.
2. Tools tab: click "Field names"; each caption gets its table field name and number. Click again to remove them.
3. Right-click a field, then Dynamic Assist → Copy field name.

The query builder and "All fields" need the optional, open-source Dynamic Assist Companion app in the environment (https://dynamicassist.err403.com/docs/companion-app/). Without it, the panel says so within seconds, turns those tools off and shows what to install; everything else works.

**Dynamics 365 (e.g. Sales)**

1. Open an account. Record tab: the table, record ID, form and fields appear; Access shows your privileges on the table and record.
2. Tools tab: click "Logical names"; each field gets its logical name. Click "Query builder", pick a few columns and click Run.

**Power Apps and Power Automate**

1. In https://make.powerapps.com, pick an environment: the panel shows its name and ID. Open a solution with cloud flows: it lists them.
2. In https://make.powerautomate.com, open a flow: the panel shows its state, runs and definition. Turning flows on or off is the only change the extension makes here, and only when you tick flows and click the button.

**Everywhere**

The ⋮ menu has Pop out (the panel in its own window), Help (the website's docs) and What's new (the website's changelog). Those links, and Feedback, open the Dynamic Assist website in a new tab; the extension itself sends nothing anywhere.
