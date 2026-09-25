# Privacy policy

Both stores want a **URL**, not text: publish this page somewhere public and put
its address in store.json → listing.privacyPolicyUrl. Required whenever the
extension handles any user data (data-usage.md has a box ticked).

---

# Dynamic Assist privacy policy

_Last updated 25 September 2026_

Dynamic Assist is a browser extension that shows administrator and developer tools for Microsoft Dynamics 365 Business Central, Dynamics 365 apps, the Power Apps maker portal and Power Automate in a side panel.

## What it reads

On businesscentral.dynamics.com, Dynamics 365 app sites (\*.dynamics.com), make.powerapps.com and make.powerautomate.com, Dynamic Assist reads the page you have open: the record, its fields and values, page and table IDs, the signed-in user, company and environment. It shows these in the side panel. It does nothing on other sites.

In Power Apps and Power Automate it finds the environment's Dataverse organisation from the addresses the portal itself has called. It reads only the addresses, never request headers or sign-in tokens. It then reads that organisation's flows, flow runs, connection references and environment variables through its Web API, using your existing sign-in. It changes a flow only when you turn it on or off, and it does so as you, with your permissions.

On Dynamics 365 app pages it also calls that organisation's own Web API, as you and with your existing sign-in, to read table metadata, the current record's columns, the current view's query, security roles and privileges, and the environment's details. When you check access for another user of that organisation, it reads their name, security roles and privileges the same way, and only if your own permissions allow it. When you run a query in the query builder it reads the rows you asked for the same way. If you switch on the panel's Errors tab (it's off by default), it also notes the page's own errors, failed scripts and failed requests (and its console errors and warnings, if you switch those on too) to show them there; that log stays in the page and is gone when you reload it.

In Business Central, if you have installed the optional Dynamic Assist Companion app, the query builder asks that app (inside the Business Central page, through your own session) for table and field lists, for the rows you query, for the record's full field list and for the names of the apps installed in the environment. The app is read-only and applies your Business Central permissions.

Query results are shown on the page. They are saved as a file only when you choose Export, and then only to your own computer.

## What it stores

- **History**: the addresses and names of the Business Central environments, Dynamics 365 organisations and Power Apps environments you open, when you last opened them, and any pins or names you add. Stored in your browser's extension storage.
- **Linked environments**: which Business Central company goes with which Dynamics 365 organisation, so the panel can link them. Stored in your browser's extension storage.
- **App names**: the names, publishers and versions of the apps installed in a Business Central environment, kept for a day so field details can say which extension added a field. Stored in your browser's extension storage.
- **Saved queries**: the queries you save in the query builder, with their names, table and where you saved them. Stored in your browser's extension storage; Export writes them to a file only when you ask.
- **Preferences**: light or dark mode, which panel sections are collapsed, how the query builder shows filters and whether it lists example queries. Stored in your browser.

Nothing else is stored. The extension never reads or stores passwords or sign-in tokens. Record data shown in the panel is not kept.

## What it shares

Nothing. Dynamic Assist has no server of its own and sends no data to the developer or to any third party. It has no analytics, advertising or tracking. The only network requests it makes go to the Microsoft service you're already signed in to: the Dynamics 365 or Dataverse organisation, or Business Central through its own page.

## How long data is kept, and how to delete it

History stays until you remove entries or choose Clear on the History page (pinned entries are kept until you unpin them). Uninstalling the extension deletes everything it stored.

## Contact

Questions about this policy: open an issue at https://github.com/garethcheyne/Dynamic-Assist/issues.

Dynamic Assist is an independent project, not affiliated with or endorsed by Microsoft.
