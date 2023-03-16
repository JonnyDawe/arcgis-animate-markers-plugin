import { AnimatableLayerView } from "./index";

export const isGraphicsLayerView = (
  layerView: AnimatableLayerView
): layerView is __esri.GraphicsLayerView => {
  return layerView.layer.type === "graphics";
};

export const isCIMVectorMarkerLayer = (
  symbolLayer: __esri.CIMSymbolLayer
): symbolLayer is __esri.CIMVectorMarker => {
  return symbolLayer.type === "CIMVectorMarker";
};

export const isCIMPictureMarkerLayer = (
  symbolLayer: __esri.CIMSymbolLayer
): symbolLayer is __esri.CIMPictureMarker => {
  return symbolLayer.type === "CIMPictureMarker";
};
