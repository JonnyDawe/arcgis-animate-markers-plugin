import type { AnimatableLayerView } from "./index";

export const isGraphicsLayerView = (
  layerView: AnimatableLayerView
): layerView is __esri.GraphicsLayerView => {
  return layerView.layer.type === "graphics";
};

export function isDefined<T>(value: T | undefined | null): value is T {
  return value !== undefined && value !== null;
}
