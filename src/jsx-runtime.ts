// JSX automatic runtime entry point
// jsxImportSource: "gorsee" resolves to gorsee/jsx-runtime
// In dev/SSR mode this uses ssrJsx; client build would swap to DOM jsx

import { ssrJsx, ssrJsxs } from "./runtime/server.ts"
import { Fragment } from "./runtime/jsx-runtime.ts"

export { Fragment }
export const jsx = ssrJsx
export const jsxs = ssrJsxs
export const jsxDEV = ssrJsx

export namespace JSX {
  export type Element = import("./runtime/renderable.ts").GorseeRenderable
  export type IntrinsicElements = import("./jsx-types-html.ts").GorseeIntrinsicElements

  export interface ElementChildrenAttribute {
    children: unknown
  }
}
