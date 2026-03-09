// Client-side JSX runtime -- creates real DOM nodes with reactive bindings
// Used by client bundles (browser target)

export { jsx, jsxs, jsxDEV, Fragment } from "./runtime/jsx-runtime.ts"

export namespace JSX {
  export type Element = import("./runtime/renderable.ts").GorseeRenderable
  export type IntrinsicElements = import("./jsx-types-html.ts").GorseeIntrinsicElements

  export interface ElementChildrenAttribute {
    children: unknown
  }
}
