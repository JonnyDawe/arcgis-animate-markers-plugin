import Point from "@arcgis/core/geometry/Point";
import Graphic from "@arcgis/core/Graphic";
import PictureMarkerSymbol from "@arcgis/core/symbols/PictureMarkerSymbol";
import SimpleMarkerSymbol from "@arcgis/core/symbols/SimpleMarkerSymbol";
import { afterEach, beforeEach, describe, expect, Mock, test, vitest } from "vitest";

import { AnimatedSymbol } from "../src/AnimatedSymbol";
import {
  AnimationEasingConfig,
  IAnimatedGraphic,
  IPictureMarkerWithOpacity,
  ISimpleMarkerWithOpacity,
} from "../src/types";
import { updateSimpleMarker } from "../src/updateMarkers";
import { getImageAsBase64 } from "../src/utils/encodeimage";

describe("AnimatedSymbol", () => {
  const simpleMarkerSymbol: __esri.SimpleMarkerSymbol = new SimpleMarkerSymbol({
    size: 10,
    color: "red",
  });
  let graphic: __esri.Graphic;

  beforeEach(() => {
    graphic = new Graphic({
      geometry: new Point({
        x: 0,
        y: 0,
      }),
      symbol: simpleMarkerSymbol,
    });
  });

  test("can create a standard simple marker animated graphic", () => {
    const easingConfig: AnimationEasingConfig = {
      type: "easing",
      options: { duration: 1000, easingFunction: "linear" },
    };
    const animatedGraphic = AnimatedSymbol.createAnimatedGraphic({
      graphic,
      easingConfig,
      id: "animated-graphic",
      isOverlay: true,
      opacity: 0.5,
    });

    expect(animatedGraphic.symbolAnimation).toBeInstanceOf(AnimatedSymbol);
    expect(animatedGraphic.symbolAnimation.id).toBe("animated-graphic");
    expect(animatedGraphic.symbolAnimation.isOverlay).toBe(true);
    expect(animatedGraphic.symbolAnimation.easingConfig).toBe(easingConfig);
    expect(animatedGraphic.symbolAnimation.graphic).toBe(graphic);
    expect(animatedGraphic.symbolAnimation.graphic.symbol.type).toBe(simpleMarkerSymbol.type);
    expect(
      (animatedGraphic.symbolAnimation.originalSymbol as ISimpleMarkerWithOpacity).opacity
    ).toBe(0.5);
    expect(animatedGraphic.symbolAnimation.graphic.symbol.color.a).toBe(0.5);
  });

  test("can create a picture marker animated graphic", () => {
    const pictureMarkerSymbol: __esri.PictureMarkerSymbol = new PictureMarkerSymbol({
      url: "https://example.com/image.jpg",
      width: "64",
      height: "64",
    });

    vitest.mock("../src/utils/encodeimage");
    const encodeImageSpy = vitest.fn().mockImplementation(() => {
      return "testString";
    });
    (getImageAsBase64 as Mock<any, any>).mockImplementation(() => encodeImageSpy());

    graphic.symbol = pictureMarkerSymbol;

    const easingConfig: AnimationEasingConfig = {
      type: "easing",
      options: { duration: 1000, easingFunction: "linear" },
    };
    const animatedGraphic = AnimatedSymbol.createAnimatedGraphic({
      graphic,
      easingConfig,
      id: "animated-graphic",
      isOverlay: true,
      opacity: 0.5,
    });

    expect(animatedGraphic.symbolAnimation.graphic.symbol.type).toBe(pictureMarkerSymbol.type);
    expect(
      (animatedGraphic.symbolAnimation.originalSymbol as IPictureMarkerWithOpacity).opacity
    ).toBe(0.5);
    expect((animatedGraphic.symbolAnimation.graphic.symbol as PictureMarkerSymbol).url).toContain(
      "opacity='0.5'"
    );
    expect((animatedGraphic.symbolAnimation.graphic.symbol as PictureMarkerSymbol).url).toContain(
      "href='testString'"
    );
  });

  describe("onStart", () => {
    let animatedSymbol: AnimatedSymbol;
    const mockAnimateSymbol = vitest.fn();
    beforeEach(() => {
      animatedSymbol = new AnimatedSymbol({
        graphic,
        easingConfig: { type: "spring", options: {} },
        id: "test",
      });
      (animatedSymbol as any).animateSymbolWithSpringEasing = mockAnimateSymbol;
    });

    afterEach(() => {
      vitest.resetAllMocks();
    });

    test("should call animateSymbol with animationProps and a correct onStep function", () => {
      animatedSymbol.start({});
      expect(mockAnimateSymbol).toHaveBeenCalledWith(
        {},
        {},
        updateSimpleMarker // default onStep function using update simple marker.
      );
    });
    test("should be able to be called with animationProps and a custom onStep function", () => {
      const mockOnStep = vitest.fn();
      animatedSymbol.start({ onStep: mockOnStep });
      expect(mockAnimateSymbol).toHaveBeenCalledWith({ onStep: mockOnStep }, {}, mockOnStep);
    });
  });

  describe("when symbol is animated", () => {
    test("the scale and rotation is correct at end of spring animation", async () => {
      const animatedGraphic = AnimatedSymbol.createAnimatedGraphic({
        graphic,
        easingConfig: { type: "spring", options: {} },
        id: "animated-graphic",
        isOverlay: true,
      });
      animatedGraphic.symbolAnimation.start({ to: { scale: 1.1, rotate: -30 } });
      await new Promise(r => setTimeout(r, 2000));
      expect((animatedGraphic.symbol as SimpleMarkerSymbol).size).toBe(11);
      expect((animatedGraphic.symbol as SimpleMarkerSymbol).angle).toBe(-30);
    });

    test("the scale and rotation is correct at end of easing animation", async () => {
      const animatedGraphic = AnimatedSymbol.createAnimatedGraphic({
        graphic,
        easingConfig: { type: "easing", options: { easingFunction: "easeInExpo", duration: 1000 } },
        id: "animated-graphic",
        isOverlay: true,
      });
      animatedGraphic.symbolAnimation.start({ to: { scale: 1.1 } });
      await new Promise(r => setTimeout(r, 2000));
      expect((animatedGraphic.symbol as SimpleMarkerSymbol).size).toBe(11);
    });

    test("expect onStart and onFinish functions to be called once", async () => {
      const animatedGraphic = AnimatedSymbol.createAnimatedGraphic({
        graphic,
        easingConfig: { type: "easing", options: { easingFunction: "easeInExpo", duration: 1000 } },
        id: "animated-graphic",
        isOverlay: true,
      });

      const mockOnFinish = vitest.fn();
      const mockOnStart = vitest.fn();
      animatedGraphic.symbolAnimation.start({
        to: { scale: 1.1 },
        onFinish: mockOnFinish,
        onStart: mockOnStart,
      });
      await new Promise(r => setTimeout(r, 2000));
      expect((animatedGraphic.symbol as SimpleMarkerSymbol).size).toBe(11);
      expect(mockOnStart).toBeCalledTimes(1);
      expect(mockOnFinish).toBeCalledTimes(1);
    });

    describe("and a new animation is started", () => {
      test("cancel any pending animation and do not call original onfish function", () => {
        const animatedGraphic = AnimatedSymbol.createAnimatedGraphic({
          graphic,
          easingConfig: {
            type: "easing",
            options: { easingFunction: "easeInExpo", duration: 1000 },
          },
          id: "animated-graphic",
          isOverlay: true,
        });
        const mockOnFinish = vitest.fn();
        animatedGraphic.symbolAnimation.start({ to: { scale: 1.1 }, onFinish: mockOnFinish });

        animatedGraphic.symbolAnimation.start({ to: { scale: 0 } });

        expect((animatedGraphic.symbol as SimpleMarkerSymbol).size).toBe(10);
        expect(mockOnFinish).toBeCalledTimes(0);
      });
    });
  });

  describe("resetSymbol", () => {
    let animatedGraphic: IAnimatedGraphic;

    beforeEach(() => {
      animatedGraphic = AnimatedSymbol.createAnimatedGraphic({
        graphic,
        easingConfig: {
          type: "easing",
          options: { easingFunction: "easeInExpo", duration: 1000 },
        },
        id: "animated-graphic",
        isOverlay: true,
      });
    });

    test("stops the current animation and resets the symbol", async () => {
      const mockOnFinish = vitest.fn();
      animatedGraphic.symbolAnimation.start({ to: { scale: 1.1 }, onFinish: mockOnFinish });

      animatedGraphic.symbolAnimation.resetSymbol();
      await new Promise(r => setTimeout(r, 2000));
      expect(animatedGraphic.symbol).toBe(animatedGraphic.symbolAnimation.originalSymbol);
      expect(mockOnFinish).toBeCalledTimes(0);
    });
  });

  describe("Stop Animation", () => {
    let animatedGraphic: IAnimatedGraphic;

    beforeEach(() => {
      animatedGraphic = AnimatedSymbol.createAnimatedGraphic({
        graphic,
        easingConfig: {
          type: "easing",
          options: { easingFunction: "easeInExpo", duration: 1000 },
        },
        id: "animated-graphic",
        isOverlay: true,
      });
    });

    test("stops the current animation", async () => {
      const mockOnFinish = vitest.fn();
      const mockOnStart = vitest.fn();
      animatedGraphic.symbolAnimation.start({
        to: { scale: 1.1 },
        onFinish: mockOnFinish,
        onStart: mockOnStart,
      });

      await new Promise(r => setTimeout(r, 500));
      animatedGraphic.symbolAnimation.stop();
      expect((animatedGraphic.symbol as SimpleMarkerSymbol).size).not.toBe(10);
      expect((animatedGraphic.symbol as SimpleMarkerSymbol).size).not.toBe(11);
      expect(mockOnStart).toBeCalledTimes(1);
      expect(mockOnFinish).toBeCalledTimes(0);
    });
  });
});
