import { describe, it, expect } from "bun:test"
import { defineForm, validateForm, fieldAttrs, toFieldErrors } from "../../src/runtime/validated-form.ts"

describe("validateForm", () => {
  const schema = defineForm([
    { name: "email", rules: { required: true, pattern: /^[^@]+@[^@]+$/ }, label: "Email" },
    { name: "name", rules: { required: true, minLength: 2, maxLength: 50 }, label: "Name" },
    { name: "age", rules: { min: 18, max: 120 } },
  ])

  it("validates valid data", () => {
    const result = validateForm({ email: "a@b.com", name: "John", age: "25" }, schema)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
    expect(result.data).toEqual({ email: "a@b.com", name: "John", age: 25 })
  })

  it("catches missing required fields", () => {
    const result = validateForm({ email: "", name: "" }, schema)
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThanOrEqual(2)
    expect(result.errors[0]!.field).toBe("email")
  })

  it("validates minLength", () => {
    const result = validateForm({ email: "a@b.com", name: "J" }, schema)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.field === "name")).toBe(true)
  })

  it("validates pattern", () => {
    const result = validateForm({ email: "not-an-email", name: "John" }, schema)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.field === "email")).toBe(true)
  })

  it("validates min/max numbers", () => {
    const result = validateForm({ email: "a@b.com", name: "John", age: "10" }, schema)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.field === "age")).toBe(true)
  })

  it("skips optional empty fields", () => {
    const result = validateForm({ email: "a@b.com", name: "John", age: "" }, schema)
    expect(result.valid).toBe(true)
  })

  it("supports custom validators", () => {
    const s = defineForm([
      { name: "code", rules: { custom: (v) => v !== "ABC" ? "Must be ABC" : null } },
    ])
    const fail = validateForm({ code: "XYZ" }, s)
    expect(fail.valid).toBe(false)
    expect(fail.errors[0]!.message).toBe("Must be ABC")

    const pass = validateForm({ code: "ABC" }, s)
    expect(pass.valid).toBe(true)
  })

  it("coerces numeric fields and returns grouped field errors", () => {
    const s = defineForm<{ age: number }>([
      { name: "age", kind: "number", rules: { required: true, min: 18 } },
    ])
    const fail = validateForm<{ age: number }>({ age: "10" }, s)
    expect(fail.fieldErrors).toEqual({ age: ["age must be at least 18"] })
    expect(toFieldErrors(fail.errors)).toEqual({ age: ["age must be at least 18"] })

    const pass = validateForm<{ age: number }>({ age: "20" }, s)
    expect(pass.data).toEqual({ age: 20 })
  })
})

describe("fieldAttrs", () => {
  it("generates HTML attributes from rules", () => {
    const attrs = fieldAttrs({
      name: "email",
      rules: { required: true, minLength: 5, maxLength: 100, pattern: /^[^@]+@[^@]+$/ },
    })
    expect(attrs.name).toBe("email")
    expect(attrs.required).toBe(true)
    expect(attrs.minlength).toBe(5)
    expect(attrs.maxlength).toBe(100)
    expect(attrs.pattern).toBe("^[^@]+@[^@]+$")
  })
})
