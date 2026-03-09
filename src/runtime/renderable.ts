export type GorseePrimitive = string | number | boolean | null | undefined

export type GorseeVNodeLike = {
  type: string | symbol | ((props: Record<string, unknown>) => GorseeRenderable)
  props: Record<string, unknown>
}

export type GorseeRenderable =
  | Node
  | DocumentFragment
  | GorseePrimitive
  | GorseeVNodeLike
  | GorseeRenderable[]
  | (() => unknown)
