import Graphic from "@arcgis/core/Graphic";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer.js";
import FeatureEffect from "@arcgis/core/layers/support/FeatureEffect.js";
import FeatureFilter from "@arcgis/core/layers/support/FeatureFilter.js";
import FeatureLayerView from "@arcgis/core/views/layers/FeatureLayerView";

import { AnimatedSymbol } from "./AnimatedSymbol";
import {
  AnimatableLayerView,
  AnimationEasingConfig,
  IAnimatedGraphic,
  IGraphicWithUID,
} from "./types";
import { isGraphicsLayerView } from "./types/typeGuards";

export class SymbolAnimationManager {
  private mapView: __esri.MapView;

  /** The layerview that will be animated.
   *  - [TO REVIEW: HAS IMPLICATOINS ON POPUP BEHAVIOUR OF THE GRAPHICS LAYER]
   * If the layer is a **graphics layer**, then the symbols can be
   * modified directly and overlay graphics can be added directly to the
   * layer.
   * - If the layer is of **any other animatable type**, a new graphics layer
   * must be added on top of the parent layer in order to animate symbols.
   * The symbols from the parent layer will be mostly hidden using a feature effect.
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
    return;
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
    return;
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

    const newAnimatedGraphic = AnimatedSymbol.createAnimatedGraphic({
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
