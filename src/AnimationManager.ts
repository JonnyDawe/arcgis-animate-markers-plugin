import Graphic from "@arcgis/core/Graphic";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer.js";
import FeatureEffect from "@arcgis/core/layers/support/FeatureEffect.js";
import FeatureFilter from "@arcgis/core/layers/support/FeatureFilter.js";
import FeatureLayerView from "@arcgis/core/views/layers/FeatureLayerView";
import { AnimationProps, EasingFunction, easings, SpringValue } from "@react-spring/web";

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
}

export type onSymbolAnimationStep<T extends AnimatableSymbol> = (
  progress: number,
  fromSymbol: SymbolType<T>,
  to: IAnimatableSymbolProps
) => SymbolType<T>;

type AnimatableSymbol =
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
  options?: AnimationProps["config"];
}

export interface IStandardEasingConfig {
  type: "easing";
  options?: {
    easingFunction: easingTypes | EasingFunction;
    duration: number;
  };
}

type easingTypes =
  | "linear"
  | "easeInCubic"
  | "easeOutCubic"
  | "easeInOutCubic"
  | "easeInExpo"
  | "easeOutExpo"
  | "easeInOutExpo"
  | "easeInOutQuad";

export interface IAnimatedGraphic extends Graphic {
  symbolAnimation: GraphicSymbolAnimation;
}

interface IGraphicWithUID extends Graphic {
  uid: number;
}

const isGraphicsLayerView = (
  layerView: AnimatableLayerView
): layerView is __esri.GraphicsLayerView => {
  return layerView.layer.type === "graphics";
};

const isCIMVectorMarkerLayer = (
  symbolLayer: __esri.CIMSymbolLayer
): symbolLayer is __esri.CIMVectorMarker => {
  return symbolLayer.type === "CIMVectorMarker";
};

const isCIMPictureMarkerLayer = (
  symbolLayer: __esri.CIMSymbolLayer
): symbolLayer is __esri.CIMPictureMarker => {
  return symbolLayer.type === "CIMPictureMarker";
};

export class SymbolAnimationManager {
  private mapView: __esri.MapView;

  /** The layerview that will be animated. 
     *  - [TO REVIEW: HAS IMPLICATOINS ON POPUP BEHAVIOUR OF THE GRAPHICS LAYER]
     * If the layer is a **graphics layer**, then the symbols can be
        modified directly and overlay graphics can be added directly to the
        layer. 
        - If the layer is of **any other animatable type**, a new graphics layer
        must be added on top of the parent layer in order to animate symbols. 
        The symbols from the parent layer will be mostly hidden using a feature effect.
     */
  private parentLayerView: AnimatableLayerView;

  /**
   * The graphics layer into which animatedGraphics are added.
   */
  private animationGraphicsLayer: __esri.GraphicsLayer;

  /**
   * The current animated Graphics added to the animation layer
   */
  private animatedGraphics: Record<string, IAnimatedGraphic>;

  /**
   * The current graphic object ids that should be filtered out.
   * **Only applicable when the parent layerView is not a Graphics Layer**
   */
  private graphicsObjectIdsToFilter: Set<number> = new Set();

  constructor({ layerView, mapView }: { layerView: AnimatableLayerView; mapView: __esri.MapView }) {
    this.mapView = mapView;
    this.animatedGraphics = {};
    this.parentLayerView = layerView;
    this.animationGraphicsLayer = this.setupAnimatedGraphicsLayer(layerView);
  }

  private setupAnimatedGraphicsLayer(layerView: AnimatableLayerView): __esri.GraphicsLayer {
    if (isGraphicsLayerView(layerView)) {
      return layerView.layer as __esri.GraphicsLayer;
    } else {
      this.animationGraphicsLayer = new GraphicsLayer({
        effect: (layerView.layer as __esri.FeatureLayer).effect,
      });

      this.mapView.map.add(
        this.animationGraphicsLayer,
        this.mapView.layerViews.findIndex(item => {
          return item === layerView;
        }) + 1
      );

      // **HACK**
      // create a feature effect filter that can be used to visibly hide features
      // from being displayed but still allows for interactions such as clicks to show
      // popups.
      layerView.featureEffect = new FeatureEffect({
        includedEffect: "opacity(0.001%)",
        filter: new FeatureFilter({ where: "1<>1" }),
      });

      return this.animationGraphicsLayer;
    }
  }

