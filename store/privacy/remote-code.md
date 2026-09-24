# Remote code

Chrome Web Store → Privacy → **Are you using remote code?**, and Edge Partner
Center → Privacy → **Remote code**. Manifest V3 bans running code that isn't in
the package: remote `<script>` tags, `eval()`, or JavaScript fetched at runtime.
Fetching data (JSON, HTML to display) is not remote code.

**No, I am not using remote code.** All JavaScript is bundled in the package, including the scripts the extension registers on Business Central and Dynamics 365 pages. The extension calls the Dynamics 365 Web API of the organisation you're signed in to and receives JSON; it never loads or runs code from it, and uses no `eval()` or `new Function()`.
