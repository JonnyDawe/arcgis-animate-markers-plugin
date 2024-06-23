import CIMSymbol from "@arcgis/core/symbols/CIMSymbol";
import PictureMarkerSymbol from "@arcgis/core/symbols/PictureMarkerSymbol";
import SimpleMarkerSymbol from "@arcgis/core/symbols/SimpleMarkerSymbol";
import * as cimSymbolUtils from "@arcgis/core/symbols/support/cimSymbolUtils";
import { afterEach, describe, expect, Mock, test, vitest } from "vitest";

import {
  updateCIMSymbolPointMarker,
  updatePictureMarker,
  updateSimpleMarker,
} from "../src/updateMarkers";
import { getImageAsBase64 } from "../src/utils/encodeimage";

describe("update Symbol properties for", () => {
  describe("Picture Marker", () => {
    const pictureMarkerSymbol: __esri.PictureMarkerSymbol = new PictureMarkerSymbol({
      url: "https://example.com/image.jpg",
      width: "64",
      height: "64",
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
    test("is made translucent correctly", async () => {
      vitest.mock("../src/utils/encodeimage");
      const encodeImageSpy = vitest.fn().mockImplementation(() => {
        return "testString";
      });
      (getImageAsBase64 as Mock<any, any>).mockImplementation(() => encodeImageSpy());

      const symb = updatePictureMarker(
        0.5,
        pictureMarkerSymbol,
        { opacity: 0.5 },
        pictureMarkerSymbol
      );

      expect(symb.url).toContain("opacity='0.75'");
      expect(symb.url).toContain("href='testString'");
    });
  });

  describe("Simple Marker", () => {
    const simpleMarkerSymbol: __esri.SimpleMarkerSymbol = new SimpleMarkerSymbol({
      size: 10,
      color: "red",
      outline: {
        color: "red",
        width: 1,
      },
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
    test("is made translucent correctly", () => {
      const symb = updateSimpleMarker(
        0.5,
        simpleMarkerSymbol,
        { opacity: 0.5 },
        simpleMarkerSymbol
      );
      expect(symb.color.a).toBe(0.75);
      expect(symb.outline.color.a).toBe(0.75);
    });
  });

  describe("CIM Marker", () => {
    const CIMMarkerSymbol: __esri.CIMSymbol = new CIMSymbol({
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
