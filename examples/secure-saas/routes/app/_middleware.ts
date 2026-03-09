import { routeCache, type MiddlewareFn } from "gorsee/server"
import { auth } from "../../auth-shared"

const cache = routeCache({ maxAge: 60, mode: "private" })

const protectedMiddleware: MiddlewareFn = auth.protect(cache)

export default protectedMiddleware
