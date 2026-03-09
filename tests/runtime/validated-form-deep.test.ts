import { describe, test, expect } from "bun:test"
import { defineForm, validateAction, validateForm, fieldAttrs } from "../../src/runtime/validated-form.ts"

describe("validateForm deep: required", () => {
  const schema = defineForm([{ name: "username", rules: { required: true }, label: "Username" }])

  test("required field missing yields error", () => {
    const r = validateForm({}, schema)
    expect(r.valid).toBe(false)
    expect(r.errors[0]!.message).toContain("required")
  })
  test("required field empty string yields error", () => {
    const r = validateForm({ username: "" }, schema)
    expect(r.valid).toBe(false)
  })
  test("required field whitespace-only yields error", () => {
    const r = validateForm({ username: "   " }, schema)
    expect(r.valid).toBe(false)
  })
  test("required field present yields ok", () => {
    const r = validateForm({ username: "john" }, schema)
    expect(r.valid).toBe(true)
    expect(r.data).toEqual({ username: "john" })
  })
})

describe("validateForm deep: length rules", () => {
  const schema = defineForm([
    { name: "pw", rules: { required: true, minLength: 8, maxLength: 20 }, label: "Password" },
  ])

  test("minLength violation", () => {
    const r = validateForm({ pw: "abc" }, schema)
    expect(r.valid).toBe(false)
    expect(r.errors[0]!.message).toContain("at least 8")
  })
  test("maxLength violation", () => {
    const r = validateForm({ pw: "a".repeat(21) }, schema)
    expect(r.valid).toBe(false)
    expect(r.errors[0]!.message).toContain("at most 20")
  })
  test("exact minLength passes", () => {
    const r = validateForm({ pw: "a".repeat(8) }, schema)
    expect(r.valid).toBe(true)
  })
  test("exact maxLength passes", () => {
    const r = validateForm({ pw: "a".repeat(20) }, schema)
    expect(r.valid).toBe(true)
  })
})

describe("validateForm deep: number rules", () => {
  const schema = defineForm([{ name: "age", rules: { min: 0, max: 150 }, label: "Age" }])

  test("min violation", () => {
    const r = validateForm({ age: "-1" }, schema)
    expect(r.valid).toBe(false)
    expect(r.errors[0]!.message).toContain("at least 0")
  })
  test("max violation", () => {
    const r = validateForm({ age: "200" }, schema)
    expect(r.valid).toBe(false)
    expect(r.errors[0]!.message).toContain("at most 150")
  })
  test("boundary min=0 passes", () => {
    const r = validateForm({ age: "0" }, schema)
    expect(r.valid).toBe(true)
  })
  test("boundary max=150 passes", () => {
    const r = validateForm({ age: "150" }, schema)
    expect(r.valid).toBe(true)
  })
  test("empty optional number field passes", () => {
    const r = validateForm({ age: "" }, schema)
    expect(r.valid).toBe(true)
  })
})

describe("validateForm deep: pattern", () => {
  const schema = defineForm([
    { name: "email", rules: { required: true, pattern: /^[^@\s]+@[^@\s]+\.[^@\s]+$/ }, label: "Email" },
  ])

  test("valid email passes", () => {
    expect(validateForm({ email: "a@b.com" }, schema).valid).toBe(true)
  })
  test("invalid email fails", () => {
    const r = validateForm({ email: "not-email" }, schema)
    expect(r.valid).toBe(false)
    expect(r.errors[0]!.message).toContain("format is invalid")
  })
})

describe("validateForm deep: custom validator", () => {
  const schema = defineForm([{
    name: "code",
    rules: { custom: (v) => v.startsWith("G-") ? null : "Must start with G-" },
  }])

  test("custom pass", () => {
    expect(validateForm({ code: "G-123" }, schema).valid).toBe(true)
  })
  test("custom fail", () => {
    const r = validateForm({ code: "X-1" }, schema)
    expect(r.valid).toBe(false)
    expect(r.errors[0]!.message).toBe("Must start with G-")
  })
})

describe("validateForm deep: multiple fields/errors", () => {
  const schema = defineForm([
    { name: "a", rules: { required: true }, label: "A" },
    { name: "b", rules: { required: true }, label: "B" },
    { name: "c", rules: { required: true }, label: "C" },
  ])

  test("multiple errors on multiple fields", () => {
    const r = validateForm({}, schema)
    expect(r.valid).toBe(false)
    expect(r.errors.length).toBe(3)
    expect(r.data).toBeNull()
  })
  test("all valid yields data", () => {
    const r = validateForm({ a: "1", b: "2", c: "3" }, schema)
    expect(r.valid).toBe(true)
    expect(r.errors.length).toBe(0)
    expect(r.data).toEqual({ a: "1", b: "2", c: "3" })
  })
})

describe("defineForm", () => {
  test("returns schema with fields", () => {
    const s = defineForm([{ name: "x", rules: { required: true } }])
    expect(s.fields).toHaveLength(1)
    expect(s.fields[0]!.name).toBe("x")
  })
  test("empty fields list", () => {
    const s = defineForm([])
    expect(s.fields).toHaveLength(0)
    expect(validateForm({}, s).valid).toBe(true)
  })
})

describe("fieldAttrs deep", () => {
  test("required attribute", () => {
    const a = fieldAttrs({ name: "f", rules: { required: true } })
    expect(a.required).toBe(true)
  })
  test("min/max attributes", () => {
    const a = fieldAttrs({ name: "f", rules: { min: 5, max: 99 } })
    expect(a.min).toBe(5)
    expect(a.max).toBe(99)
  })
  test("pattern attribute uses regex source", () => {
    const a = fieldAttrs({ name: "f", rules: { pattern: /^\d+$/ } })
    expect(a.pattern).toBe("^\\d+$")
  })
  test("minlength/maxlength", () => {
    const a = fieldAttrs({ name: "f", rules: { minLength: 3, maxLength: 10 } })
    expect(a.minlength).toBe(3)
    expect(a.maxlength).toBe(10)
  })
  test("name always present", () => {
    const a = fieldAttrs({ name: "email", rules: {} })
    expect(a.name).toBe("email")
  })
  test("no extra attrs when no rules apply", () => {
    const a = fieldAttrs({ name: "x", rules: {} })
    expect(Object.keys(a)).toEqual(["name"])
  })
})

describe("validateAction deep", () => {
  test("parses json request and returns structured values", async () => {
    const schema = defineForm<{ age: number }>([
      { name: "age", kind: "number", rules: { required: true, min: 18 } },
    ])
    const request = new Request("http://localhost/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ age: 21 }),
    })

    const result = await validateAction(request, schema)
    expect(result.valid).toBe(true)
    expect(result.values).toEqual({ age: "21" })
    expect(result.data).toEqual({ age: 21 })
  })

  test("supports cross-field form rules", () => {
    const schema = defineForm<{ password: string; confirm: string }>([
      { name: "password", rules: { required: true, minLength: 8 } },
      { name: "confirm", rules: { required: true } },
    ], {
      formRules: [
        (data) => data.password !== data.confirm
          ? { field: "$form", message: "Passwords must match" }
          : null,
      ],
    })

    const result = validateForm({ password: "12345678", confirm: "87654321" }, schema)
    expect(result.valid).toBe(false)
    expect(result.formErrors).toEqual(["Passwords must match"])
  })
})
