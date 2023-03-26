import Point from "@arcgis/core/geometry/Point";
import Graphic from "@arcgis/core/Graphic";
import FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
import FeatureEffect from "@arcgis/core/layers/support/FeatureEffect";
import FeatureFilter from "@arcgis/core/layers/support/FeatureFilter";
import SimpleMarkerSymbol from "@arcgis/core/symbols/SimpleMarkerSymbol";
import MapView from "@arcgis/core/views/MapView";
import { config as springConfig } from "@react-spring/web";
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi, vitest } from "vitest";

import { AnimatedSymbol } from "../src/AnimatedSymbol";
import { SymbolAnimationManager } from "../src/AnimationManager";
import { AnimatableLayerView, IAnimatedGraphic } from "../src/types";

describe("SymbolAnimationManager", () => {
  let manager: SymbolAnimationManager;
  let graphicsLayerView: AnimatableLayerView;
  let featureLayerView: __esri.FeatureLayerView;
  let mapView: __esri.MapView;
  let graphic: Graphic;

  beforeAll(() => {
    vi.mock("@arcgis/core/views/MapView", () => {
      return {
        default: vi.fn().mockImplementation(() => {
          return {
            layerViews: {
              findIndex: () => {
                return 1;
              },
            },
            map: {
              add: vitest.fn(),
            },
          };
        }),
      };
    });
    graphicsLayerView = { layer: new GraphicsLayer() } as unknown as __esri.GraphicsLayerView;
    featureLayerView = { layer: new FeatureLayer() } as unknown as __esri.FeatureLayerView;
    featureLayerView.layer.objectIdField = "OBJECTID";
    mapView = new MapView();

    graphic = new Graphic({
      geometry: new Point({
        x: 0,
        y: 0,
      }),
      symbol: new SimpleMarkerSymbol({
        size: 10,
        color: "red",
      }),
    });
  });

  beforeEach(() => {
    const mockgetObjectId = vi.fn().mockImplementation(() => {
      return "999";
    });
    graphic.getObjectId = mockgetObjectId;
  });

  describe("setupAnimatedGraphicsLayer", () => {
    test("animationGraphicsLayer is same as input layer from layerView when the input is a GraphicsLayerView", () => {
      manager = new SymbolAnimationManager({ layerView: graphicsLayerView, mapView });
      expect(manager["animationGraphicsLayer"]).toBe(graphicsLayerView.layer);
      expect(mapView.map.add).toHaveBeenCalledTimes(0);
    });

    test("animationGraphicsLayer is not the same as input layer from layerView when the input is not a GraphicsLayerView", () => {
      manager = new SymbolAnimationManager({ layerView: featureLayerView, mapView });
      expect(manager["animationGraphicsLayer"]).not.toBe(featureLayerView.layer);
      expect(mapView.map.add).toHaveBeenCalledTimes(1);
      expect(mapView.map.add).toHaveBeenCalledWith(expect.anything(), 2);
    });
  });

  describe("makeAnimatableSymbol", () => {
    test("returns an animated Graphic", () => {
      manager = new SymbolAnimationManager({ layerView: graphicsLayerView, mapView });
      const animatedGraphic = manager.makeAnimatableSymbol({ graphic, animationId: "test" });
      expect(animatedGraphic.symbolAnimation).toBeInstanceOf(AnimatedSymbol);
    });

    test("returns an existing animated Graphic if it already exists", () => {
      manager = new SymbolAnimationManager({ layerView: graphicsLayerView, mapView });
      const animatedGraphic = manager.makeAnimatableSymbol({ graphic, animationId: "test" });

      const sameAnimatedGraphic = manager.makeAnimatableSymbol({ graphic, animationId: "test" });
      expect(animatedGraphic).toBe(sameAnimatedGraphic);
    });

    describe("graphicslayer is parent", () => {
      beforeEach(() => {
        graphicsLayerView = { layer: new GraphicsLayer() } as unknown as __esri.GraphicsLayerView;
      });
      test("If it is an overlay adds a graphic to the animationGraphicsLayer", () => {
        manager = new SymbolAnimationManager({ layerView: graphicsLayerView, mapView });
        const animatedGraphic = manager.makeAnimatableSymbol({
          graphic,
          animationId: "test",
          isOverlay: true,
        });
        expect(
          manager.animationGraphicsLayer.graphics.findIndex(graphicInLayer => {
            return graphicInLayer === animatedGraphic;
          })
        ).not.toBe(-1);
      });

      test("If it is not an overlay it does not attempt to add it (as it should be manipulating an existing graphic)", () => {
        manager = new SymbolAnimationManager({ layerView: graphicsLayerView, mapView });
        const animatedGraphic = manager.makeAnimatableSymbol({
          graphic,
          animationId: "test",
        });
        expect(
          manager.animationGraphicsLayer.graphics.findIndex(graphicInLayer => {
            return graphicInLayer === animatedGraphic;
          })
        ).toBe(-1);
      });

      test("does not add the graphic to the exclude feature effect", () => {
        manager = new SymbolAnimationManager({ layerView: graphicsLayerView, mapView });
        manager.makeAnimatableSymbol({ graphic, animationId: "test", isOverlay: true });
        expect(graphic.getObjectId).toBeCalledTimes(0);
      });
    });

    describe("featurelayer is parent", () => {
      beforeEach(() => {
        featureLayerView = { layer: new FeatureLayer() } as unknown as __esri.FeatureLayerView;
        featureLayerView.layer.objectIdField = "OBJECTID";
      });

      test("If it is an overlay adds a graphic to the animationGraphicsLayer", () => {
        manager = new SymbolAnimationManager({ layerView: featureLayerView, mapView });
        const animatedGraphic = manager.makeAnimatableSymbol({
          graphic,
          animationId: "test",
          isOverlay: true,
        });
        expect(
          manager.animationGraphicsLayer.graphics.findIndex(graphicInLayer => {
            return graphicInLayer === animatedGraphic;
          })
        ).not.toBe(-1);
      });

      test("If it is not an overlay adds a graphic to the animationGraphicsLayer", () => {
        manager = new SymbolAnimationManager({ layerView: featureLayerView, mapView });
        const animatedGraphic = manager.makeAnimatableSymbol({
          graphic,
          animationId: "test",
          isOverlay: true,
        });
        expect(
          manager.animationGraphicsLayer.graphics.findIndex(graphicInLayer => {
            return graphicInLayer === animatedGraphic;
          })
        ).not.toBe(-1);
      });

      test("adds the graphic to the exclude feature effect if it is not an overlay and the parent layer is a featurelayer.", () => {
        manager = new SymbolAnimationManager({ layerView: featureLayerView, mapView });
        manager.makeAnimatableSymbol({ graphic, animationId: "test" });

        expect(featureLayerView.featureEffect.filter.where).toBe("OBJECTID IN ( 999 )");
      });

      test("does not add the graphic to the exclude feature effect if it is an overlay and the parent layer is a featurelayer.", () => {
        manager = new SymbolAnimationManager({ layerView: featureLayerView, mapView });
        manager.makeAnimatableSymbol({ graphic, animationId: "test", isOverlay: true });
        expect(graphic.getObjectId).toBeCalledTimes(0);
        expect(featureLayerView.featureEffect.filter.where).toBe("1<>1");
      });
    });
  });

  describe("hasAnimatedGraphic", () => {
    test("returns false when no animationId or graphic provided", () => {
      manager = new SymbolAnimationManager({ layerView: graphicsLayerView, mapView });
      expect(manager.hasAnimatedGraphic({})).toBe(false);
    });

    test("returns false when no matching graphic exists", () => {
      manager = new SymbolAnimationManager({ layerView: graphicsLayerView, mapView });
      const fakeGraphic = new Graphic();
      expect(manager.hasAnimatedGraphic({ graphic: fakeGraphic })).toBe(false);
    });

    test("returns true when a matching graphic exists", () => {
      manager = new SymbolAnimationManager({ layerView: graphicsLayerView, mapView });
      manager.makeAnimatableSymbol({ graphic, animationId: "test" });
      expect(manager.hasAnimatedGraphic({ animationId: "test" })).toBe(true);
      expect(manager.hasAnimatedGraphic({ graphic })).toBe(true);
    });
  });

  describe("getAnimatedGraphic", () => {
    test("returns undefined if no graphic exists", () => {
      manager = new SymbolAnimationManager({ layerView: graphicsLayerView, mapView });
      expect(manager.getAnimatedGraphic({ animationId: "dummy" })).toBe(undefined);
    });

    test("returns the graphic when a matching graphic exists", () => {
      manager = new SymbolAnimationManager({ layerView: graphicsLayerView, mapView });
      const animatedGraphic = manager.makeAnimatableSymbol({ graphic, animationId: "test" });
      const getGraphic = manager.getAnimatedGraphic({ animationId: "test" });
      expect(animatedGraphic).toBe(getGraphic);
    });
  });

  describe("getAllAnimatedGraphics", () => {
    test("returns an empty array if no graphic exists", () => {
      manager = new SymbolAnimationManager({ layerView: graphicsLayerView, mapView });
      const getGraphicArray = manager.getAllAnimatedGraphics();
      expect(getGraphicArray).toBeInstanceOf(Array);
      expect(getGraphicArray.length).toBe(0);
    });

    test("returns all the graphics in an array", () => {
      manager = new SymbolAnimationManager({ layerView: graphicsLayerView, mapView });

      manager.makeAnimatableSymbol({ graphic, animationId: "test" });
      manager.makeAnimatableSymbol({
        graphic: graphic.clone(),
        animationId: "anotherTest",
      });
      const getGraphicArray = manager.getAllAnimatedGraphics();
      expect(getGraphicArray).toBeInstanceOf(Array);
      expect(getGraphicArray.length).toBe(2);
    });
  });

  describe("removeAnimatedGraphic", () => {
    beforeEach(() => {
      const mockgetObjectId = vi.fn().mockImplementation(() => {
        return "999";
      });
      graphic.getObjectId = mockgetObjectId;
    });

    test("does not remove unmatched Graphics", () => {
      manager = new SymbolAnimationManager({ layerView: graphicsLayerView, mapView });
      manager.makeAnimatableSymbol({ graphic, animationId: "test" });
      manager.removeAnimatedGraphic({ animationId: "anotherId" });
      expect(manager.getAllAnimatedGraphics().length).toBe(1);
    });

    test("returns an existing animated Graphic if it already exists", () => {
      manager = new SymbolAnimationManager({ layerView: graphicsLayerView, mapView });
      const animatedGraphic = manager.makeAnimatableSymbol({ graphic, animationId: "test" });

      const sameAnimatedGraphic = manager.makeAnimatableSymbol({ graphic, animationId: "test" });
      expect(animatedGraphic).toBe(sameAnimatedGraphic);
    });

    test("adds the graphic to the exclude feature effect if it is not an overlay and the parent layer is a featurelayer.", () => {
      manager = new SymbolAnimationManager({ layerView: featureLayerView, mapView });
      manager.makeAnimatableSymbol({ graphic, animationId: "test" });

      expect(featureLayerView.featureEffect.filter.where).toBe("OBJECTID IN ( 999 )");
    });

    test("does not add the graphic to the exclude feature effect if it is an overlay and the parent layer is a featurelayer.", () => {
      manager = new SymbolAnimationManager({ layerView: featureLayerView, mapView });
      manager.makeAnimatableSymbol({ graphic, animationId: "test", isOverlay: true });
      expect(graphic.getObjectId).toBeCalledTimes(0);
      expect(featureLayerView.featureEffect.filter.where).toBe("1<>1");
    });
  });
});
