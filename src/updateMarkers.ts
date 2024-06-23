import Color from "@arcgis/core/Color";
import * as cimSymbolUtils from "@arcgis/core/symbols/support/cimSymbolUtils";
import svgToMiniDataURI from "mini-svg-data-uri";

import type {
  IAnimatableSymbolProps,
  IPictureMarkerWithOpacity,
  ISimpleMarkerWithOpacity,
  onSymbolAnimationStep,
} from "./types";
import { isDefined } from "./types/typeGuards";
import { getImageAsBase64 } from "./utils/encodeimage";

/** A utility for updating a CIM symbol point marker symbol on each animation step. */
export const updateCIMSymbolPointMarker: onSymbolAnimationStep<__esri.CIMSymbol> = (
  progress: number,
  fromSymbol: __esri.CIMSymbol,
  to: IAnimatableSymbolProps,
  originalSymbol: __esri.CIMSymbol
): __esri.CIMSymbol => {
  const sym = fromSymbol.clone();
  const originalSize = cimSymbolUtils.getCIMSymbolSize(originalSymbol);
  const fromSize = cimSymbolUtils.getCIMSymbolSize(sym);
  const fromAngle = cimSymbolUtils.getCIMSymbolRotation(sym, true) % 360;

  if (isDefined(to.scale)) {
    cimSymbolUtils.scaleCIMSymbolTo(
      sym,
      fromSize + (originalSize * to.scale - fromSize) * progress
    );
  }

  if (isDefined(to.rotate)) {
    cimSymbolUtils.applyCIMSymbolRotation(
      sym,
      fromAngle + (to.rotate - fromAngle) * progress,
      true
    );
  }

  return sym;
};

/** A utility for updating a simple marker symbol on each animation step. */
export const updateSimpleMarker: onSymbolAnimationStep<__esri.SimpleMarkerSymbol> = (
  progress: number,
  fromSymbol: __esri.SimpleMarkerSymbol,
  to: IAnimatableSymbolProps,
  originalSymbol: __esri.SimpleMarkerSymbol
): __esri.SimpleMarkerSymbol => {
  const sym = fromSymbol.clone();
  const { size: originalSize, color: originalFillColor, outline: originalOutline } = originalSymbol;
  const {
    size: fromSize,
    angle: fromAngle,
    color: fromFillColor,
    outline: fromOutline,
  } = fromSymbol;

  if (isDefined(to.scale)) {
    sym.size = fromSize + (originalSize * to.scale - fromSize) * progress;
  }

  if (isDefined(to.rotate)) {
    sym.angle = fromAngle + (to.rotate - fromAngle) * progress;
  }

  if (isDefined(to.opacity)) {
    const originalSymbolOpacity = (originalSymbol as ISimpleMarkerWithOpacity).opacity ?? 1;
    const originalFillOpacity = Math.min(
      1,
      Math.max(0, originalSymbolOpacity === 0 ? 0 : originalFillColor.a / originalSymbolOpacity)
    );
    const fromFillOpacity = fromFillColor.a ?? 1;

    const newFillColourOpacity =
      fromFillOpacity + (originalFillOpacity * to.opacity - fromFillOpacity) * progress;

    sym.color = Color.fromArray([
      fromFillColor.r,
      fromFillColor.g,
      fromFillColor.b,
      newFillColourOpacity,
    ]);

    if (isDefined(originalOutline?.color)) {
      const fromOutlineColor = fromOutline?.color ?? Color.fromArray([0, 0, 0, 1]);
      const fromOutlineOpacity = fromOutline.color.a;
      const originalOutlineOpacity = Math.min(
        1,
        Math.max(0, originalSymbolOpacity === 0 ? 0 : originalOutline.color?.a ?? 1)
      );
      const newOutlineColourOpacity =
        fromOutlineOpacity + (originalOutlineOpacity * to.opacity - fromOutlineOpacity) * progress;

      sym.outline.color = Color.fromArray([
        fromOutlineColor.r,
        fromOutlineColor.g,
        fromOutlineColor.b,
        newOutlineColourOpacity,
      ]);
    }
  }

  return sym;
};

/** A utility for updating a picture symbol point marker symbol on each animation step. */
export const updatePictureMarker: onSymbolAnimationStep<__esri.PictureMarkerSymbol> = (
  progress: number,
  fromSymbol: __esri.PictureMarkerSymbol,
  to: IAnimatableSymbolProps,
  originalSymbol: __esri.PictureMarkerSymbol
): __esri.PictureMarkerSymbol => {
  const sym = fromSymbol.clone();
  const { height: originalHeight, width: originalWidth, url: originalUrl } = originalSymbol;
  const { height: fromHeight, width: fromWidth, angle: fromAngle, url: fromUrl } = fromSymbol;

  if (isDefined(to.scale)) {
    sym.width = fromWidth + (originalWidth * to.scale - fromWidth) * progress;
    sym.height = fromHeight + (originalHeight * to.scale - fromHeight) * progress;
  }

  if (isDefined(to.rotate)) {
    sym.angle = fromAngle + (to.rotate - fromAngle) * progress;
  }

  if (isDefined(to.opacity)) {
    const encodedurl = getImageAsBase64(originalUrl);
    const originalOpacity = (originalSymbol as IPictureMarkerWithOpacity).opacity ?? 1;
    if (encodedurl) {
      const fromOpacity = Number.parseFloat(
        extractAttributeValue(fromUrl, "opacity") ?? originalOpacity.toString()
      );
      const toOpacity = fromOpacity + (to.opacity - fromOpacity) * progress;
      const optimizedSVGDataURI = svgToMiniDataURI(
        `<svg width="${sym.width}" height="${sym.height}" opacity="${toOpacity}" xmlns="http://www.w3.org/2000/svg">
            <image href="${encodedurl}" width="${sym.width}" height="${sym.height}"/>
          </svg>`
      );
      sym.url = optimizedSVGDataURI;
    }
  }

  return sym;
};

function extractAttributeValue(htmlString: string, attribute: string): string | null {
  const regex = new RegExp(`${attribute}\\s*=\\s*["']?([^\\s"']*)["']?`);
  const match = htmlString.match(regex);
  return match ? match[1] : null;
}
