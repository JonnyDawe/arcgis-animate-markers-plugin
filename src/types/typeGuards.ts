import { AnimatableLayerView, IPictureMarkerWithOpacity } from "./index";

export const isGraphicsLayerView = (
  layerView: AnimatableLayerView
): layerView is __esri.GraphicsLayerView => {
  return layerView.layer.type === "graphics";
};

export const isPictureMarkerWithOpacity = (
  symbol: __esri.Symbol
): symbol is IPictureMarkerWithOpacity => {
  return (symbol as IPictureMarkerWithOpacity).opacity !== undefined;
};
