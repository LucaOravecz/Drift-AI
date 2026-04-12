import { describe, it, expect, beforeEach } from "vitest";
import { RateLimiter } from "../security-hardening.service";

describe("RateLimiter", () => {
  beforeEach(() => {
    // Rate limiter uses in-memory store — fresh per test file run
  });

  it("should allow requests within the limit", () => {
    const result = RateLimiter.check("test:allow", 5);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it("should block requests exceeding the limit", () => {
    const key = "test:block";
    for (let i = 0; i < 5; i++) {
      RateLimiter.check(key, 5);
    }
    const result = RateLimiter.check(key, 5);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("should track remaining count correctly", () => {
    const key = "test:remaining";
    RateLimiter.check(key, 10);
    RateLimiter.check(key, 10);
    RateLimiter.check(key, 10);
    const result = RateLimiter.check(key, 10);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(6);
  });
});
