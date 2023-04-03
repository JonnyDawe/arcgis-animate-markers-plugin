import Graphic from "@arcgis/core/Graphic";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
import FeatureEffect from "@arcgis/core/layers/support/FeatureEffect";
import FeatureFilter from "@arcgis/core/layers/support/FeatureFilter";
import FeatureLayerView from "@arcgis/core/views/layers/FeatureLayerView";
import { config as springConfig } from "@react-spring/web";

import { AnimatedSymbol } from "./AnimatedSymbol";
import {
  AnimatableLayerView,
  AnimationEasingConfig,
  IAnimatedGraphic,
  IGraphicWithUID,
} from "./types";
import { isGraphicsLayerView } from "./types/typeGuards";

/**
 *  This Class manages the animation of symbols on a given
 *  AnimatableLayerView.
 *
 *  - If the AnimatableLayerView is a GraphicsLayer, then the symbols
 *  can be modified directly, and overlay graphics can be added directly
 *  to the layer.
 * - If the layer is of any other animatable type, a new graphics layer
 *  must be added on top of the parent layer in order to animate symbols.
 *  The symbols from the parent layer will be mostly hidden using a
 *  feature effect.
 */
export class SymbolAnimationManager {
  private mapView: __esri.MapView;

  /** The layerview that will be animated.
   *  - [TO REVIEW: HAS IMPLICATOINS ON POPUP BEHAVIOUR OF THE GRAPHICS LAYER]
   */
  readonly parentLayerView: AnimatableLayerView;

  /**
   * The graphics layer into which animatedGraphics are added.
   */
  readonly animationGraphicsLayer: __esri.GraphicsLayer;

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

  private get isAnimatedGraphicsLayerView(): boolean {
    return isGraphicsLayerView(this.parentLayerView);
  }

