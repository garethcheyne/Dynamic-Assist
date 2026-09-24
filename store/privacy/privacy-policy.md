# Privacy policy

Both stores want a **URL**, not text: publish this page somewhere public and put
its address in store.json → listing.privacyPolicyUrl. Required whenever the
extension handles any user data (data-usage.md has a box ticked).

---

# Dynamic Assist privacy policy

_Last updated 24 September 2026_

Dynamic Assist is a browser extension that shows administrator and developer tools for Microsoft Dynamics 365 Business Central, Dynamics 365 apps and the Power Apps maker portal in a side panel.

## What it reads

On businesscentral.dynamics.com, Dynamics 365 app sites (\*.dynamics.com) and make.powerapps.com, Dynamic Assist reads the page you have open: the record, its fields and values, page and table IDs, the signed-in user, company and environment. It shows these in the side panel. It does nothing on other sites.

On Dynamics 365 app pages it also calls that organisation's own Web API, as you and with your existing sign-in, to read table metadata, the current record's columns, the current view's query and the environment's details.

## What it stores

- **History**: the addresses and names of the Business Central environments, Dynamics 365 organisations and Power Apps environments you open, when you last opened them, and any pins or names you add. Stored in your browser's extension storage.
- **Preferences**: light or dark mode and which panel sections are collapsed. Stored in your browser.

Nothing else is stored. Record data shown in the panel is not kept.

## What it shares

Nothing. Dynamic Assist has no server of its own and sends no data to the developer or to any third party. It has no analytics, advertising or tracking. The only network requests it makes go to the Dynamics 365 organisation you're already using.

## How long data is kept, and how to delete it

History stays until you remove entries or choose Clear on the History page (pinned entries are kept until you unpin them). Uninstalling the extension deletes everything it stored.

## Contact

Questions about this policy: open an issue at https://github.com/garethcheyne/Dynamic-Assist/issues.

Dynamic Assist is an independent project, not affiliated with or endorsed by Microsoft.
