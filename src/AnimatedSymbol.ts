import { Spring } from "wobble";

import {
  AnimatableSymbol,
  AnimationEasingConfig,
  EasingConfig,
  IAnimatedGraphic,
  IAnimationProps,
  IPictureMarkerWithOpacity,
  ISimpleMarkerWithOpacity,
  onSymbolAnimationStep,
  SpringConfig,
} from "./types";
import {
  updateCIMSymbolPointMarker,
  updatePictureMarker,
  updateSimpleMarker,
} from "./updateMarkers";
import easingsFunctions, { EasingFunction, easingTypes } from "./utils/easingsFunctions";

/** To do:
 *
 * - Pull out common utility functions for updating symbols into a seperate file.
 */

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

  readonly id: string;
  readonly isOverlay: boolean;
  readonly easingConfig: AnimationEasingConfig;
  readonly graphic: __esri.Graphic;
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
    if (this.easingConfig.type === "spring") {
      this.animateSymbolWithSpringEasing(
        animationProps,
        this.easingConfig.options,
        animationProps.onStep ?? this.animateMarkerOnStep
      );
    } else {
      this.animateSymbolWithStandardEasing(
        animationProps,
        this.easingConfig.options,
        animationProps.onStep ?? this.animateMarkerOnStep
      );
    }
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
  private animateSymbolWithSpringEasing(
    animationProps: IAnimationProps,
    springConfig: SpringConfig,
    onStep: onSymbolAnimationStep<AnimatableSymbol>
  ) {
    // Clone the starting symbol.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fromSymbol = (this.graphic.symbol as any).clone();

    const springAnimator = new Spring({
      restDisplacementThreshold: 0.01,
      ...springConfig,
      fromValue: 0,
      toValue: 1,
    });

    const cleanup = () => {
      springAnimator.removeAllListeners();
    };

    this.stop(); // stop running animations
    let abort = false; // set abort flag to false

    springAnimator.onStart(() => {
      animationProps?.onStart?.();
    });

    springAnimator.onStop(() => {
      if (!abort) {
        animationProps?.onFinish?.();
        return;
      }
      cleanup();
    });

    springAnimator.onUpdate(spring => {
      // stop immediately if aborted
      if (abort) {
        springAnimator.stop();
        return;
      }

      this.graphic.symbol = onStep(
        spring.currentValue,
        fromSymbol,
        animationProps.to ?? {},
        this.originalSymbol
      );
    });

    this.abortCurrentAnimation = () => {
      abort = true;
    };

    springAnimator.start();
  }

  /**
   * Animates the symbol on each step of the animation.
   * @param animationProps - The animation properties.
   * @param onStep - The onSymbolAnimationStep function to use.
   */
  private animateSymbolWithStandardEasing(
    animationProps: IAnimationProps,
    { duration, easingFunction }: EasingConfig,
    onStep: onSymbolAnimationStep<AnimatableSymbol>
  ) {
    // Clone the starting symbol.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fromSymbol = (this.graphic.symbol as any).clone();

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
      if (elapsed > duration) {
        // ensure final symbol state target is reached (progress = 1)
        this.graphic.symbol = onStep(1, fromSymbol, animationProps.to ?? {}, this.originalSymbol);

        this.resetAnimationTimeStamp();
        animationProps?.onFinish?.();
        return;
      }

      // progress aniamtion
      this.graphic.symbol = onStep(
        this.calculateEasingProgress(easingFunction, elapsed, duration),
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

  private calculateEasingProgress(
    easing: easingTypes | EasingFunction = "linear",
    elapsed: number,
    duration: number
  ) {
    const t = elapsed / duration;
    if (typeof easing === "function") {
      return easing(t);
    } else {
      return easingsFunctions[easing](t);
    }
  }
}
