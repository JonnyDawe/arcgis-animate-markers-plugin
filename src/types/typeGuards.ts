import { AnimatableLayerView } from "./index";

export const isGraphicsLayerView = (
  layerView: AnimatableLayerView
): layerView is __esri.GraphicsLayerView => {
  return layerView.layer.type === "graphics";
};
