export type ErrorCode =
  | "E001" | "E002" | "E003" | "E004" | "E005"  // type safety
  | "E101" | "E102" | "E103"                      // server functions
  | "E201" | "E202"                                // routing
  | "E301" | "E302"                                // reactivity
  | "E401" | "E402"                                // SSR/hydration
  | "E501" | "E502"                                // security
  | "E901" | "E902"                                // project structure

interface ErrorEntry {
  code: ErrorCode
  title: string
  description: string
  fix: string
}

export const ERROR_CATALOG: Record<string, ErrorEntry> = {
  E001: {
    code: "E001",
    title: "SafeSQL violation",
    description: "Raw string passed to database query instead of SafeSQL tagged template",
    fix: "Use SafeSQL`...` tagged template literal with parameterized values",
  },
  E002: {
    code: "E002",
    title: "SafeHTML violation",
    description: "Unsanitized string used in HTML context",
    fix: "Use sanitize() or SafeHTML`...` tagged template literal",
  },
  E003: {
    code: "E003",
    title: "Server function closure capture",
    description: "server() function captures a client-side variable",
    fix: "Pass the value as a function argument instead of capturing it from outer scope",
  },
  E004: {
    code: "E004",
    title: "Invalid URL",
    description: "String is not a valid URL",
    fix: "Provide a valid URL with http:, https:, or mailto: protocol",
  },
  E005: {
    code: "E005",
    title: "Disallowed URL protocol",
    description: "URL uses a protocol that is not allowed (potential open redirect)",
    fix: "Use http:, https:, or mailto: protocol",
  },
}
