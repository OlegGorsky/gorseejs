import { describe, expect, test } from "bun:test"
import { resolveRequestMetadata } from "../../src/server/request-policy.ts"

describe("forwarded metadata extra fuzz", () => {
  test("keeps effective host fail-safe across malformed forwarded chains", () => {
    const inputs = [
      'for="[::1]";proto=https;host=app.example.com',
      'for=unknown;host="bad host";proto=http, for=1.1.1.1',
      'for=1.1.1.1;proto=https;host=app.example.com:443',
      ';;;;',
      'host=app.example.com;proto=https;for="malformed',
    ]

    for (const forwarded of inputs) {
      const metadata = resolveRequestMetadata(new Request("http://localhost/dashboard", {
        headers: {
          host: "localhost",
          forwarded,
        },
      }), {
        kind: "page",
        trustForwardedHeaders: false,
      })

      expect(metadata.effectiveHost).toBe("localhost")
      expect(metadata.effectiveProto).toBe("http")
      expect(metadata.effectiveOrigin).toBe("http://localhost")
    }
  })

  test("trusted forwarded parsing never throws on malformed host/proto combinations", () => {
    const inputs = [
      'host=app.example.com;proto=https',
      'host=app.example.com:443;proto=https:',
      'proto=ws;host=app.example.com',
      'host=app.example.com;proto=',
      'host=;proto=https',
    ]

    for (const forwarded of inputs) {
      const metadata = resolveRequestMetadata(new Request("http://localhost/dashboard", {
        headers: {
          host: "localhost",
          forwarded,
        },
      }), {
        kind: "page",
        trustForwardedHeaders: true,
      })

      expect(typeof metadata.effectiveHost).toBe("string")
      expect(typeof metadata.effectiveProto).toBe("string")
      expect(typeof metadata.effectiveOrigin).toBe("string")
    }
  })
})
