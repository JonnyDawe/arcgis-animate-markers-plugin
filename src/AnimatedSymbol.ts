import Graphic from "@arcgis/core/Graphic";
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
import { isCIMPictureMarkerLayer, isCIMVectorMarkerLayer } from "./types/typeGuards";

export class AnimatedSymbol {
  public static createAnimatedGraphic({
    graphic,
    easingConfig,
    id,
  }: {
    graphic: __esri.Graphic;
    easingConfig: AnimationEasingConfig;
    id: string;
  }): IAnimatedGraphic {
    (graphic as IAnimatedGraphic).symbolAnimation = new AnimatedSymbol({
      graphic,
      easingConfig,
      id,
    });
    return graphic as IAnimatedGraphic;
  }

  public id: string;
  private easingConfig: AnimationEasingConfig;
  private graphic: Graphic;
  private originalSymbol: __esri.Symbol;

  constructor({
    graphic,
    easingConfig,
    id,
  }: {
    graphic: __esri.Graphic;
    easingConfig: AnimationEasingConfig;
    id: string;
  }) {
    this.graphic = graphic;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.originalSymbol = (graphic.symbol as any).clone();

    this.easingConfig = easingConfig;
    this.id = id;
  }

  private animationStartTimeStamp = 0;
  private resetAnimationTimeStamp() {
    this.animationStartTimeStamp = 0;
  }

  public start(animationProps: IAnimationProps) {
    this.animateSymbol(animationProps, animationProps.onStep ?? this.animateMarker);
  }

  private get animateMarker(): onSymbolAnimationStep<__esri.Symbol> {
    switch (this.originalSymbol.type) {
      case "simple-marker": {
        return this.updateSimpleMarker;
      }

      case "picture-marker": {
        return this.updatePictureMarker;
      }

      case "cim": {
        return this.updateCIMSymbolPointMarker;
      }
      default:
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        return (_progress: number, _fromSymbol: __esri.Symbol, _to: IAnimatableSymbolProps) => {
          return this.originalSymbol;
        };
    }
  }

  private abortCurrentAnimation: () => void = () => {
    return;
  };

  public animateSymbol(
    animationProps: IAnimationProps,
    onStep: onSymbolAnimationStep<AnimatableSymbol>
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fromSymbol = (this.graphic.symbol as any).clone();

    const springEasing =
      this.easingConfig.type === "spring"
        ? new SpringValue(0, { to: 1, config: this.easingConfig.options })
        : null;

    this.abortCurrentAnimation?.();
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

      this.graphic.symbol = onStep(animationProgress, fromSymbol, animationProps.to ?? {});
      window.requestAnimationFrame(step);
    };

    window.requestAnimationFrame(step);
    this.abortCurrentAnimation = () => {
      abort = true;
    };
  }

  private updateSimpleMarker: onSymbolAnimationStep<__esri.SimpleMarkerSymbol> = (
    progress: number,
    fromSymbol: __esri.SimpleMarkerSymbol,
    to: IAnimatableSymbolProps
  ): __esri.SimpleMarkerSymbol => {
    const sym = fromSymbol.clone();
    const { size: originalSize, angle: originalAngle } = this
      .originalSymbol as __esri.SimpleMarkerSymbol;
    const { size: fromSize, angle: fromAngle } = fromSymbol;

    if (to.scale) {
      sym.size = fromSize + (originalSize * to.scale - fromSize) * progress;
    }

    if (to.rotate != undefined && !isNaN(to.rotate)) {
      sym.angle = fromAngle + (originalAngle + to.rotate - fromAngle) * progress;
    }

    return sym;
  };

  private updatePictureMarker: onSymbolAnimationStep<__esri.PictureMarkerSymbol> = (
    progress: number,
    fromSymbol: __esri.PictureMarkerSymbol,
    to: IAnimatableSymbolProps
  ): __esri.PictureMarkerSymbol => {
    const sym = fromSymbol.clone();
    const {
      height: originalHeight,
      width: originalWidth,
      angle: originalAngle,
    } = this.originalSymbol as __esri.PictureMarkerSymbol;
    const { height: fromHeight, width: fromWidth, angle: fromAngle } = fromSymbol;

    if (to.scale) {
      sym.width = fromWidth + (originalWidth * to.scale - fromWidth) * progress;
      sym.height = fromHeight + (originalHeight * to.scale - fromHeight) * progress;
    }

    if (to.rotate != undefined && !isNaN(to.rotate)) {
      sym.angle = fromAngle + (originalAngle + to.rotate - fromAngle) * progress;
      console.log(sym.angle);
    }

    return sym;
  };
  private updateCIMSymbolPointMarker: onSymbolAnimationStep<__esri.CIMSymbol> = (
    progress: number,
    fromSymbol: __esri.CIMSymbol,
    to: IAnimatableSymbolProps
  ): __esri.CIMSymbol => {
    const newSymbol = fromSymbol.clone();

    for (const [index, symbolLayer] of newSymbol.data.symbol.symbolLayers.entries()) {
      if (isCIMVectorMarkerLayer(symbolLayer) || isCIMPictureMarkerLayer(symbolLayer)) {
        const originalSymbolLayer = (this.originalSymbol as __esri.CIMSymbol).data.symbol
          .symbolLayers[index] as __esri.CIMVectorMarker;

        if (to.scale) {
          symbolLayer.size =
            symbolLayer.size + (originalSymbolLayer.size * to.scale - symbolLayer.size) * progress;
        }
        if (to.rotate != undefined && !isNaN(to.rotate)) {
          const { rotation: fromAngle = 0 } = symbolLayer;
          symbolLayer.rotation =
            fromAngle + ((originalSymbolLayer.rotation ?? 0) + -to.rotate - fromAngle) * progress;
          console.log(symbolLayer.rotation);
        }
      }
    }

    return newSymbol;
  };

  public resetSymbol() {
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
