import * as reactiveUtils from "@arcgis/core/core/reactiveUtils.js";
import type Graphic from "@arcgis/core/Graphic";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
import FeatureEffect from "@arcgis/core/layers/support/FeatureEffect";
import FeatureFilter from "@arcgis/core/layers/support/FeatureFilter";
import type FeatureLayerView from "@arcgis/core/views/layers/FeatureLayerView";

import { AnimatedSymbol } from "./AnimatedSymbol";
import type {
  AnimatableLayerView,
  AnimationEasingConfig,
  IAnimatedGraphic,
  IGraphicWithUID,
} from "./types";
import { isGraphicsLayerView } from "./types/typeGuards";
import { SPRING_PRESETS } from "./utils/constants";

/**
 * This Class manages the animation of symbols on a given
 * AnimatableLayerView.
 *
 * - If the AnimatableLayerView is a GraphicsLayer, then the symbols
 *   can be modified directly, and overlay graphics can be added directly
 *   to the layer.
 * - If the layer is of any other animatable type, a new graphics layer
 *   must be added on top of the parent layer in order to animate symbols.
 *   The symbols from the parent layer will be mostly hidden using a
 *   feature effect.
 */
export class SymbolAnimationManager {
  // Private Properties
  private mapView: __esri.MapView;
  private animatedGraphics: Map<string, IAnimatedGraphic>;
  private graphicsObjectIdsToFilter = new Set<number>();
  private layerOrderListener: IHandle | undefined;

  // Public Properties
  readonly parentLayerView: AnimatableLayerView;
  readonly animationGraphicsOverlay: __esri.GraphicsLayer;

  // Constructor
  constructor({ layerView, mapView }: { layerView: AnimatableLayerView; mapView: __esri.MapView }) {
    this.mapView = mapView;
    this.animatedGraphics = new Map<string, IAnimatedGraphic>();
    this.parentLayerView = layerView;
    this.animationGraphicsOverlay = this.setupAnimatedGraphicsLayer(layerView);
  }

  // Public Methods
  public hasAnimatedGraphic({
    graphic,
    animationId,
  }: {
    graphic?: __esri.Graphic;
    animationId?: string;
  }): boolean {
    return this.animatedGraphics.has(this.getUniqueId({ graphic, animationId }));
  }

  public getAnimatedGraphic({
    graphic,
    animationId,
  }: {
    graphic?: __esri.Graphic;
    animationId?: string;
  }): IAnimatedGraphic | undefined {
    return this.animatedGraphics.get(this.getUniqueId({ graphic, animationId }));
  }

  public getAllAnimatedGraphics(): IAnimatedGraphic[] {
    return Array.from(this.animatedGraphics.values());
  }

  public removeAllAnimatedGraphics(): void {
    this.getAllAnimatedGraphics().forEach(animatedGraphic => {
      this.removeAnimatedGraphic({ graphic: animatedGraphic });
    });
  }

