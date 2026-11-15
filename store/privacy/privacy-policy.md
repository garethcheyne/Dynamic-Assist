# Privacy policy

Both stores want a **URL**, not text. store.json → listing.privacyPolicyUrl
points at https://www.err403.com/privacy-policy/chrome-extensions, the policy
for every err403 extension. The text below is the Dynamic Assist detail; the
website's privacy page (https://dynamicassist.err403.com/privacy/) carries the
same. What the website itself keeps (visit counts and feedback) is on its own
page, https://dynamicassist.err403.com/privacy/website/. Keep the three in step.

---

# Dynamic Assist privacy policy

_Last updated 15 November 2026_

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
- **Table lists**: each Business Central environment's list of tables, and the fields of the tables you open in the query builder, so it opens quickly. Stored in your browser's extension storage; Settings clears them.
- **Missing companion**: when Business Central says an environment doesn't have the Dynamic Assist Companion app, a note of that, so the tools that need it are off there. Forgotten after a day, or when you choose Check again.
- **Saved queries**: the queries you save in the query builder, with their names, table and where you saved them. Stored in your browser's extension storage; Export writes them to a file only when you ask.
- **Preferences**: light or dark mode, which panel sections are collapsed, how the query builder shows filters and whether it lists example queries. Stored in your browser.

Nothing else is stored. The extension never reads or stores passwords or sign-in tokens. Record data shown in the panel is not kept.

## What it shares

Nothing. Dynamic Assist has no server of its own and sends no data to the developer or to any third party. It has no analytics, advertising or tracking. Its network requests go to the Microsoft service you're already signed in to: the Dynamics 365 or Dataverse organisation, or Business Central through its own page. The one exception is the What's new page: when you open it, it reads the public changelog from GitHub (raw.githubusercontent.com), a plain download that sends nothing about you or your data.

## How long data is kept, and how to delete it

History stays until you remove entries or choose Clear on the History page (pinned entries are kept until you unpin them). Uninstalling the extension deletes everything it stored.

## The website

The extension never sends anything to its website by itself. Its links to https://dynamicassist.err403.com (the docs, the feedback page and the companion app download) open in a new tab only when you click them. Feedback and Report a problem put the extension's version, and after a crash the error message, in the link, to fill in the feedback form; the form shows them, and nothing is sent unless you send the form. The website counts visits and keeps the feedback you choose to send; its own privacy policy (https://dynamicassist.err403.com/privacy/website/) says what and for how long.

## Contact

Questions about this policy: the feedback page at https://dynamicassist.err403.com/feedback/, or an issue at https://github.com/garethcheyne/Dynamic-Assist/issues.

Dynamic Assist is an independent project, not affiliated with or endorsed by Microsoft.