  private addExcludedFeature(graphic: Graphic) {
    const objectId = graphic.getObjectId();
    if (objectId) {
      this.graphicsObjectIdsToFilter.add(objectId);
      this.updateExcludedFeatures();
    }
  }

  private removeExcludedFeature(graphic: Graphic) {
    const objectId = graphic.getObjectId();
    if (objectId) {
      this.graphicsObjectIdsToFilter.delete(objectId);
      this.updateExcludedFeatures();
    }
  }

  private updateExcludedFeatures(): void {
    (this.parentLayerView as FeatureLayerView).featureEffect.filter = new FeatureFilter({
      where: `${(this.parentLayerView as FeatureLayerView).layer.objectIdField} IN ( ${Array.from(
        this.graphicsObjectIdsToFilter
      ).join(",")} ) `,
    });
  }

  public hasAnimatedGraphic({
    graphic,
    animationId,
  }: {
    graphic?: __esri.Graphic;
    animationId?: string;
  }) {
    if (animationId) {
      return this.animatedGraphics[animationId] !== undefined;
    }
    if (graphic) {
      return this.animatedGraphics[this.getGraphicId(graphic)] !== undefined;
    }
  }

  public getAnimatedGraphic({
    graphic,
    animationId,
  }: {
    graphic?: __esri.Graphic;
    animationId?: string;
  }): IAnimatedGraphic | undefined {
    if (animationId) {
      return this.animatedGraphics[animationId];
    }
    if (graphic) {
      return this.animatedGraphics[this.getGraphicId(graphic)];
    }
  }

  public getAllAnimatedGraphics(): IAnimatedGraphic[] {
    return Object.values(this.animatedGraphics) ?? [];
  }

  public makeAnimatableSymbol({
    graphic,
    easingConfig,
    isOverlay = false,
    animationId,
  }: {
    graphic: __esri.Graphic;
    easingConfig: AnimationEasingConfig;
    isOverlay?: boolean;
    animationId?: string;
  }): IAnimatedGraphic {
    const uniqueGraphicId = animationId ?? this.getGraphicId(graphic);

    if (this.hasAnimatedGraphic({ graphic, animationId })) {
      return this.getAnimatedGraphic({
        animationId,
        graphic,
      }) as IAnimatedGraphic;
    }

    const newAnimatedGraphic = GraphicSymbolAnimation.createAnimatedGraphic({
      graphic,
      easingConfig,
      id: uniqueGraphicId,
    });

    // add the graphic to the lookup
    this.animatedGraphics[uniqueGraphicId] = newAnimatedGraphic;

    if (isGraphicsLayerView(this.parentLayerView)) {
      // directly manipulate the graphic.
    } else {
      // make a new animated graphic and add it to a new graphics layer.
      this.animationGraphicsLayer.add(newAnimatedGraphic);

      if (!isOverlay) {
        this.addExcludedFeature(graphic);
      }
    }

    return newAnimatedGraphic;
  }

  public removeAnimatedGraphic(graphic: __esri.Graphic, animationId?: string): void {
    const uniqueGraphicId = animationId ?? this.getGraphicId(graphic);
    if (this.hasAnimatedGraphic({ graphic, animationId })) {
      const animatedGraphic = this.getAnimatedGraphic({
        animationId,
        graphic,
      }) as IAnimatedGraphic;
      if (isGraphicsLayerView(this.parentLayerView)) {
        // reset the graphic symbol.
        animatedGraphic.symbolAnimation.resetSymbol();
      } else {
        this.removeExcludedFeature(graphic);
        window.setTimeout(() => {
          // remove graphic from animation layer.
          this.removeAnimatedGraphic(animatedGraphic);
          this.animationGraphicsLayer.remove(animatedGraphic);
        }, 100);
      }
      delete this.animatedGraphics[uniqueGraphicId];
    }
  }

  private getGraphicId(graphic: __esri.Graphic): string {
    return (
      (graphic as IAnimatedGraphic)?.symbolAnimation?.id ??
      graphic.getObjectId().toString() ??
      `${(graphic as IGraphicWithUID).uid}-uid`
    );
  }
}

class GraphicSymbolAnimation {
  public static createAnimatedGraphic({
    graphic,
    easingConfig,
    id,
  }: {
    graphic: __esri.Graphic;
    easingConfig: AnimationEasingConfig;
    id: string;
  }): IAnimatedGraphic {
    (graphic as IAnimatedGraphic).symbolAnimation = new GraphicSymbolAnimation({
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
        return (progress: number, fromSymbol: __esri.Symbol, to: IAnimatableSymbolProps) => {
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
