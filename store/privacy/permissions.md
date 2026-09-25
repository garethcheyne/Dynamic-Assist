# Permission justifications

Chrome Web Store → Privacy → **Permission justification**, and Edge Partner Center → Privacy → **Permission justifications**: one box per permission.
Every `## heading` must match a permission in the manifest; the publish script checks both ways.

## sidePanel

The whole extension is a side panel. Clicking the toolbar icon opens it beside Business Central, a Dynamics 365 app, the Power Apps maker portal or Power Automate, where it shows the current page's details and tools and follows you as you switch tabs.

## storage

Keeps, on your computer only: your History (the Business Central environments, Dynamics 365 orgs and Power Platform environments you have opened, with any pins and names you give them); which Business Central company goes with which Dynamics 365 org, so the panel can link them; a one-day cache of the names of the apps installed in a Business Central environment, to label which extension a field comes from; the queries you save in the query builder; and your light or dark theme, so the query builder window matches the panel. Session storage holds short-lived state (an impersonation in progress, a query waiting to open) and is cleared when the browser closes. Nothing in storage is sent anywhere, and History can be cleared from the History page.

## scripting

Registers the extension's own bundled scripts on Business Central and Dynamics 365 pages. They read the page's own client objects, which a normal content script can't reach, to show the current record's fields, IDs and session; they run the page tools you click (god mode, logical names, field names, blur, expand, refresh); if you switch on the panel's Errors tab, a small script notes Dynamics 365 pages' errors, failed scripts and failed requests (it only observes, and the log stays in the page); and they open the query builder over the page. On the Power Apps maker portal and Power Automate it reads which environment and flow the page is showing. No code is fetched from the network.

## declarativeNetRequest

Used only for impersonation in Dynamics 365, which you start from the panel's Session tab. While it's on, one session rule adds the MSCRMCallerID header to that tab's requests to that one organisation, so the app runs as the user you chose (Dataverse only allows this if you hold the "Act on Behalf of Another User" privilege). The rule is removed when you stop, when the tab closes, or when the browser restarts. Nothing is blocked or redirected.

## host permissions

- `https://businesscentral.dynamics.com/*`
- `https://*.dynamics.com/*`
- `https://make.powerapps.com/*`
- `https://make.preview.powerapps.com/*`
- `https://make.powerautomate.com/*`
- `https://make.preview.powerautomate.com/*`

- `businesscentral.dynamics.com`: the Business Central web client, where the panel reads the open page's fields, parts and session. If the optional Dynamic Assist Companion app is installed in the environment, the query builder reads from it through the same page.
- `*.dynamics.com`: Dynamics 365 apps and their Dataverse Web API live on per-organisation subdomains (for example contoso.crm.dynamics.com, contoso.crm6.dynamics.com), so the host can't be listed in advance. On those pages the panel reads the form and calls that organisation's own Web API as the signed-in user. From the maker portal and Power Automate, the panel calls the environment's Dataverse org the same way, with the session you already have, to list solution flows and turn them on or off when you ask. Business Central's host is excluded from these scripts.
- `make.powerapps.com` and `make.preview.powerapps.com`: the Power Apps maker portal, where the panel reads the environment and solution from the page to offer its shortcuts and list the solution's flows.
- `make.powerautomate.com` and `make.preview.powerautomate.com`: Power Automate, where the panel reads the environment and flow from the page to show the flow's details and runs.

The extension does nothing on any other site.