  public makeAnimatableSymbol({
    graphic,
    easingConfig = { type: "spring", options: SPRING_PRESETS.molasses },
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
    // Remove the source layer information from the graphic except for the objectIdField.
    if ("objectIdField" in this.parentLayerView.layer) {
      graphic.set("sourceLayer", {
        objectIdField: (this.parentLayerView as __esri.FeatureLayerView).layer.objectIdField,
      });
    }

    const uniqueGraphicId = this.getUniqueId({ graphic, animationId });

    if (this.hasAnimatedGraphic({ animationId: uniqueGraphicId })) {
      return this.getAnimatedGraphic({ animationId: uniqueGraphicId }) as IAnimatedGraphic;
    }

    if (opacity) {
      opacity = Math.min(1, Math.max(0, opacity));
    } else {
      opacity = this.isAnimatedGraphicsLayerView ? 1 : this.parentLayerView.layer.opacity;
    }

    const newAnimatedGraphic = AnimatedSymbol.createAnimatedGraphic({
      graphic,
      easingConfig,
      id: uniqueGraphicId,
      isOverlay,
      opacity,
      animationManager: this,
    });

    this.animatedGraphics.set(uniqueGraphicId, newAnimatedGraphic);

    if (this.isAnimatedGraphicsLayerView === false || isOverlay) {
      this.animationGraphicsOverlay.add(newAnimatedGraphic);
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
      animatedGraphic.symbolAnimation.resetSymbol();
      if (!this.isAnimatedGraphicsLayerView || animatedGraphic.symbolAnimation.isOverlay === true) {
        this.animationGraphicsOverlay.remove(animatedGraphic);
      }
    }
    this.animatedGraphics.delete(uniqueGraphicId);
  }

  public destroy(): void {
    this.removeAllAnimatedGraphics();
    this.layerOrderListener?.remove();
    this.mapView.map.remove(this.animationGraphicsOverlay);
  }

  // Private Methods
  private get isAnimatedGraphicsLayerView(): boolean {
    return isGraphicsLayerView(this.parentLayerView);
  }

  private setupAnimatedGraphicsLayer(layerView: AnimatableLayerView): __esri.GraphicsLayer {
    if (isGraphicsLayerView(layerView)) {
      return layerView.layer as __esri.GraphicsLayer;
    } else {
      const animationGraphicsOverlay = new GraphicsLayer({
        ...((layerView.layer as __esri.FeatureLayer).effect && {
          effect: (layerView.layer as __esri.FeatureLayer).effect,
        }),
      });

      this.mapView.map.add(
        animationGraphicsOverlay,
        this.mapView.layerViews.findIndex(item => item === layerView) + 1
      );

      this.layerOrderListener = reactiveUtils.watch(
        () => this.mapView.map.allLayers,
        allLayers => {
          const layerIndex = allLayers.findIndex(layer => layer.id === animationGraphicsOverlay.id);
          const parentLayerIndex = allLayers.findIndex(
            layer => layer.id === this.parentLayerView.layer.id
          );
          if (layerIndex > parentLayerIndex + 1) {
            this.mapView.map.reorder(animationGraphicsOverlay, parentLayerIndex + 1);
          }
        }
      );

      layerView.featureEffect = new FeatureEffect({
        includedEffect: "opacity(0.001%)",
        filter: new FeatureFilter({ where: "1<>1" }),
      });

      this.addGraphicsLayerWatchers(animationGraphicsOverlay);
      return animationGraphicsOverlay;
    }
  }

  private addGraphicsLayerWatchers(graphicsLayerOverlay: __esri.GraphicsLayer): void {
    graphicsLayerOverlay.graphics.on("before-remove", e => {
      const doNotRemove = () => e.preventDefault();
      const removedGraphic = e.item as IAnimatedGraphic;
      const { isOverlay, isAnimating, id: animationId } = removedGraphic.symbolAnimation;

      if (!this.hasAnimatedGraphic({ graphic: removedGraphic, animationId })) {
        return;
      }

      if (isOverlay) {
        this.animatedGraphics.delete(
          this.getUniqueId({
            graphic: removedGraphic,
            animationId: removedGraphic.symbolAnimation.id,
          })
        );
        return;
      } else {
        if (isAnimating) {
          doNotRemove();
          return;
        } else {
          this.removeExcludedFeature(removedGraphic);
        }
      }

      reactiveUtils
        .whenOnce(() => !this.mapView.updating)
        .then(() => {
          if (!isAnimating) {
            graphicsLayerOverlay.remove(removedGraphic);
            this.animatedGraphics.delete(
              this.getUniqueId({
                graphic: removedGraphic,
                animationId: removedGraphic.symbolAnimation.id,
              })
            );
          }
        });
    });

    graphicsLayerOverlay.graphics.on("before-add", e => {
      const addedGraphic = e.item as IAnimatedGraphic;
      if (!addedGraphic.symbolAnimation.isOverlay) {
        this.addExcludedFeature(addedGraphic);
      }
    });
  }

  public addExcludedFeature(graphic: __esri.Graphic): void {
    const objectId = graphic.getObjectId();
    if (objectId) {
      this.graphicsObjectIdsToFilter.add(objectId);
      this.updateExcludedFeatures();
    }
  }

  private removeExcludedFeature(graphic: Graphic): void {
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
          ? `${(this.parentLayerView as FeatureLayerView).layer.objectIdField} IN (${Array.from(
              this.graphicsObjectIdsToFilter
            ).join(",")})`
          : "1<>1",
    });
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
