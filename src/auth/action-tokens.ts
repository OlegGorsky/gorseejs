import { decodeBase64Url, encodeBase64Url, signValue, verifySignedValue } from "./signing.ts"

type Awaitable<T> = T | Promise<T>

export type AuthActionTokenPurpose = "magic-link" | "password-reset" | "email-verification"

export interface AuthActionTokenClaims {
  id: string
  purpose: AuthActionTokenPurpose
  subject: string
  email?: string
  metadata?: Record<string, unknown>
  issuedAt: number
  expiresAt: number
}

export interface AuthActionTokenReplayStore {
  consume(id: string, expiresAt: number): Awaitable<boolean>
}

export interface AuthActionTokenManagerOptions {
  secret: string
  store?: AuthActionTokenReplayStore
}

export interface AuthActionTokenIssueOptions {
  purpose: AuthActionTokenPurpose
  subject: string
  email?: string
  metadata?: Record<string, unknown>
  maxAgeSeconds?: number
}

export interface AuthActionTokenVerificationOptions {
  expectedPurpose?: AuthActionTokenPurpose
}

export function createMemoryAuthActionTokenStore(): AuthActionTokenReplayStore {
  const consumed = new Map<string, number>()

  function prune(now: number): void {
    for (const [id, expiresAt] of consumed) {
      if (expiresAt <= now) consumed.delete(id)
    }
  }

  return {
    consume(id, expiresAt) {
      const now = Date.now()
      prune(now)
      if (consumed.has(id)) return false
      consumed.set(id, expiresAt)
      return true
    },
  }
}

const defaultReplayStore = createMemoryAuthActionTokenStore()

export function createAuthActionTokenManager(options: AuthActionTokenManagerOptions) {
  const store = options.store ?? defaultReplayStore

  async function issueToken(input: AuthActionTokenIssueOptions): Promise<{ token: string; claims: AuthActionTokenClaims }> {
    const issuedAt = Date.now()
    const claims: AuthActionTokenClaims = {
      id: crypto.randomUUID(),
      purpose: input.purpose,
      subject: input.subject,
      email: input.email,
      metadata: input.metadata,
      issuedAt,
      expiresAt: issuedAt + (input.maxAgeSeconds ?? 900) * 1000,
    }
    const payload = encodeBase64Url(JSON.stringify(claims))
    return {
      token: await signValue(payload, options.secret),
      claims,
    }
  }

  async function verifyToken(
    token: string,
    verification: AuthActionTokenVerificationOptions = {},
  ): Promise<AuthActionTokenClaims | null> {
    const payload = await verifySignedValue(token, options.secret)
    if (!payload) return null

    try {
      const claims = JSON.parse(decodeBase64Url(payload)) as AuthActionTokenClaims
      if (verification.expectedPurpose && claims.purpose !== verification.expectedPurpose) return null
      if (claims.expiresAt <= Date.now()) return null
      return claims
    } catch {
      return null
    }
  }

  async function consumeToken(
    token: string,
    verification: AuthActionTokenVerificationOptions = {},
  ): Promise<AuthActionTokenClaims | null> {
    const claims = await verifyToken(token, verification)
    if (!claims) return null
    const accepted = await store.consume(claims.id, claims.expiresAt)
    return accepted ? claims : null
  }

  return {
    issue(input: AuthActionTokenIssueOptions) {
      return issueToken(input)
    },
    issueMagicLink(subject: string, email?: string, metadata?: Record<string, unknown>) {
      return issueToken({ purpose: "magic-link", subject, email, metadata, maxAgeSeconds: 900 })
    },
    issuePasswordReset(subject: string, email?: string, metadata?: Record<string, unknown>) {
      return issueToken({ purpose: "password-reset", subject, email, metadata, maxAgeSeconds: 3600 })
    },
    issueEmailVerification(subject: string, email: string, metadata?: Record<string, unknown>) {
      return issueToken({ purpose: "email-verification", subject, email, metadata, maxAgeSeconds: 86_400 })
    },
    verify(token: string, verification?: AuthActionTokenVerificationOptions) {
      return verifyToken(token, verification)
    },
    consume(token: string, verification?: AuthActionTokenVerificationOptions) {
      return consumeToken(token, verification)
    },
  }
}