  /**
   * get or setup a new grahics layer view for storing and or adding animated symbols.
   *
   * In the case of a graphics layerview features are directly manipulated within the layer.
   *
   * For other types of layerview a new graphics layer is added above the parent layer and used
   * to contain the graphics for manipulation.
   *
   * @param layerView - a layerview that can be animated.
   * @returns graphics layerview
   */
  private setupAnimatedGraphicsLayer(layerView: AnimatableLayerView): __esri.GraphicsLayer {
    if (isGraphicsLayerView(layerView)) {
      return layerView.layer as __esri.GraphicsLayer;
    } else {
      const newAnimationGraphicsLayer = new GraphicsLayer({
        ...((layerView.layer as __esri.FeatureLayer).effect && {
          effect: (layerView.layer as __esri.FeatureLayer).effect,
        }),
      });

      this.mapView.map.add(
        newAnimationGraphicsLayer,
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

      this.addGraphicsLayerWatchers(newAnimationGraphicsLayer);
      return newAnimationGraphicsLayer;
    }
  }

  /**
   * watch addition and removal of graphics to the animation graphics layer to ensure the
   * list of filtered features from the feature layer is kept up to date.
   *
   * @param graphicsLayer
   */
  private addGraphicsLayerWatchers(graphicsLayer: __esri.GraphicsLayer) {
    /** This logic tries to reduce flicker when removing points by preventing
     * the current feature from being removed until slightly after the graphic is removed
     * from the feature filter.
     */
    graphicsLayer.graphics.on("before-remove", e => {
      const removedGraphic = e.item as IAnimatedGraphic;
      if (this.graphicsObjectIdsToFilter.has(removedGraphic?.getObjectId()) === false) {
        return;
      }
      if (!removedGraphic.symbolAnimation.isOverlay) {
        this.removeExcludedFeature(removedGraphic);
      }
      e.preventDefault();
      window.requestAnimationFrame(() => {
        graphicsLayer.remove(removedGraphic);
      });
    });

    graphicsLayer.graphics.on("before-add", e => {
      const addedGraphic = e.item as IAnimatedGraphic;
      if (!addedGraphic.symbolAnimation.isOverlay) {
        this.addExcludedFeature(addedGraphic);
      }
    });
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
      where:
        this.graphicsObjectIdsToFilter.size > 0
          ? `${(this.parentLayerView as FeatureLayerView).layer.objectIdField} IN ( ${Array.from(
              this.graphicsObjectIdsToFilter
            ).join(",")} )`
          : "1<>1",
    });
  }

  public hasAnimatedGraphic({
    graphic,
    animationId,
  }: {
    graphic?: __esri.Graphic;
    animationId?: string;
  }) {
    return (
      this.animatedGraphics[
        this.getUniqueId({
          graphic,
          animationId,
        })
      ] !== undefined
    );
  }

  public getAnimatedGraphic({
    graphic,
    animationId,
  }: {
    graphic?: __esri.Graphic;
    animationId?: string;
  }): IAnimatedGraphic | undefined {
    return this.animatedGraphics[
      this.getUniqueId({
        graphic,
        animationId,
      })
    ];
  }

  public getAllAnimatedGraphics(): IAnimatedGraphic[] {
    return Object.values(this.animatedGraphics);
  }

  public removeAllAnimatedGraphics(): void {
    this.getAllAnimatedGraphics().forEach(animatedGraphic => {
      this.removeAnimatedGraphic({ graphic: animatedGraphic });
    });
  }

  public makeAnimatableSymbol({
    graphic,
    easingConfig = { type: "spring", options: springConfig.molasses },
    isOverlay = false,
    animationId,
    opacity,
  }: {
    graphic: __esri.Graphic;
    easingConfig?: AnimationEasingConfig;
    isOverlay?: boolean;
    animationId?: string;
    opacity?: number;
  }): IAnimatedGraphic {
    const uniqueGraphicId = this.getUniqueId({
      graphic,
      animationId,
    });

    if (this.hasAnimatedGraphic({ animationId: uniqueGraphicId })) {
      return this.getAnimatedGraphic({ animationId: uniqueGraphicId }) as IAnimatedGraphic;
    }

    if (opacity) {
      // user input opacity value
      // clamp opacity value between 0 and 1.
      opacity = Math.min(1, Math.max(0, opacity));
    } else {
      // get the opacity of the parent layer view.
      // - If it is a graphics layer then we are directly adjusting a graphic from the parent layer
      // meaning it already has an opacity matching the layer.
      // - Otherwise we need to ensure a new graphic has an opacity matching the parent layer when it is added
      opacity = this.isAnimatedGraphicsLayerView ? 1 : this.parentLayerView.layer.opacity;
    }

    const newAnimatedGraphic = AnimatedSymbol.createAnimatedGraphic({
      graphic,
      easingConfig,
      id: uniqueGraphicId,
      isOverlay,
      opacity,
    });

    // add the graphic to the lookup
    this.animatedGraphics[uniqueGraphicId] = newAnimatedGraphic;

    if (this.isAnimatedGraphicsLayerView === false || isOverlay) {
      this.animationGraphicsLayer.add(newAnimatedGraphic);
    }

    return newAnimatedGraphic;
  }

  public removeAnimatedGraphic({
    graphic,
    animationId,
  }: {
    graphic?: __esri.Graphic;
    animationId?: string;
  }): void {
    const uniqueGraphicId = this.getUniqueId({ graphic, animationId });
    if (uniqueGraphicId === "") return;

    if (this.hasAnimatedGraphic({ graphic, animationId: uniqueGraphicId })) {
      const animatedGraphic = this.getAnimatedGraphic({
        animationId: uniqueGraphicId,
      }) as IAnimatedGraphic;

      if (this.isAnimatedGraphicsLayerView && animatedGraphic.symbolAnimation.isOverlay === false) {
        // reset the graphic symbol.
        animatedGraphic.symbolAnimation.resetSymbol();
      } else {
        this.animationGraphicsLayer.remove(animatedGraphic);
      }
      delete this.animatedGraphics[uniqueGraphicId];
    }
  }

  private getUniqueIdFromGraphic(graphic: __esri.Graphic): string {
    return (
      (graphic as IAnimatedGraphic)?.symbolAnimation?.id ??
      graphic?.getObjectId()?.toString() ??
      `${(graphic as IGraphicWithUID).uid}-uid`
    );
  }

  private getUniqueId({
    graphic,
    animationId,
  }: {
    graphic?: __esri.Graphic;
    animationId?: string;
  }): string {
    if (animationId) {
      return animationId;
    }

    if (graphic) {
      return this.getUniqueIdFromGraphic(graphic);
    }

    return "";
  }
}
