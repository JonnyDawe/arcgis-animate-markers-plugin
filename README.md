# arcgis-animate-markers-plugin

This plugin adds animation capabilities to points in the ArcGIS Maps SDK using spring-like physics. With this library, you can animate marker symbol properties such as scale and rotation to create engaging, dynamic and interactive maps!

## Examples

- [Live Demo](https://jonnydawe.github.io/Arcgis-Animate-Markers/)
- [Demo Repo](https://github.com/JonnyDawe/Arcgis-Animate-Markers)

## Getting Started

### Prerequisites

To use this plugin library, you need to have the following peer dependencies installed:

`ArcGIS Maps SDK for JavaScript`
`React-spring`

### Installation

To begin, you will need to install `arcgis-animate-markers-plugin`:

```console
npm install arcgis-animate-markers-plugin
```

After installation, you can create a symbol animation manager for any layerview to animate the point markers as follows:

```js
import { SymbolAnimationManager } from "arcgis-animate-markers-plugin";

const symbolAnimationManager = new SymbolAnimationManager({
  mapView,
  layerView,
});
```

The animation manager for the layerview can be used to create and manage animatable marker symbols. You can create an animatable graphic symbol using the makeAnimatableSymbol method and start the animation using the symbolAnimation.start method as shown below:

```js
const animatedGraphic = this.symbolAnimationManager.makeAnimatableSymbol({
  graphic: hitGraphic,
  easingConfig: {
    type: "spring",
    options: {
      tension: 280,
      friction: 40,
      mass: 10,
    },
  },
});

animatedGraphic.symbolAnimation.start({
  to: { scale: 1.2, rotate: 10 },
});
```
