import { routeCache } from "gorsee/server"

export default routeCache({
  maxAge: 120,
  mode: "public",
  includeAuthHeaders: false,
})
