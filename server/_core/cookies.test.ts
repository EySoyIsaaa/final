import { describe, expect, it } from "vitest";
import type { Request } from "express";
import { getSessionCookieOptions } from "./cookies";

function createRequest(overrides: Partial<Request> = {}): Request {
  return {
    protocol: "http",
    headers: {},
    ...overrides,
  } as Request;
}

describe("getSessionCookieOptions", () => {
  it("returns secure+none for https requests", () => {
    const req = createRequest({ protocol: "https" });

    expect(getSessionCookieOptions(req)).toMatchObject({
      httpOnly: true,
      path: "/",
      sameSite: "none",
      secure: true,
    });
  });

  it("returns secure+none when forwarded proto includes https", () => {
    const req = createRequest({
      protocol: "http",
      headers: {
        "x-forwarded-proto": "http, https",
      },
    });

    expect(getSessionCookieOptions(req)).toMatchObject({
      sameSite: "none",
      secure: true,
    });
  });

  it("returns lax+insecure for local http", () => {
    const req = createRequest({ protocol: "http", headers: {} });

    expect(getSessionCookieOptions(req)).toMatchObject({
      sameSite: "lax",
      secure: false,
    });
  });
});
