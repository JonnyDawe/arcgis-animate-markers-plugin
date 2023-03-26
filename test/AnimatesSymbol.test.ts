import Point from "@arcgis/core/geometry/Point";
import Graphic from "@arcgis/core/Graphic";
import CIMSymbol from "@arcgis/core/symbols/CIMSymbol.js";
import PictureMarkerSymbol from "@arcgis/core/symbols/PictureMarkerSymbol.js";
import SimpleMarkerSymbol from "@arcgis/core/symbols/SimpleMarkerSymbol";
import * as cimSymbolUtils from "@arcgis/core/symbols/support/cimSymbolUtils";
import { afterEach, beforeEach, describe, expect, test, vitest } from "vitest";

import {
  AnimatedSymbol,
  updateCIMSymbolPointMarker,
  updatePictureMarker,
  updateSimpleMarker,
} from "../src/AnimatedSymbol";
import { AnimationEasingConfig, IAnimatedGraphic } from "../src/types";

describe("AnimatedSymbol", () => {
  let simpleMarkerSymbol: __esri.SimpleMarkerSymbol;
  let graphic: __esri.Graphic;

  beforeEach(() => {
    simpleMarkerSymbol = new SimpleMarkerSymbol({
      size: 10,
      color: "red",
    });
    graphic = new Graphic({
      geometry: new Point({
        x: 0,
        y: 0,
      }),
      symbol: simpleMarkerSymbol,
    });
  });

  afterEach(() => {
    vitest.resetAllMocks();
  });

  test("can create an animated graphic", () => {
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
  });

  describe("onStart", () => {
    let animatedSymbol: AnimatedSymbol;
    const mockAnimateSymbol = vitest.fn();
    beforeEach(() => {
      animatedSymbol = new AnimatedSymbol({
        graphic,
        easingConfig: { type: "spring" },
        id: "test",
      });
      (animatedSymbol as any).animateSymbolOnStep = mockAnimateSymbol;
    });

    afterEach(() => {
      vitest.resetAllMocks();
    });

    test("should call animateSymbol with animationProps and a correct onStep function", () => {
      animatedSymbol.start({});
      expect(mockAnimateSymbol).toHaveBeenCalledWith(
        {},
        updateSimpleMarker // default onStep function using update simple marker.
      );
    });
    test("should be able to be called with animationProps and acustom onStep function", () => {
      const mockOnStep = vitest.fn();
      animatedSymbol.start({ onStep: mockOnStep });
      expect(mockAnimateSymbol).toHaveBeenCalledWith({ onStep: mockOnStep }, mockOnStep);
    });
  });

  describe("when symbol is animated", () => {
    test("the scale and rotation is correct at end of spring animation", async () => {
      const animatedGraphic = AnimatedSymbol.createAnimatedGraphic({
        graphic,
        easingConfig: { type: "spring" },
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

describe("update Symbol properties for", () => {
  describe("Picture Marker", () => {
    let pictureMarkerSymbol: __esri.PictureMarkerSymbol;
    beforeEach(() => {
      pictureMarkerSymbol = new PictureMarkerSymbol({
        url: "https://static.arcgis.com/images/Symbols/Shapes/BlackStarLargeB.png",
        width: "64",
        height: "64",
      });
    });
    afterEach(() => {
      vitest.resetAllMocks();
    });
    test("is scaled correctly", () => {
      const symb = updatePictureMarker(0.5, pictureMarkerSymbol, { scale: 2 }, pictureMarkerSymbol);
      expect(symb.height).toBe(64 + 64 * 0.5);
    });
    test("is rotated correctly", () => {
      const symb = updatePictureMarker(
        0.5,
        pictureMarkerSymbol,
        { rotate: -30 },
        pictureMarkerSymbol
      );
      expect(symb.angle).toBe(-30 * 0.5);
    });
  });

  describe("Picture Marker", () => {
    let pictureMarkerSymbol: __esri.PictureMarkerSymbol;
    beforeEach(() => {
      pictureMarkerSymbol = new PictureMarkerSymbol({
        url: "https://static.arcgis.com/images/Symbols/Shapes/BlackStarLargeB.png",
        width: "64",
        height: "64",
      });
    });
    afterEach(() => {
      vitest.resetAllMocks();
    });
    test("is scaled correctly", () => {
      const symb = updatePictureMarker(0.5, pictureMarkerSymbol, { scale: 2 }, pictureMarkerSymbol);
      expect(symb.height).toBe(64 + 64 * 0.5);
    });
    test("is rotated correctly", () => {
      const symb = updatePictureMarker(
        0.5,
        pictureMarkerSymbol,
        { rotate: -30 },
        pictureMarkerSymbol
      );
      expect(symb.angle).toBe(-30 * 0.5);
    });
  });

  describe("Simple Marker", () => {
    let simpleMarkerSymbol: __esri.SimpleMarkerSymbol;

    beforeEach(() => {
      simpleMarkerSymbol = new SimpleMarkerSymbol({
        size: 10,
        color: "red",
      });
    });

    afterEach(() => {
      vitest.resetAllMocks();
    });
    test("is scaled correctly", () => {
      const symb = updateSimpleMarker(0.5, simpleMarkerSymbol, { scale: 2 }, simpleMarkerSymbol);
      expect(symb.size).toBe(10 + 10 * 0.5);
    });
    test("is rotated correctly", () => {
      const symb = updateSimpleMarker(0.5, simpleMarkerSymbol, { rotate: -30 }, simpleMarkerSymbol);
      expect(symb.angle).toBe(-30 * 0.5);
    });
  });

  describe("CIM Marker", () => {
    let CIMMarkerSymbol: __esri.CIMSymbol;

    beforeEach(() => {
      CIMMarkerSymbol = new CIMSymbol({
        data: {
          type: "CIMSymbolReference",
          symbol: {
            type: "CIMPointSymbol",
            symbolLayers: [
              {
                type: "CIMVectorMarker",
                enable: true,
                size: 32,
                frame: {
                  xmin: 0,
                  ymin: 0,
                  xmax: 16,
                  ymax: 16,
                },
                markerGraphics: [
                  {
                    type: "CIMMarkerGraphic",
                    geometry: {
                      rings: [
                        [
                          [8, 16],
                          [0, 0],
                          [16, 0],
                          [8, 16],
                        ],
                      ],
                    },
                    symbol: {
                      type: "CIMPolygonSymbol",
                      symbolLayers: [
                        {
                          type: "CIMSolidStroke",
                          width: 5,
                          color: [240, 94, 35, 255],
                        } as any,
                      ],
                    },
                  },
                ],
              },
            ],
          },
        },
      });
    });

    afterEach(() => {
      vitest.resetAllMocks();
    });
    test("is scaled correctly", () => {
      const symb = updateCIMSymbolPointMarker(0.5, CIMMarkerSymbol, { scale: 2 }, CIMMarkerSymbol);
      expect(cimSymbolUtils.getCIMSymbolSize(symb)).toBe(32 + 32 * 0.5);
    });
    test("is rotated correctly", () => {
      const symb = updateCIMSymbolPointMarker(
        0.5,
        CIMMarkerSymbol,
        { rotate: 30 },
        CIMMarkerSymbol
      );
      expect(cimSymbolUtils.getCIMSymbolRotation(symb)).toBe(360 - 30 * 0.5);
    });
  });
});
