# Permission justifications

Chrome Web Store → Privacy → **Permission justification**, and Edge Partner Center → Privacy → **Permission justifications**: one box per permission.
Every `## heading` must match a permission in the manifest; the publish script checks both ways.

## sidePanel

The whole extension is a side panel. Clicking the toolbar icon opens it beside Business Central, a Dynamics 365 app, the Power Apps maker portal or Power Automate, where it shows the current page's details and tools and follows you as you switch tabs.

## storage

Keeps, on your computer only: your History (the Business Central environments, Dynamics 365 orgs and Power Platform environments you have opened, with any pins and names you give them); which Business Central company goes with which Dynamics 365 org, so the panel can link them; a one-day cache of the names of the apps installed in a Business Central environment, to label which extension a field comes from; the queries you save in the query builder; and your light or dark theme, so the query builder window matches the panel. Session storage holds short-lived state (an impersonation in progress, a query waiting to open) and is cleared when the browser closes. Nothing in storage is sent anywhere, and History can be cleared from the History page.

## scripting

Registers the extension's own bundled scripts on Business Central and Dynamics 365 pages. They read the page's own client objects, which a normal content script can't reach, to show the current record's fields, IDs and session; they run the page tools you click (god mode, logical names, field names, blur, expand, refresh); if you switch on the panel's Errors tab, a small script notes Dynamics 365 pages' errors, failed scripts and failed requests, and console errors and warnings if you ask for them (it only observes, and the log stays in the page); and they open the query builder over the page. On the Power Apps maker portal and Power Automate it reads which environment and flow the page is showing. No code is fetched from the network.

## declarativeNetRequest

Used only for impersonation in Dynamics 365, which you start from the panel's Session tab. While it's on, one session rule adds the MSCRMCallerID header to that tab's requests to that one organisation, so the app runs as the user you chose (Dataverse only allows this if you hold the "Act on Behalf of Another User" privilege). The rule is removed when you stop, when the tab closes, or when the browser restarts. Nothing is blocked or redirected.

## host permissions

- `businesscentral.dynamics.com`: the Business Central web client. The panel reads the open page's fields, parts and session; if the optional Dynamic Assist Companion app is installed, the query builder reads from it through the same page.
- `*.dynamics.com`: Dynamics 365 apps and their Dataverse Web API are on per-organisation subdomains (e.g. contoso.crm.dynamics.com), so they can't be listed in advance. The panel reads the form and calls that org's own Web API as the signed-in user.
- `make.powerapps.com`, `make.powerautomate.com` and their preview hosts: the panel reads the environment, solution and flow from the page, and calls that environment's Dataverse org with your existing session to list flows, and to turn them on or off when you ask.

The extension does nothing on any other site.
