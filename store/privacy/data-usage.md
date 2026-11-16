# Data usage

Chrome Web Store → Privacy → **Data usage**, and Edge Partner Center → Privacy → **Data usage certification**.
Tick the same boxes in the dashboard as are ticked here, so this file stays the record.

## What user data does the extension collect?

- [ ] Personally identifiable information (name, address, email, age, ID number)
- [ ] Health information
- [ ] Financial and payment information
- [ ] Authentication information (passwords, credentials, security questions, PINs)
- [ ] Personal communications (emails, texts, chat messages)
- [ ] Location (region, IP address, GPS coordinates)
- [ ] Web history (pages visited, titles, time of visit)
- [ ] User activity (clicks, mouse position, scroll, keystroke logging)
- [ ] Website content (text, images, sounds, videos, hyperlinks)

Nothing is transmitted off the device, which is how both stores define collection.
These are handled locally and are worth confirming against the dashboard's wording:

- **Website content**: the panel reads the record, field values, IDs and signed-in user shown on Business Central, Dynamics 365, Power Apps and Power Automate pages, to display them. It never stores or sends them. With the Errors tab switched on (off by default), it also notes Dynamics 365 pages' own errors, failed scripts and failed requests (and console errors and warnings, if switched on); that log stays in the page and is gone on reload.
- **Other users' names and security roles**: the Access tool in Dynamics 365 can check what another user of the same organisation can do (their roles, privileges and access to the open record), read from that organisation's Web API with your own permissions. Shown in the panel only, never stored.
- **Web history**: History keeps the addresses and names of the Business Central environments, Dynamics 365 orgs and Power Platform environments you open, with the time of your last visit, in chrome.storage.local. It never leaves the browser and can be cleared from the History page.
- **Sign-in**: the extension never reads, stores or sends passwords or tokens. Requests go out with the browser's existing session for that site.

## Where does it go?

Nothing leaves the browser except requests to the Microsoft service you're already signed in to, made as you with your permissions: the Dynamics 365 organisation's Web API, the Power Platform environment's Dataverse Web API, and in Business Central the optional, read-only Dynamic Assist Companion app inside the page. Results are shown and not kept, unless you choose Export, which saves a file to your own computer.

Stored only in the browser: History, saved queries, which Business Central company goes with which Dynamics 365 org, short-lived caches of Business Central table and app names, and preferences. No server of our own, no analytics, no error reporting, no third party. Links to the Dynamic Assist website open in a new tab only when clicked.

The full detail, kept up to date: https://dynamicassist.err403.com/privacy/

## Certifications (all three must be true to publish)

- [ ] I do not sell or transfer user data to third parties, outside of the approved use cases
- [ ] I do not use or transfer user data for purposes unrelated to my item's single purpose
- [ ] I do not use or transfer user data to determine creditworthiness or for lending purposes
