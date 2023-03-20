# arcgis-animate-markers-plugin

A JavaScript plugin library for animating symbols in the ArcGIS Maps SDK using spring-like physics. With this library, you can animate marker symbol properties such as scale and rotation to create engaging, dynamic and interactive maps!

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

First create a `SymbolAnimationManager` to handle the behaviour of adding and removing animated graphics from the layerview.

```js
import { SymbolAnimationManager } from "arcgis-animate-markers-plugin";

const symbolAnimationManager = new SymbolAnimationManager({
  mapView,
  layerView,
});
```

The animation manager for the layerview can be used to create and manage animatable marker symbols. You can create an animatable graphic symbol using the `makeAnimatableSymbol` method and start the animation using the `symbolAnimation.start` method as shown below:

```js
const animatedGraphic = this.symbolAnimationManager.makeAnimatableSymbol({
  // the graphic to be animated
  graphic: hitGraphic,

  // animation transition properties
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

## Documentation:

### Class: `SymbolAnimationManager`

```js
import { SymbolAnimationManager } from "arcgis-animate-markers-plugin";

const symbolAnimationManager = new SymbolAnimationManager({
  mapView,
  layerView,
});
```

### Options

#### mapView _`required`_

The MapView associated with the layer.

#### layerView _`required`_

The AnimatableLayerView ( FeatureLayerView / GraphicsLayerView / GeoJSONLayerView) that will be animated.

### Methods

#### makeAnimatableSymbol

Makes the given graphic animatable.

```js
makeAnimatableSymbol({ graphic, easingConfig, isOverlay, animationId }: { graphic: __esri.Graphic; easingConfig?: AnimationEasingConfig; isOverlay?: boolean; animationId?: string; }): IAnimatedGraphic
```

##### graphic _`required`_

- The graphic to be animated.

##### easingConfig _`optional`_

- The easingConfig parameter specifies the easing function used for the animation. Either a Spring or standary easing type can be used:

```js
// Example - Spring Easing.
const spring = {
  type: "spring",
  // See React-Spring Documentation for more details
  options: {
    tension: 280,
    friction: 40,
    mass: 10
  }
}

// Example - Standard Easing.
const spring = {
  type: "easing",
  options: {
    easingFunction: "linear" // "easeInCubic"|"easeOutCubic"| etc.
    duration: number;
  }
}
```

##### isOverlay _`optional`_

The isOverlay parameter is an optional boolean value that specifies whether the graphic should be an overlay - this means the original (non-aniamted) symbol will not be hidden from the mapView.

##### animationId _`optional`_

The animationId parameter is an optional string value that specifies the ID of the animation. If an animated graphic with the same graphic and animationId already exists, it is returned instead of creating a new one.

##### Animated Graphic _`returns`_

An animated Graphic extends the standard esri graphic. It has a new property called `symbolAnimation` that contains methods and properties for running symbol animations.

#### hasAnimatedGraphic

Checks if an animated graphic with the given graphic or animationId already exists.

```js
hasAnimatedGraphic({ graphic, animationId }: { graphic?: __esri.Graphic; animationId?: string }):
boolean
```

#### getAnimatedGraphic

returns the animated graphic with the given graphic and animationId, if it exists.

```js
getAnimatedGraphic({ graphic, animationId }: { graphic?: __esri.Graphic; animationId?: string }): IAnimatedGraphic | undefined
```

#### getAllAnimatedGraphics

returns all animated graphics.

```js
getAllAnimatedGraphics(): IAnimatedGraphic[]
```

#### removeAnimatedGraphic

Removes the given graphic from the animated graphics.

```js
removeAnimatedGraphic({ graphic }: { graphic: __esri.Graphic }): void
```

#### removeAllAnimatedGraphics

Removes all animated graphics from display.

```js
removeAllAnimatedGraphics(): void
```
