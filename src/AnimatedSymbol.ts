import Graphic from "@arcgis/core/Graphic";
import * as cimSymbolUtils from "@arcgis/core/symbols/support/cimSymbolUtils.js";
import { EasingFunction, easings, SpringValue } from "@react-spring/web";

import {
  AnimatableSymbol,
  AnimationEasingConfig,
  easingTypes,
  IAnimatableSymbolProps,
  IAnimatedGraphic,
  IAnimationProps,
  onSymbolAnimationStep,
} from "./types";

export class AnimatedSymbol {
  public static createAnimatedGraphic({
    graphic,
    easingConfig,
    id,
    isOverlay = false,
  }: {
    graphic: __esri.Graphic;
    easingConfig: AnimationEasingConfig;
    id: string;
    isOverlay?: boolean;
  }): IAnimatedGraphic {
    (graphic as IAnimatedGraphic).symbolAnimation = new AnimatedSymbol({
      graphic,
      easingConfig,
      id,
      isOverlay,
    });
    return graphic as IAnimatedGraphic;
  }

  public id: string;
  public isOverlay: boolean;

  readonly easingConfig: AnimationEasingConfig;
  readonly graphic: Graphic;
  readonly originalSymbol: __esri.Symbol;

  constructor({
    graphic,
    easingConfig,
    id,
    isOverlay = false,
  }: {
    graphic: __esri.Graphic;
    easingConfig: AnimationEasingConfig;
    id: string;
    isOverlay?: boolean;
  }) {
    this.graphic = graphic;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.originalSymbol = (graphic.symbol as any).clone();

    this.easingConfig = easingConfig;
    this.id = id;
    this.isOverlay = isOverlay;
  }

  private animationStartTimeStamp = 0;
  private resetAnimationTimeStamp() {
    this.animationStartTimeStamp = 0;
  }

  public start(animationProps: IAnimationProps): void {
    this.animateSymbolOnStep(animationProps, animationProps.onStep ?? this.animateMarkerOnStep);
  }

  public stop(): void {
    this.abortCurrentAnimation?.();
  }

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

  private animateSymbolOnStep(
    animationProps: IAnimationProps,
    onStep: onSymbolAnimationStep<AnimatableSymbol>
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fromSymbol = (this.graphic.symbol as any).clone();

    const springEasing =
      this.easingConfig.type === "spring"
        ? new SpringValue(0, { to: 1, config: this.easingConfig.options })
        : null;

    this.stop();
    animationProps?.onStart?.();
    let abort = false;

    const step: FrameRequestCallback = timestamp => {
      if (this.animationStartTimeStamp === 0) {
        this.animationStartTimeStamp = timestamp;
      }
      const elapsed = timestamp - this.animationStartTimeStamp;

      if (abort) {
        this.resetAnimationTimeStamp();
        return;
      }

      if (
        (this.easingConfig.type === "easing" &&
          elapsed > (this.easingConfig.options?.duration ?? 0)) ||
        springEasing?.idle === true
      ) {
        this.graphic.symbol = onStep(1, fromSymbol, animationProps.to ?? {}, this.originalSymbol);
        this.resetAnimationTimeStamp();
        animationProps?.onFinish?.();
        return;
      }

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

      this.graphic.symbol = onStep(
        animationProgress,
        fromSymbol,
        animationProps.to ?? {},
        this.originalSymbol
      );
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
}

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

  if (to.scale) {
    cimSymbolUtils.scaleCIMSymbolTo(
      sym,
      fromSize + (originalSize * to.scale - fromSize) * progress
    );
  }

  if (to.rotate != undefined && !isNaN(to.rotate)) {
    cimSymbolUtils.applyCIMSymbolRotation(
      sym,
      fromAngle + (to.rotate - fromAngle) * progress,
      true
    );
  }

  return sym;
};

export const updateSimpleMarker: onSymbolAnimationStep<__esri.SimpleMarkerSymbol> = (
  progress: number,
  fromSymbol: __esri.SimpleMarkerSymbol,
  to: IAnimatableSymbolProps,
  originalSymbol: __esri.SimpleMarkerSymbol
): __esri.SimpleMarkerSymbol => {
  const sym = fromSymbol.clone();
  const { size: originalSize } = originalSymbol;
  const { size: fromSize, angle: fromAngle } = fromSymbol;

  if (to.scale) {
    sym.size = fromSize + (originalSize * to.scale - fromSize) * progress;
  }

  if (to.rotate != undefined && !isNaN(to.rotate)) {
    sym.angle = fromAngle + (to.rotate - fromAngle) * progress;
  }

  return sym;
};

export const updatePictureMarker: onSymbolAnimationStep<__esri.PictureMarkerSymbol> = (
  progress: number,
  fromSymbol: __esri.PictureMarkerSymbol,
  to: IAnimatableSymbolProps,
  originalSymbol: __esri.PictureMarkerSymbol
): __esri.PictureMarkerSymbol => {
  const sym = fromSymbol.clone();
  const { height: originalHeight, width: originalWidth } = originalSymbol;
  const { height: fromHeight, width: fromWidth, angle: fromAngle } = fromSymbol;

  if (to.scale) {
    sym.width = fromWidth + (originalWidth * to.scale - fromWidth) * progress;
    sym.height = fromHeight + (originalHeight * to.scale - fromHeight) * progress;
  }

  if (to.rotate != undefined && !isNaN(to.rotate)) {
    sym.angle = fromAngle + (to.rotate - fromAngle) * progress;
  }

  return sym;
};
