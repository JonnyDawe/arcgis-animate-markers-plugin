import Point from "@arcgis/core/geometry/Point";
import Graphic from "@arcgis/core/Graphic";
import PictureMarkerSymbol from "@arcgis/core/symbols/PictureMarkerSymbol";
import SimpleMarkerSymbol from "@arcgis/core/symbols/SimpleMarkerSymbol";
import { afterEach, beforeEach, describe, expect, Mock, test, vitest } from "vitest";
import { Spring } from "wobble";

import { AnimatedSymbol } from "../src/AnimatedSymbol";
import {
  AnimationEasingConfig,
  IAnimatedGraphic,
  IPictureMarkerWithOpacity,
  ISimpleMarkerWithOpacity,
} from "../src/types";
import * as updateMarkers from "../src/updateMarkers";
import { getImageAsBase64 } from "../src/utils/encodeimage";

vitest.mock("../src/utils/encodeimage");
vitest.useFakeTimers({
  toFake: [
    // vitests defaults
    "setTimeout",
    "clearTimeout",
    "setInterval",
    "clearInterval",
    "setImmediate",
    "clearImmediate",
    "Date",
    // required for mocks
    "performance",
    "requestAnimationFrame",
    "cancelAnimationFrame",
  ],
});

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

  test("should create a simple marker animated graphic with default opacity", () => {
    const easingConfig: AnimationEasingConfig = {
      type: "easing",
      options: { duration: 1000, easingFunction: "linear" },
    };
    const animatedGraphic = AnimatedSymbol.createAnimatedGraphic({
      graphic,
      easingConfig,
      id: "animated-graphic",
      isOverlay: true,
    });

    expect(animatedGraphic.symbolAnimation).toBeInstanceOf(AnimatedSymbol);
    expect(animatedGraphic.symbolAnimation.id).toBe("animated-graphic");
    expect(animatedGraphic.symbolAnimation.isOverlay).toBe(true);
    expect(animatedGraphic.symbolAnimation.easingConfig).toBe(easingConfig);
    expect(animatedGraphic.symbolAnimation.graphic).toBe(graphic);
    expect(animatedGraphic.symbolAnimation.graphic.symbol.type).toBe(simpleMarkerSymbol.type);
    expect(
      (animatedGraphic.symbolAnimation.originalSymbol as ISimpleMarkerWithOpacity).opacity
    ).toBe(1);
    expect(animatedGraphic.symbolAnimation.graphic.symbol.color.a).toBe(1);
  });

  test("can create a standard simple marker animated graphic with specified opacity", () => {
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

    (getImageAsBase64 as Mock).mockReturnValue("testString");

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

  describe("AnimatedSymbol start method", () => {
    let animatedSymbol: AnimatedSymbol;
    let graphic: __esri.Graphic;

    const createGraphic = () => {
      return new Graphic({
        geometry: new Point({ x: 0, y: 0 }),
        symbol: new SimpleMarkerSymbol({
          size: 10,
          color: "red",
        }),
      });
    };

    beforeEach(() => {
      graphic = createGraphic();
      animatedSymbol = new AnimatedSymbol({
        graphic,
        easingConfig: { type: "spring", options: {} },
        id: "test",
      });
    });

    afterEach(() => {
      vitest.restoreAllMocks();
    });

    test("should set isAnimating to true when start is called", () => {
      const stopSpy = vitest.spyOn(animatedSymbol, "stop");
      const springSpy = vitest.spyOn(Spring.prototype, "start");
      animatedSymbol.start({ to: { scale: 1.5 } });

      // any existing animation should be stopped before starting a new one
      expect(stopSpy).toHaveBeenCalled();

      // animation should be running
      expect(animatedSymbol.isAnimating).toBe(true);

      // spring should be started
      expect(springSpy).toHaveBeenCalled();
    });

    test("should update symbol properties when start is called", () => {
      const updateSimpleMarkerSpy = vitest.spyOn(updateMarkers, "updateSimpleMarker");
      const initialSize = (graphic.symbol as __esri.SimpleMarkerSymbol).size;
      animatedSymbol.start({ to: { scale: 1.5 } });
      // Simulate progression of the animation
      vitest.advanceTimersByTime(1000);
      expect(updateSimpleMarkerSpy).toHaveBeenCalled();
      expect((graphic.symbol as __esri.SimpleMarkerSymbol).size).toBeGreaterThan(initialSize);
    });

    test("should call onStart callback if provided", () => {
      const mockOnStart = vitest.fn();
      animatedSymbol.start({
        to: { scale: 1.5 },
        onStart: mockOnStart,
      });
      expect(mockOnStart).toHaveBeenCalled();
    });

    test("should call onFinish callback if provided", async () => {
      const mockOnFinish = vitest.fn();
      animatedSymbol.start({
        to: { scale: 1.5 },
        onFinish: mockOnFinish,
      });

      vitest.advanceTimersByTime(10000);
      expect(mockOnFinish).toHaveBeenCalled();
      expect(animatedSymbol.isAnimating).toBe(false);
    });

    test("should not call onFinish callback if animation stopped mid-flow", async () => {
      const mockOnFinish = vitest.fn();
      animatedSymbol.start({
        to: { scale: 1.5 },
        onFinish: mockOnFinish,
      });
      vitest.advanceTimersByTime(50);
      animatedSymbol.stop();
      expect(mockOnFinish).not.toHaveBeenCalled();
      expect(animatedSymbol.isAnimating).toBe(false);
    });

    test("should reset symbol after animation completes", async () => {
      animatedSymbol.start({ to: { scale: 2 } });
      vitest.advanceTimersByTime(1000);
      animatedSymbol.resetSymbol();
      expect(graphic.symbol).toEqual(animatedSymbol.originalSymbol);
    });

    test("should call custom onstep function if provided", () => {
      const mockOnStep = vitest.fn();
      animatedSymbol.start({ onStep: mockOnStep, to: { scale: 1 } });
      vitest.advanceTimersByTime(1000);
      expect(mockOnStep).toHaveBeenCalled();
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
      vitest.advanceTimersByTime(2000);
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
      animatedGraphic.symbolAnimation.start({ to: { scale: 1.1, rotate: -30 } });

      vitest.advanceTimersByTime(2000);

      expect((animatedGraphic.symbol as SimpleMarkerSymbol).size).toBe(11);
      expect((animatedGraphic.symbol as SimpleMarkerSymbol).angle).toBe(-30);
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
      vitest.advanceTimersByTime(2000);
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
        vitest.advanceTimersByTime(500);
        animatedGraphic.symbolAnimation.start({ to: { scale: 1 } });
        vitest.advanceTimersByTime(2000);
        expect(mockOnFinish).toBeCalledTimes(0);
        expect((animatedGraphic.symbol as SimpleMarkerSymbol).size).toBe(10);
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
      vitest.advanceTimersByTime(2000);
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

      vitest.advanceTimersByTime(500);
      animatedGraphic.symbolAnimation.stop();
      expect((animatedGraphic.symbol as SimpleMarkerSymbol).size).not.toBe(10);
      expect((animatedGraphic.symbol as SimpleMarkerSymbol).size).not.toBe(11);
      expect(mockOnStart).toBeCalledTimes(1);
      expect(mockOnFinish).toBeCalledTimes(0);
    });
  });
});
