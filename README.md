 <p align="center">
  <img width="180" src="https://i.imgur.com/qq9rtY2.png" alt="plugin logo">
</p>

# arcgis-animate-markers-plugin

A JavaScript plugin library for animating symbols in the ArcGIS Maps SDK using spring-like physics. With this library, you can animate marker symbol properties such as scale and rotation to create engaging, dynamic and interactive maps!

![Example animation on hover](https://i.imgur.com/AoRAT05.gif)

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

# Documentation:

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

The MapView associated with the LayerView that will have its point symbols animated.

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

- The easingConfig parameter specifies the easing function used for the animation. Either a Spring or standard easing type can be used:

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

### Class: `AnimatedSymbol`

This class provides the ability to animate a symbol for a Graphic object in ArcGIS API for JavaScript.

### Factory function:

Creates an AnimatedSymbol and attaches it to the provided Graphic.

```js
static createAnimatedGraphic({
  graphic,
  easingConfig,
  id,
  isOverlay = false,
}: {
  graphic: __esri.Graphic;
  easingConfig: AnimationEasingConfig;
  id: string;
  isOverlay?: boolean;
}): IAnimatedGraphic
```

#### Parameters

- graphic _`required`_: The Graphic to animate the symbol for.
- easingConfig _`required`_: [Configuration options](#####-easingConfig) for the animation easing.
- id (string) _`required`_: Unique identifier for the animated symbol.
- isOverlay (boolean) _`optional`_: Whether the animation should be displayed as an overlay. `Default is false.`

#### Returns

An animated Graphic that extends the standard esri graphic. It has a new property called `symbolAnimation` which contains the `AnimatedSymbol` Class properties and methods.

### Methods

#### start

This function animates a symbol by applying changes to its properties. The animation is controlled by an easing function or a spring value.

```js
start(animationProps: IAnimationProps)
```

- `animationProps` _`optional`_ [IAnimationProps](####-IAnimationProps): An object that is used to configure and control the animation of a symbol object.

#### stop

Stops the animation completely

```js
stop();
```

#### resetSymbol

Reset the symbol completely to its original symbol.

```js
resetSymbol();
```

### Types:

#### IAnimatedGraphic

An animated Graphic that extends the standard esri graphic. It has a new property called `symbolAnimation` which contains the `AnimatedSymbol` Class properties and methods.

```typescript
interface IAnimatedGraphic extends __esri.Graphic {
  symbolAnimation: AnimatedSymbol;
}
```

#### IAnimationProps

The IAnimationProps interface defines the properties that can be used to configure an animation. It has the following optional properties:

```typescript
interface IAnimationProps {
  to?: IAnimatableSymbolProps;
  onStep?: onSymbolAnimationStep<AnimatableSymbol>;
  onStart?: () => void;
  onFinish?: () => void;
}
```

- `to` _`optional`_ [IAnimatableSymbolProps](####-IAnimationProps): An object that holds the properties that the symbol will animate to.
- `onStep` _`optional`_ [onSymbolAnimationStep](####-onSymbolAnimationStep): An optional callback function for customising the symbol change on each animation step. On each step the applied symbol will be applied to the animating graphic.
- `onStart` _`optional`_: an optional callback function that is called when the animation starts.
- `onFinish` _`optional`_: an optional callback function that is called when the animation finishes.

#### IAnimatableSymbolProps

The IAnimatableSymbolProps interface defines the properties that can be animated for a symbol. It has the following optional properties:

```typescript
interface IAnimatableSymbolProps {
  scale?: number;
  rotate?: number;
}
```

- `scale` _`optional`_ (number): A number that represents the new scale of the symbol. If not provided, the scale will not change.
- `rotate` _`optional`_ (number) : A number that represents the new geographic rotation (rotation clockwise) of the symbol in degrees . If not provided, the rotation will not change.

#### onSymbolAnimationStep

The onSymbolAnimationStep type defines a callback function that is called on each animation step.

```typescript
type onSymbolAnimationStep<T extends AnimatableSymbol> = (
  progress: number,
  fromSymbol: SymbolType<T>,
  to: IAnimatableSymbolProps
) => SymbolType<T>;
```

- `progress`: number: A number between 0 and 1 that represents the current progress of the animation.
- `fromSymbol`: A symbol object that represents the starting symbol before the animation.
- `to`: [IAnimatableSymbolProps](####-IAnimatableSymbolProps): An object that holds the properties that the symbol will animate to.

#### AnimationEasingConfig

A union type that defines the configuration for the easing function used in the animation. It can be one of the following:

```typescript
type AnimationEasingConfig = ISpringEasingConfig | IStandardEasingConfig;
```

#### ISpringEasingConfig

An interface that defines the configuration for the spring easing function. It has the following properties:

```typescript
interface ISpringEasingConfig {
  type: "spring";
  options?: SpringAnimationProps["config"];
}
```

- `type` ("spring"): A string that identifies the easing function as a spring.
- `options`: AnimationProps["config"]: An object that holds the animation configuration - see the React-Spring Config Options [here](https://www.react-spring.dev/docs/advanced/config#reference)

#### IStandardEasingConfig

An interface that defines the configuration for a standard easing function. It has the following properties:

```typescript
export interface IStandardEasingConfig {
  type: "easing";
  options?: {
    easingFunction: easingTypes | EasingFunction;
    duration: number;
  };
}
```

- `type` ("easing"): A string that identifies the easing function as a standard easing function.
- `options`: An optional object that holds the animation configuration. It has two properties:
  - `easingFunction` (easingTypes | EasingFunction): The easing function to use for the animation. It can be one of the predefined easing function strings in the easingTypes type or a custom easing function. The default is "linear".
  - `duration` (number): The duration of the animation in milliseconds. The default is 1000.
