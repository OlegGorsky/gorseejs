import { auth } from "../lib/auth.ts"

// Parse session cookie on every request (does not require auth)
export const middleware = auth.middleware
