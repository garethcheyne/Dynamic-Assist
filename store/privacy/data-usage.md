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
Two things are handled locally and are worth confirming against the dashboard's wording:

- **Website content**: the panel reads the record, field values, IDs and signed-in user shown on Business Central and Dynamics 365 pages, to display them. It never stores or sends them.
- **Web history**: History keeps the addresses and names of the Business Central environments, Dynamics 365 orgs and Power Apps environments you open, with the time of your last visit, in chrome.storage.local. It never leaves the browser and can be cleared from the History page.

## Where does it go?

Nothing leaves the browser except the requests a Dynamics 365 page would make anyway: on Dynamics 365 app pages the extension calls that organisation's own Web API (the same host you're on, as you, with your sign-in) to read table metadata, the current record's columns, the current view's query and the environment's details. The results are shown in the side panel and not kept.

History and preferences are stored in chrome.storage.local and localStorage in your browser. There is no server of our own, no analytics, no error reporting and no third party.

## Certifications (all three must be true to publish)

- [ ] I do not sell or transfer user data to third parties, outside of the approved use cases
- [ ] I do not use or transfer user data for purposes unrelated to my item's single purpose
- [ ] I do not use or transfer user data to determine creditworthiness or for lending purposes
