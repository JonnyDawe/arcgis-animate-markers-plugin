import Color from "@arcgis/core/Color.js";
import Graphic from "@arcgis/core/Graphic";
import * as cimSymbolUtils from "@arcgis/core/symbols/support/cimSymbolUtils.js";
import { EasingFunction, easings, SpringValue } from "@react-spring/web";
import svgToMiniDataURI from "mini-svg-data-uri";

import {
  AnimatableSymbol,
  AnimationEasingConfig,
  easingTypes,
  IAnimatableSymbolProps,
  IAnimatedGraphic,
  IAnimationProps,
  IPictureMarkerWithOpacity,
  ISimpleMarkerWithOpacity,
  onSymbolAnimationStep,
} from "./types";
import { isDefined } from "./types/typeGuards";
import { getImageAsBase64 } from "./utils/encodeimage";

/**
 * Class representing an animated symbol.
 */
export class AnimatedSymbol {
  /**
   * Creates an animated graphic and adds an AnimatedSymbol object to its symbolAnimation property.
   * @param graphic - The graphic to animate.
   * @param easingConfig - The configuration for the animation easing.
   * @param id - The id of the animated symbol.
   * @param isOverlay - Whether the animated symbol is an overlay.
   * @returns The animated graphic.
   */
  public static createAnimatedGraphic({
    graphic,
    easingConfig,
    id,
    isOverlay = false,
    opacity = 1,
  }: {
    graphic: __esri.Graphic;
    easingConfig: AnimationEasingConfig;
    id: string;
    isOverlay?: boolean;
    opacity?: number;
  }): IAnimatedGraphic {
    (graphic as IAnimatedGraphic).symbolAnimation = new AnimatedSymbol({
      graphic,
      easingConfig,
      id,
      isOverlay,
      opacity,
    });
    return graphic as IAnimatedGraphic;
  }

  public id: string;
  public isOverlay: boolean;

  readonly easingConfig: AnimationEasingConfig;
  readonly graphic: Graphic;
  readonly opacity: number;
  readonly originalSymbol: __esri.Symbol;

  /**
   * Constructs an AnimatedSymbol object.
   * @param graphic - The graphic to animate.
   * @param easingConfig - The configuration for the animation easing.
   * @param id - The id of the animated symbol.
   * @param isOverlay - Whether the animated symbol is an overlay.
   */
  constructor({
    graphic,
    easingConfig,
    id,
    isOverlay = false,
    opacity = 1,
  }: {
    graphic: __esri.Graphic;
    easingConfig: AnimationEasingConfig;
    id: string;
    isOverlay?: boolean;
    opacity?: number;
  }) {
    this.easingConfig = easingConfig;
    this.id = id;
    this.isOverlay = isOverlay;
    this.graphic = graphic;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.originalSymbol = (graphic.symbol as any).clone();
    this.opacity = opacity;

    if (opacity !== 1) {
      graphic.symbol = this.setOriginalSymbolWithOpacity(opacity);
    }
  }

  private setOriginalSymbolWithOpacity(opacity: number): __esri.Symbol {
    switch (this.originalSymbol.type) {
      case "simple-marker": {
        // store the opacity of the original simple marker symbol on the symbol
        (this.originalSymbol as ISimpleMarkerWithOpacity).opacity = opacity;

        return updateSimpleMarker(
          1,
          this.originalSymbol as __esri.SimpleMarkerSymbol,
          { opacity },
          this.originalSymbol as __esri.SimpleMarkerSymbol
        );
      }

      case "picture-marker": {
        // store the opacity of the original picture marker symbol on the symbol
        (this.originalSymbol as IPictureMarkerWithOpacity).opacity = opacity;

        return updatePictureMarker(
          1,
          this.originalSymbol as __esri.PictureMarkerSymbol,
          { opacity },
          this.originalSymbol as __esri.PictureMarkerSymbol
        );
      }

      case "cim":
      default:
        return this.originalSymbol;
    }
  }

  private animationStartTimeStamp = 0;

  /**
   * Resets the animation start time stamp to zero.
   */
  private resetAnimationTimeStamp() {
    this.animationStartTimeStamp = 0;
  }

