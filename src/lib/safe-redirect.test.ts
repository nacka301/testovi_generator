import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-redirect";

describe("safeNextPath", () => {
  it("propušta relativne putanje", () => {
    expect(safeNextPath("/app")).toBe("/app");
    expect(safeNextPath("/app/testovi?x=1")).toBe("/app/testovi?x=1");
  });

  it("vraća zadanu putanju kad vrijednosti nema", () => {
    expect(safeNextPath(null)).toBe("/app");
    expect(safeNextPath(undefined)).toBe("/app");
    expect(safeNextPath("")).toBe("/app");
  });

  it("odbija apsolutne i protokol-relativne adrese", () => {
    expect(safeNextPath("https://evil.example")).toBe("/app");
    expect(safeNextPath("//evil.example")).toBe("/app");
    expect(safeNextPath("/\\evil.example")).toBe("/app");
    expect(safeNextPath("javascript:alert(1)")).toBe("/app");
  });

  it("odbija kontrolne znakove", () => {
    expect(safeNextPath("/app\r\nSet-Cookie: x=1")).toBe("/app");
  });
});
