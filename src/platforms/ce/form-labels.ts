// Field labels are <label id="id-<guid>-<counter>-<control>-field-label">. The
// GUID has dashes (and can have all-digit segments), control names never do,
// so the control is the last dash-free segment before "-field-label".
const LABEL_ID = /-\d+-([^-]+)-field-label$/

/** The control name a form field label belongs to (header_x for header fields); null if not a field label. */
export function controlNameFromLabelId(id: string): string | null {
  return id.match(LABEL_ID)?.[1] ?? null
}
