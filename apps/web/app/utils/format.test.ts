import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatDate,
  formatMoney,
  formatWager,
  joinMeta,
  plural,
  sanitizeReviewText,
  wagerTone,
} from "./format.ts";

describe("formatWager", () => {
  it("normalizes variants to ×N", () => {
    assert.equal(formatWager("x30"), "×30");
    assert.equal(formatWager("×30"), "×30");
    assert.equal(formatWager("30x"), "×30");
    assert.equal(formatWager("35"), "×35");
    assert.equal(formatWager("Wager x40"), "×40");
  });
  it("returns null for empty", () => {
    assert.equal(formatWager(null), null);
    assert.equal(formatWager("—"), null);
    assert.equal(formatWager(0), null);
    assert.equal(formatWager(""), null);
  });
});

describe("wagerTone", () => {
  it("bands by value", () => {
    assert.equal(wagerTone(30), "good");
    assert.equal(wagerTone(35), "mid");
    assert.equal(wagerTone(45), "high");
    assert.equal(wagerTone(null), null);
  });
});

describe("formatMoney", () => {
  it("formats with thin space", () => {
    const m = formatMoney(1200);
    assert.ok(m?.includes("200"));
    assert.equal(formatMoney(null), null);
  });
});

describe("joinMeta", () => {
  it("drops empties and dangling separators", () => {
    assert.equal(joinMeta(["Вейджер ×30", null, "—", "Проверено"]), "Вейджер ×30 · Проверено");
    assert.equal(joinMeta([null, ""]), "");
  });
});

describe("plural", () => {
  it("ru forms", () => {
    assert.equal(plural(1, ["ответ", "ответа", "ответов"], "ru"), "ответ");
    assert.equal(plural(2, ["ответ", "ответа", "ответов"], "ru"), "ответа");
    assert.equal(plural(5, ["ответ", "ответа", "ответов"], "ru"), "ответов");
    assert.equal(plural(21, ["ответ", "ответа", "ответов"], "ru"), "ответ");
  });
  it("en forms", () => {
    assert.equal(plural(1, { one: "reply", few: "replies", many: "replies" }, "en"), "reply");
    assert.equal(plural(2, { one: "reply", few: "replies", many: "replies" }, "en"), "replies");
  });
});

describe("sanitizeReviewText", () => {
  it("strips seed tails", () => {
    assert.equal(sanitizeReviewText("Good casino (Pokerdom, #2423)"), "Good casino");
    assert.equal(sanitizeReviewText("Text [3c04d6bc] more"), "Text more");
  });
});

describe("formatDate", () => {
  it("formats valid dates", () => {
    assert.ok(formatDate("2026-11-09"));
    assert.equal(formatDate(null), null);
  });
});
