// HTML intrinsic element types for JSX autocomplete

type EventHandler = (event: Event) => void
interface HTMLAttributes {
  // Core
  id?: string
  class?: string
  className?: string
  style?: string | Record<string, string | number | (() => string | number)>
  title?: string
  tabIndex?: number
  hidden?: boolean
  children?: unknown

  // Accessibility
  role?: string

  // Events (on:event pattern)
  "on:click"?: EventHandler
  "on:dblclick"?: EventHandler
  "on:mousedown"?: EventHandler
  "on:mouseup"?: EventHandler
  "on:mouseover"?: EventHandler
  "on:mouseout"?: EventHandler
  "on:mousemove"?: EventHandler
  "on:keydown"?: (event: KeyboardEvent) => void
  "on:keyup"?: (event: KeyboardEvent) => void
  "on:keypress"?: (event: KeyboardEvent) => void
  "on:focus"?: (event: FocusEvent) => void
  "on:blur"?: (event: FocusEvent) => void
  "on:input"?: (event: InputEvent) => void
  "on:change"?: EventHandler
  "on:submit"?: (event: SubmitEvent) => void
  "on:scroll"?: EventHandler
  "on:touchstart"?: EventHandler
  "on:touchend"?: EventHandler
  "on:touchmove"?: EventHandler

  // Data attributes
  [key: `data-${string}`]: string | number | boolean | undefined
  // Aria attributes
  [key: `aria-${string}`]: string | number | boolean | undefined
}

interface AnchorAttributes extends HTMLAttributes {
  href?: string
  target?: string
  rel?: string
  download?: string | boolean
}

interface ImgAttributes extends HTMLAttributes {
  src?: string
  alt?: string
  width?: number | string
  height?: number | string
  loading?: "lazy" | "eager"
  decoding?: "async" | "auto" | "sync"
}

interface InputAttributes extends HTMLAttributes {
  type?: string
  name?: string
  value?: string | number
  checked?: boolean
  disabled?: boolean
  placeholder?: string
  required?: boolean
  readonly?: boolean
  min?: number | string
  max?: number | string
  step?: number | string
  pattern?: string
  autocomplete?: string
}

interface FormAttributes extends HTMLAttributes {
  action?: string
  method?: string
  enctype?: string
  novalidate?: boolean
}

interface ButtonAttributes extends HTMLAttributes {
  type?: "button" | "submit" | "reset"
  disabled?: boolean
  name?: string
  value?: string
}

interface SelectAttributes extends HTMLAttributes {
  name?: string
  value?: string
  disabled?: boolean
  multiple?: boolean
  required?: boolean
}

interface TextareaAttributes extends HTMLAttributes {
  name?: string
  value?: string
  placeholder?: string
  rows?: number
  cols?: number
  disabled?: boolean
  required?: boolean
  readonly?: boolean
}

interface OptionAttributes extends HTMLAttributes {
  value?: string
  selected?: boolean
  disabled?: boolean
}

interface LabelAttributes extends HTMLAttributes {
  for?: string
  htmlFor?: string
}

interface MetaAttributes extends HTMLAttributes {
  name?: string
  content?: string
  charset?: string
  "http-equiv"?: string
}

interface LinkAttributes extends HTMLAttributes {
  href?: string
  rel?: string
  type?: string
  media?: string
}

interface ScriptAttributes extends HTMLAttributes {
  src?: string
  type?: string
  async?: boolean
  defer?: boolean
  nonce?: string
}

interface IframeAttributes extends HTMLAttributes {
  src?: string
  srcdoc?: string
  width?: number | string
  height?: number | string
  sandbox?: string
  allow?: string
}

interface TableCellAttributes extends HTMLAttributes {
  colspan?: number
  rowspan?: number
}

export interface GorseeIntrinsicElements {
  // Structural
  div: HTMLAttributes
  span: HTMLAttributes
  p: HTMLAttributes
  main: HTMLAttributes
  section: HTMLAttributes
  article: HTMLAttributes
  aside: HTMLAttributes
  header: HTMLAttributes
  footer: HTMLAttributes
  nav: HTMLAttributes

  // Headings
  h1: HTMLAttributes
  h2: HTMLAttributes
  h3: HTMLAttributes
  h4: HTMLAttributes
  h5: HTMLAttributes
  h6: HTMLAttributes

  // Text
  a: AnchorAttributes
  strong: HTMLAttributes
  em: HTMLAttributes
  b: HTMLAttributes
  i: HTMLAttributes
  small: HTMLAttributes
  code: HTMLAttributes
  pre: HTMLAttributes
  blockquote: HTMLAttributes
  br: HTMLAttributes
  hr: HTMLAttributes

  // Lists
  ul: HTMLAttributes
  ol: HTMLAttributes
  li: HTMLAttributes
  dl: HTMLAttributes
  dt: HTMLAttributes
  dd: HTMLAttributes

  // Forms
  form: FormAttributes
  input: InputAttributes
  button: ButtonAttributes
  select: SelectAttributes
  textarea: TextareaAttributes
  option: OptionAttributes
  label: LabelAttributes
  fieldset: HTMLAttributes
  legend: HTMLAttributes

  // Media
  img: ImgAttributes
  video: HTMLAttributes & { src?: string; controls?: boolean; autoplay?: boolean }
  audio: HTMLAttributes & { src?: string; controls?: boolean }
  source: HTMLAttributes & { src?: string; type?: string }
  canvas: HTMLAttributes & { width?: number; height?: number }
  svg: HTMLAttributes & { viewBox?: string; xmlns?: string; width?: number | string; height?: number | string }

  // Table
  table: HTMLAttributes
  thead: HTMLAttributes
  tbody: HTMLAttributes
  tfoot: HTMLAttributes
  tr: HTMLAttributes
  th: TableCellAttributes
  td: TableCellAttributes

  // Other
  iframe: IframeAttributes
  details: HTMLAttributes
  summary: HTMLAttributes
  dialog: HTMLAttributes & { open?: boolean }
  template: HTMLAttributes
  slot: HTMLAttributes
  meta: MetaAttributes
  link: LinkAttributes
  script: ScriptAttributes
  style: HTMLAttributes
  title: HTMLAttributes

  // Fallback for any element
  [elemName: string]: HTMLAttributes
}
