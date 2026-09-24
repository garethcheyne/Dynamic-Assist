# Permission justifications

Chrome Web Store → Privacy → **Permission justification**, and Edge Partner Center → Privacy → **Permission justifications**: one box per permission.
Every `## heading` must match a permission in the manifest; the publish script checks both ways.

## sidePanel

The whole extension is a side panel. Clicking the toolbar icon opens it beside Business Central, a Dynamics 365 app or the Power Apps maker portal, where it shows the current page's details and tools and follows you as you switch tabs.

## storage

Keeps your History (the Business Central environments, Dynamics 365 orgs and Power Apps environments you have opened, with any pins and names you give them) on your computer so you can go back to them. Nothing in storage is sent anywhere, and you can clear it from the History page.

## scripting

Registers the extension's own bundled scripts on Business Central and Dynamics 365 pages. They read the page's own client objects, which a normal content script can't reach, to show the current record's fields, IDs and session, and they run the form tools you click (god mode, logical names, refresh). On the Power Apps maker portal it reads the environment picker's label to show the environment's name. No code is fetched from the network.

## declarativeNetRequest

Used only for impersonation in Dynamics 365, which you start from the panel's Session tab. While it's on, one session rule adds the MSCRMCallerID header to that tab's requests to that one organisation, so the app runs as the user you chose (Dataverse only allows this if you hold the "Act on Behalf of Another User" privilege). The rule is removed when you stop, when the tab closes, or when the browser restarts. Nothing is blocked or redirected.

## host permissions

- `https://*.dynamics.com/*`
- `https://businesscentral.dynamics.com/*`
- `https://make.powerapps.com/*`
- `https://make.preview.powerapps.com/*`

- `businesscentral.dynamics.com`: the Business Central web client, where the panel reads the open page's fields, parts and session.
- `*.dynamics.com`: Dynamics 365 apps live on per-organisation subdomains (for example contoso.crm.dynamics.com, contoso.crm6.dynamics.com), so the organisation's host can't be listed in advance. On those pages the panel reads the form and calls that organisation's own Web API as the signed-in user. Business Central's host is excluded from these scripts.
- `make.powerapps.com` and `make.preview.powerapps.com`: the Power Apps maker portal, where the panel reads the environment from the address and the environment picker to offer its shortcuts.

The extension does nothing on any other site.
