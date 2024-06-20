import { Spring } from "wobble";

import { SymbolAnimationManager } from "./AnimationManager";
import {
  AnimatableSymbol,
  AnimationEasingConfig,
  EasingConfig,
  IAnimatableSymbolProps,
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
    animationManager,
  }: {
    graphic: __esri.Graphic;
    easingConfig: AnimationEasingConfig;
    id: string;
    isOverlay?: boolean;
    opacity?: number;
    animationManager?: SymbolAnimationManager;
  }): IAnimatedGraphic {
    (graphic as IAnimatedGraphic).symbolAnimation = new AnimatedSymbol({
      graphic,
      easingConfig,
      id,
      isOverlay,
      opacity,
      animationManager,
    });
    return graphic as IAnimatedGraphic;
  }

  readonly id: string;
  readonly isOverlay: boolean;
  readonly easingConfig: AnimationEasingConfig;
  readonly graphic: __esri.Graphic;
  readonly opacity: number;
  readonly originalSymbol: __esri.Symbol;
  readonly animationManager?: SymbolAnimationManager;

  private _isAnimating = false;
  public get isAnimating(): boolean {
    return this._isAnimating;
  }

  private abortCurrentAnimation: () => void = () => {
    return;
  };

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
    animationManager,
  }: {
    graphic: __esri.Graphic;
    easingConfig: AnimationEasingConfig;
    id: string;
    isOverlay?: boolean;
    opacity?: number;
    animationManager?: SymbolAnimationManager;
  }) {
    this.easingConfig = easingConfig;
    this.id = id;
    this.isOverlay = isOverlay;
    this.graphic = graphic;
    this.originalSymbol = this.cloneSymbol(graphic.symbol);
    this.opacity = opacity;
    this.animationManager = animationManager;

    graphic.symbol = this.applyOpacityToSymbol(opacity);
  }

  private cloneSymbol(symbol: __esri.Symbol): __esri.Symbol {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (symbol as any).clone();
  }

  private applyOpacityToSymbol(opacity: number): __esri.Symbol {
    switch (this.originalSymbol.type) {
      case "simple-marker":
        (this.originalSymbol as ISimpleMarkerWithOpacity).opacity = opacity;
        if (opacity === 1) {
          return this.originalSymbol;
        }

        return updateSimpleMarker(
          1,
          this.originalSymbol as __esri.SimpleMarkerSymbol,
          { opacity },
          this.originalSymbol as __esri.SimpleMarkerSymbol
        );

      case "picture-marker":
        (this.originalSymbol as IPictureMarkerWithOpacity).opacity = opacity;

        if (opacity === 1) {
          return this.originalSymbol;
        }

        return updatePictureMarker(
          1,
          this.originalSymbol as __esri.PictureMarkerSymbol,
          { opacity },
          this.originalSymbol as __esri.PictureMarkerSymbol
        );
      default:
        return this.originalSymbol;
    }
  }

  public start(animationProps: IAnimationProps): void {
    this.stop();
    this._isAnimating = true;
    const onStep = animationProps.onStep ?? this.getAnimationStepFunction();

    if (this.easingConfig.type === "spring") {
      this.animateWithSpring(animationProps, this.easingConfig.options, onStep);
    } else {
      this.animateWithEasing(animationProps, this.easingConfig.options, onStep);
    }
  }

  public stop(): void {
    this._isAnimating = false;
    this.abortCurrentAnimation();
  }
  /**
   * Returns the appropriate onSymbolAnimationStep function based on the original symbol's type.
   * @returns The onSymbolAnimationStep function.
   */
  private getAnimationStepFunction(): onSymbolAnimationStep<__esri.Symbol> {
    switch (this.originalSymbol.type) {
      case "simple-marker":
        return updateSimpleMarker;
      case "picture-marker":
        return updatePictureMarker;
      case "cim":
        return updateCIMSymbolPointMarker;
      default:
        return () => this.originalSymbol;
    }
  }

  private animateWithSpring(
    animationProps: IAnimationProps,
    springConfig: SpringConfig,
    onStep: onSymbolAnimationStep<AnimatableSymbol>
  ) {
    // Clone the starting symbol.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fromSymbol = this.cloneSymbol(this.graphic.symbol);
    const springAnimator = new Spring({
      restDisplacementThreshold: 0.01,
      ...springConfig,
      fromValue: 0,
      toValue: 1,
    });

    this.setUpSpringAnimator(springAnimator, animationProps, onStep, fromSymbol);
    springAnimator.start();
  }

  private setUpSpringAnimator(
    springAnimator: Spring,
    animationProps: IAnimationProps,
    onStep: onSymbolAnimationStep<AnimatableSymbol>,
    fromSymbol: __esri.Symbol
  ) {
    let abort = false;
    springAnimator.onStart(() => animationProps.onStart?.());
    springAnimator.onUpdate(spring =>
      this.updateSymbol(onStep, spring.currentValue, fromSymbol, animationProps.to)
    );
    springAnimator.onStop(() => {
      this.handleAnimationComplete(animationProps, abort);
    });

    this.abortCurrentAnimation = () => {
      abort = true;
      springAnimator.stop();
    };
  }

  private handleAnimationComplete(animationProps: IAnimationProps, aborted = false) {
    if (!aborted) {
      animationProps?.onFinish?.();
      this._isAnimating = false;
      if (animationProps.removeOnComplete) {
        this.removeGraphic();
      }
    } else if (animationProps.yoyo) {
      this.startYoYoAnimation(animationProps);
    }
  }

  private removeGraphic() {
    if (this.animationManager) {
      this.animationManager.removeAnimatedGraphic({ graphic: this.graphic, animationId: this.id });
    } else {
      this.graphic.destroy();
    }
  }

  private updateSymbol(
    onStep: onSymbolAnimationStep<AnimatableSymbol>,
    progress: number,
    fromSymbol: __esri.Symbol,
    toSymbol: IAnimatableSymbolProps
  ) {
    this.graphic.symbol = onStep(progress, fromSymbol, toSymbol ?? {}, this.originalSymbol);
  }

  private animateWithEasing(
    animationProps: IAnimationProps,
    { duration, easingFunction }: EasingConfig,
    onStep: onSymbolAnimationStep<AnimatableSymbol>
  ) {
    const fromSymbol = this.cloneSymbol(this.graphic.symbol);

    this.animationLoop(animationProps, duration, easingFunction, onStep, fromSymbol);
  }

  private animationLoop(
    animationProps: IAnimationProps,
    duration: number,
    easingFunction: easingTypes | EasingFunction,
    onStep: onSymbolAnimationStep<AnimatableSymbol>,
    fromSymbol: __esri.Symbol
  ) {
    let startTimeStamp: number | null = null;
    let abort = false;
    animationProps.onStart?.();

    const step: FrameRequestCallback = timestamp => {
      if (!startTimeStamp) startTimeStamp = timestamp;

      const elapsed = timestamp - startTimeStamp;
      if (abort || elapsed >= duration) {
        this.finalizeAnimation(onStep, fromSymbol, abort, animationProps);
        return;
      }

      this.updateSymbol(
        onStep,
        this.calculateProgress(easingFunction, elapsed, duration),
        fromSymbol,
        animationProps.to
      );
      window.requestAnimationFrame(step);
    };

    window.requestAnimationFrame(step);
    this.abortCurrentAnimation = () => {
      abort = true;
    };
  }

  private finalizeAnimation(
    onStep: onSymbolAnimationStep<AnimatableSymbol>,
    fromSymbol: __esri.Symbol,
    abort: boolean,
    animationProps: IAnimationProps
  ) {
    this.handleAnimationComplete(animationProps, abort);
    if (!abort) {
      this.updateSymbol(onStep, 1, fromSymbol, animationProps.to);
    }
  }

  // track whether the animation is heading out or back in for the YoYo effect
  private isHeadingOut = false;
  private startYoYoAnimation(animationProps: IAnimationProps) {
    const to = this.isHeadingOut ? animationProps.to : { scale: 1, rotate: 0, opacity: 1 };
    this.isHeadingOut = !this.isHeadingOut;

    this.start({
      ...animationProps,
      to,
    });
  }

  private calculateProgress(
    easing: easingTypes | EasingFunction,
    elapsed: number,
    duration: number
  ): number {
    const t = elapsed / duration;
    return typeof easing === "function" ? easing(t) : easingsFunctions[easing](t);
  }

  public resetSymbol() {
    this.stop();
    this.graphic.symbol = this.originalSymbol;
  }
}
