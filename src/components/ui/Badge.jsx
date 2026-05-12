const colorMap = {
  admin: 'purple',
  organizer: 'amber',
  volunteer: 'green',
  attendee: 'slate',
  published: 'green',
  ongoing: 'cyan',
  completed: 'slate',
  draft: 'amber',
  cancelled: 'red',
  active: 'green',
  inactive: 'red',
  approved: 'green',
  pending: 'amber',
  rejected: 'red',
  reapplied: 'blue',
  confirmed: 'green',
  cash: 'amber',
  online: 'cyan',
};

// Format a label for display: lowercase tokens like "ongoing" → "Ongoing",
// snake_case "checked_in" → "Checked In", SCREAMING_SNAKE "ADMIN" → "Admin".
// Codes that are already mixed-case or contain hyphens (e.g. "TKT-A4B7K9X3") are left alone.
const formatLabel = (s) => {
  if (s == null) return s;
  const str = String(s);
  // Leave well-formed codes alone (TKT-XXXX, etc.)
  if (/^[A-Z]+-[A-Z0-9]+$/.test(str)) return str;
  // Already nicely cased? leave it.
  if (/[a-z][A-Z]/.test(str)) return str;
  return str
    .replace(/[_\s]+/g, ' ')
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
};

export default function Badge({ label, color, dot }) {
  const lookupKey = typeof label === 'string' ? label.toLowerCase() : label;
  const c = color || colorMap[lookupKey] || colorMap[label] || 'slate';
  return (
    <span className={`badge badge-${c}`}>
      {dot && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />}
      {formatLabel(label)}
    </span>
  );
}