  /**
   * Starts the animation of the symbol.
   * @param animationProps - The animation properties.
   */
  public start(animationProps: IAnimationProps): void {
    this.animateSymbolOnStep(animationProps, animationProps.onStep ?? this.animateMarkerOnStep);
  }

  /**
   * Stops the current animation.
   */
  public stop(): void {
    this.abortCurrentAnimation?.();
  }

  /**
   * Returns the appropriate onSymbolAnimationStep function based on the original symbol's type.
   * @returns The onSymbolAnimationStep function.
   */
  private get animateMarkerOnStep(): onSymbolAnimationStep<__esri.Symbol> {
    switch (this.originalSymbol.type) {
      case "simple-marker": {
        return updateSimpleMarker;
      }

      case "picture-marker": {
        return updatePictureMarker;
      }

      case "cim": {
        return updateCIMSymbolPointMarker;
      }
      default:
        return () => {
          return this.originalSymbol;
        };
    }
  }

  private abortCurrentAnimation: () => void = () => {
    return;
  };

  /**
   * Animates the symbol on each step of the animation.
   * @param animationProps - The animation properties.
   * @param onStep - The onSymbolAnimationStep function to use.
   */
  private animateSymbolOnStep(
    animationProps: IAnimationProps,
    onStep: onSymbolAnimationStep<AnimatableSymbol>
  ) {
    // Clone the starting symbol.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fromSymbol = (this.graphic.symbol as any).clone();

    // initialise the spring value if using spring easing.
    const springEasing =
      this.easingConfig.type === "spring"
        ? new SpringValue(0, { to: 1, config: this.easingConfig.options })
        : null;

    this.stop(); // stop running animations
    animationProps?.onStart?.(); // fire onStart callback
    let abort = false; // set abort flag to false

    const step: FrameRequestCallback = timestamp => {
      if (this.animationStartTimeStamp === 0) {
        this.animationStartTimeStamp = timestamp;
      }
      const elapsed = timestamp - this.animationStartTimeStamp;

      // stop immediately if aborted
      if (abort) {
        this.resetAnimationTimeStamp();
        return;
      }

      // check if animation has reached final frame
      if (this.isAnimationEnded(elapsed, springEasing)) {
        // ensure final symbol state target is reached (progress = 1)
        this.graphic.symbol = onStep(1, fromSymbol, animationProps.to ?? {}, this.originalSymbol);

        this.resetAnimationTimeStamp();
        animationProps?.onFinish?.();
        return;
      }

      // progress aniamtion
      this.graphic.symbol = onStep(
        this.calculateAnimationProgress(elapsed, springEasing),
        fromSymbol,
        animationProps.to ?? {},
        this.originalSymbol
      );

      // request next frame
      window.requestAnimationFrame(step);
    };

    window.requestAnimationFrame(step);
    this.abortCurrentAnimation = () => {
      abort = true;
    };
  }

  public resetSymbol() {
    this.stop();
    this.graphic.symbol = this.originalSymbol;
  }

  private calculateEasingProgress(easing: easingTypes | EasingFunction = "linear", t: number) {
    if (typeof easing === "function") {
      return easing(t);
    } else {
      return easings[easing](t);
    }
  }

  private calculateAnimationProgress(
    elapsed: number,
    springEasing: SpringValue<number> | null
  ): number {
    let animationProgress = 0;
    switch (this.easingConfig.type) {
      case "easing": {
        animationProgress = this.calculateEasingProgress(
          this.easingConfig.options?.easingFunction,
          elapsed / (this.easingConfig.options?.duration ?? 0)
        );

        break;
      }
      case "spring": {
        if (springEasing) {
          springEasing.advance(elapsed);
          animationProgress = springEasing?.get();
          break;
        }
      }
    }
    return animationProgress;
  }

  private isAnimationEnded(elapsed: number, springEasing: SpringValue<number> | null): boolean {
    return (
      (this.easingConfig.type === "easing" &&
        elapsed > (this.easingConfig.options?.duration ?? 0)) ||
      springEasing?.idle === true
    );
  }
}

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
      Math.max(
        0,
        originalSymbolOpacity === 0 ? 0 : originalFillColor.a / originalSymbolOpacity ?? 1
      )
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
