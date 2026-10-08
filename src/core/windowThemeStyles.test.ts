import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readCss = (relativePath: string) =>
  readFileSync(new URL(relativePath, import.meta.url), "utf8");

const calendarOverlayCss = readCss(
  "../features/calendar/components/CalendarOverlay.css",
);
const gameLauncherOverlayCss = readCss(
  "../features/game_launcher/components/GameLauncherOverlay.css",
);

const ruleBodiesFor = (css: string, targetSelector: string) =>
  [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter((match) =>
      match[1]
        .split(",")
        .map((selector) => selector.trim())
        .includes(targetSelector),
    )
    .map((match) => match[2]);

const expectThemeColorRule = (css: string, selector: string) => {
  expect(css).toContain(selector);
  const ruleBodies = ruleBodiesFor(css, selector);
  expect(ruleBodies.length).toBeGreaterThan(0);
  expect(
    ruleBodies.some((body) => body.includes("color: var(--color-accent)")),
  ).toBe(true);
};

describe("overlay theme color contracts", () => {
  it("keeps calendar navigation and actions on the configured accent", () => {
    expect(calendarOverlayCss).not.toContain("--color-accent-strong");
    expectThemeColorRule(calendarOverlayCss, ".month-calendar__date-jump");
    expectThemeColorRule(calendarOverlayCss, ".month-calendar__nav-button");
    expectThemeColorRule(calendarOverlayCss, ".month-calendar__add-button");
    expectThemeColorRule(calendarOverlayCss, ".calendar-icon-button");
    expectThemeColorRule(calendarOverlayCss, ".calendar-screen__empty button");
  });

  it("keeps game launcher actions on the configured accent", () => {
    expectThemeColorRule(
      gameLauncherOverlayCss,
      ".game-launcher__search-clear",
    );
    expectThemeColorRule(gameLauncherOverlayCss, ".game-launcher__action");
    expectThemeColorRule(
      gameLauncherOverlayCss,
      ".game-launcher__preview-actions button",
    );
    expectThemeColorRule(
      gameLauncherOverlayCss,
      ".game-launcher__footer button",
    );
  });
});
