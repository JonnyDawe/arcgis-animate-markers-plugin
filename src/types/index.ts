import { PartialSpringConfig as wobbleSpringConfig } from "wobble";

import { AnimatedSymbol } from "../AnimatedSymbol";
import { EasingFunction, easingTypes } from "../utils/easingsFunctions";

// Basic types and interfaces

/**
 * The types of layers that can be animated.
 */
export type AnimatableLayerView =
  | __esri.FeatureLayerView
  | __esri.GeoJSONLayerView
  | __esri.GraphicsLayerView;

/**
 * The types of symbols that can be animated.
 */
export type AnimatableSymbol =
  | __esri.SimpleMarkerSymbol
  | __esri.PictureMarkerSymbol
  | __esri.CIMSymbol
  | __esri.Symbol;

/**
 * The properties of a symbol that can be animated.
 */
export interface IAnimatableSymbolProps {
  scale?: number;
  rotate?: number;
  opacity?: number;
}

// Animation configuration types and interfaces

export type SpringConfig = Omit<wobbleSpringConfig, "fromValue" | "toValue">;

/**
 * The configuration for a spring easing animation.
 */
export interface ISpringEasingConfig {
  type: "spring";
  options: SpringConfig;
}

/**
 * Easing configuration options.
 */
export interface EasingConfig {
  easingFunction: easingTypes | EasingFunction;
  duration: number;
}

/**
 * The configuration for a standard easing animation.
 */
export interface IStandardEasingConfig {
  type: "easing";
  options: EasingConfig;
}

/**
 * The configuration for an animation, which can be either a spring easing animation or a standard easing animation.
 */
export type AnimationEasingConfig = ISpringEasingConfig | IStandardEasingConfig;

// Callback types

/**
 * A callback function that is called on each step of the symbol animation.
 */
export type onSymbolAnimationStep<T extends AnimatableSymbol> = (
  progress: number,
  currentAnimatingSymbol: SymbolType<T>,
  to: IAnimatableSymbolProps,
  originalSymbol: SymbolType<T>
) => SymbolType<T>;

// Graphic types and interfaces

/**
 * A graphic with an animated symbol.
 */
export interface IAnimatedGraphic extends __esri.Graphic {
  symbolAnimation: AnimatedSymbol;
}

/**
 * A graphic with a unique identifier.
 */
export interface IGraphicWithUID extends __esri.Graphic {
  uid: number;
}

// Symbol types and interfaces

/**
 * A picture marker symbol with an opacity property.
 */
export interface IPictureMarkerWithOpacity extends __esri.PictureMarkerSymbol {
  opacity: number;
}

/**
 * A simple marker symbol with an opacity property.
 */
export interface ISimpleMarkerWithOpacity extends __esri.SimpleMarkerSymbol {
  opacity: number;
}

// Utility types

/**
 * A utility type that maps an animatable symbol to its corresponding symbol type.
 */
type SymbolType<T extends AnimatableSymbol> = T extends __esri.SimpleMarkerSymbol
  ? __esri.SimpleMarkerSymbol
  : T extends __esri.PictureMarkerSymbol
  ? __esri.PictureMarkerSymbol
  : T extends __esri.CIMSymbol
  ? __esri.CIMSymbol
  : __esri.Symbol;

// Animation properties

/**
 * The properties of an animation.
 */
export interface IAnimationProps {
  to: IAnimatableSymbolProps;
  onStart?: () => void;
  onStep?: onSymbolAnimationStep<AnimatableSymbol>;
  onFinish?: () => void;
  removeOnComplete?: boolean;
  yoyo?: boolean;
}
