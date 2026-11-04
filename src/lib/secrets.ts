import rules from "./secretRules.json";

export type SecretInfo = {
  service: string; // e.g. "AWS", "GitHub", "Database", "Generic"
  label: string; // e.g. "AWS credentials", "GitHub token"
};

// ── Name-based detection ────────────────────────────────────────────────────

// Exact name → known service (highest priority)
const EXACT: Record<string, SecretInfo> = rules.exact;

// Service prefix → service info (only matched when remainder contains a secret keyword)
const SERVICE_PREFIXES = rules.prefixes;

const SECRET_KEYWORDS = rules.keywords;

// ── Value-based detection (structured token patterns) ───────────────────────
//
// Many services now embed the service identity in the token prefix itself.
// These patterns match the token VALUE regardless of what the variable is named,
// so `MY_KEY=ghp_xxx` is still detected as a GitHub token.

const VALUE_PATTERNS = rules.valuePatterns.map(({ pattern, ...info }) => ({
  regex: new RegExp(pattern),
  ...info,
}));

export function detectSecretByValue(value: string): SecretInfo | null {
  // Short values are never meaningful tokens; skip for performance
  if (value.length < 10) return null;
  for (const { regex, service, label } of VALUE_PATTERNS) {
    if (regex.test(value)) return { service, label };
  }
  return null;
}

// ── Combined API ─────────────────────────────────────────────────────────────

/** Name-based detection only. Use resolveSecret when the value is also available. */
export function detectSecret(name: string): SecretInfo | null {
  const upper = name.toUpperCase();

  if (EXACT[upper]) return EXACT[upper];

  for (const { prefix, service, label } of SERVICE_PREFIXES) {
    if (upper.startsWith(prefix)) {
      const rest = upper.slice(prefix.length);
      if (SECRET_KEYWORDS.some((kw) => rest.includes(kw))) {
        return { service, label };
      }
    }
  }

  if (SECRET_KEYWORDS.some((kw) => upper.includes(kw))) {
    return { service: "Generic", label: "Secret value" };
  }

  return null;
}

/** Name first, then value pattern. Prefer this when both are available. */
export function resolveSecret(name: string, value: string): SecretInfo | null {
  return detectSecret(name) ?? detectSecretByValue(value);
}

export function isSecretVar(name: string): boolean {
  return detectSecret(name) !== null;
}
