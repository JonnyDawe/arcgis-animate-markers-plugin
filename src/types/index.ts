import { AnimationProps as SpringAnimationProps, EasingFunction } from "@react-spring/web";

import { AnimatedSymbol } from "../AnimatedSymbol";

export type easingTypes =
  | "linear"
  | "easeInCubic"
  | "easeOutCubic"
  | "easeInOutCubic"
  | "easeInExpo"
  | "easeOutExpo"
  | "easeInOutExpo"
  | "easeInOutQuad";

export type AnimatableLayerView =
  | __esri.FeatureLayerView
  | __esri.GeoJSONLayerView
  | __esri.GraphicsLayerView;

export interface IAnimationProps {
  to?: IAnimatableSymbolProps;
  onStep?: onSymbolAnimationStep<AnimatableSymbol>;
  onStart?: () => void;
  onFinish?: () => void;
}
export interface IAnimatableSymbolProps {
  scale?: number;
  rotate?: number;
  opacity?: number;
}

export type onSymbolAnimationStep<T extends AnimatableSymbol> = (
  progress: number,
  currentAnimatingSymbol: SymbolType<T>,
  to: IAnimatableSymbolProps,
  originalSymbol: SymbolType<T>
) => SymbolType<T>;

export type AnimatableSymbol =
  | __esri.SimpleMarkerSymbol
  | __esri.PictureMarkerSymbol
  | __esri.CIMSymbol
  | __esri.Symbol;

type SymbolType<T extends AnimatableSymbol> = T extends __esri.SimpleMarkerSymbol
  ? __esri.SimpleMarkerSymbol
  : T extends __esri.PictureMarkerSymbol
  ? __esri.PictureMarkerSymbol
  : T extends __esri.CIMSymbol
  ? __esri.CIMSymbol
  : __esri.Symbol;

export type AnimationEasingConfig = ISpringEasingConfig | IStandardEasingConfig;

export interface ISpringEasingConfig {
  type: "spring";
  options?: SpringAnimationProps["config"];
}

export interface IStandardEasingConfig {
  type: "easing";
  options?: {
    easingFunction: easingTypes | EasingFunction;
    duration: number;
  };
}

export interface IAnimatedGraphic extends __esri.Graphic {
  symbolAnimation: AnimatedSymbol;
}

export interface IGraphicWithUID extends __esri.Graphic {
  uid: number;
}

export interface IPictureMarkerWithOpacity extends __esri.PictureMarkerSymbol {
  opacity: number;
}

export interface ISimpleMarkerWithOpacity extends __esri.SimpleMarkerSymbol {
  opacity: number;
}
