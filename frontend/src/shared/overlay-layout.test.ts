import { describe, expect, it } from "vitest";
import {
  calculateOverlayBounds,
  getOverlayProximityDimensions,
  shouldDisableOverlayProximity,
} from "./overlay-layout";

describe("overlay click-through state", () => {
  it("disables proximity capture when the pill is hidden and idle", () => {
    expect(
      shouldDisableOverlayProximity({
        hidePill: true,
        status: "idle",
        isOverNotification: false,
        menuOverrideActive: false,
      }),
    ).toBe(true);
  });

  it("keeps notification hover interactive even while the pill is hidden", () => {
    expect(
      shouldDisableOverlayProximity({
        hidePill: true,
        status: "idle",
        isOverNotification: true,
        menuOverrideActive: false,
      }),
    ).toBe(false);
  });

  it("uses a collapsed proximity zone close to the visible pill size", () => {
    expect(getOverlayProximityDimensions(false)).toEqual({
      width: 80,
      height: 20,
    });
  });
});

describe("overlay bounds", () => {
  it("anchors the overlay inside the display work area", () => {
    const bounds = calculateOverlayBounds({
      x: 100,
      y: 50,
      width: 1920,
      height: 1040,
    });

    expect(bounds).toEqual({
      x: 830,
      y: 830,
      width: 460,
      height: 260,
    });
    expect(bounds.y + bounds.height).toBe(1090);
  });
});
