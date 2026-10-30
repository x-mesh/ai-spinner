# ai-spinner

Animated canvas spinners that show what an AI assistant does while the user waits.
The package has 68 style sets. Each set has nine states, such as `searching`, `solving` and `composing`.

See all sets and copy the code for your choice in the [gallery](https://x-mesh.github.io/ai-spinner/).

- No runtime dependencies. React is optional.
- Each set is a separate module. Your bundle contains only the sets that you import.
- The spinner follows your page colors, stops when it is off screen, and obeys `prefers-reduced-motion`.

## Install

```sh
npm install ai-spinner
```

## Use with React

```tsx
import { Spinner } from 'ai-spinner'
import { bars } from 'ai-spinner/sets/bars'

export function Reply() {
  return <Spinner set={bars} state="searching" size={32} />
}
```

If you do not give `set`, the spinner uses `matrix`.

The component file has the `'use client'` directive, so you can use it in React Server Components apps such as Next.js.

### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `state` | `SpinnerState` | required | The activity to show. See [States](#states). |
| `set` | `SpinnerSet` | `matrix` | The style set. Import it from `ai-spinner/sets/<name>`. |
| `size` | `number` | `64` | Width and height in CSS pixels. Below 32, each set uses a simpler compact design. |
| `theme` | `'auto' \| 'light' \| 'dark'` | `'auto'` | `auto` uses the CSS `color` of the canvas. `light` and `dark` use a fixed ink. |
| `speed` | `number` | `1` | Multiplies the animation speed. |
| `paused` | `boolean` | `false` | Stops the animation on the current frame. |
| `startAt` | `number` | unset | Animation time in seconds. When paused, the spinner shows this frame. |
| `aria-label` | `string` | `Assistant is <state>` | The accessible name of the spinner. |
| `decorative` | `boolean` | `false` | Hides the spinner from screen readers. Use it when text next to the spinner already gives its meaning. |

## Use without React

Import from `ai-spinner/vanilla`. This entry point does not import React.

```ts
import { mountSpinner } from 'ai-spinner/vanilla'
import { knot } from 'ai-spinner/sets/knot'

const canvas = document.querySelector('canvas')!
canvas.setAttribute('role', 'img')
canvas.setAttribute('aria-label', 'Assistant is searching')

const spinner = mountSpinner(canvas, { set: knot, state: 'searching', size: 48 })

spinner.update({ state: 'composing' })
spinner.destroy()
```

`mountSpinner` accepts the same options as the React props, except `aria-label` and `decorative`.
Set the accessibility attributes on the canvas yourself.
`update` changes only the options that you give. The animation does not restart.

## States

| State | Use it when the assistant |
|---|---|
| `working` | does general work |
| `searching` | looks for information |
| `solving` | reasons about a problem |
| `listening` | receives voice input |
| `connecting` | connects to a tool or a service |
| `weaving` | combines several sources |
| `composing` | writes the answer |
| `breathing` | waits, idle |
| `shaping` | builds or transforms content |

`SPINNER_STATES` contains all nine names in this order.

## Sets

Import one set from its own path:

```ts
import { galaxy } from 'ai-spinner/sets/galaxy'
```

To show all sets, for example in a settings screen, import `SPINNER_SETS`.
This import adds all 68 sets to your bundle.

```ts
import { SPINNER_SETS } from 'ai-spinner/sets'
```

The 68 sets are:
`matrix`, `bars`, `dial`, `strokes`, `blob`, `quad`, `glyph`, `hive`, `halo`, `bounce`, `facet`, `eyes`, `sprout`, `tide`, `goo`, `pond`, `cards`,
`mochi`, `ribbon`, `bloom`, `dust`, `flock`, `moire`, `tunnel`, `pendulum`, `spiro`, `worm`, `glitch`, `domino`, `ridge`, `halftone`, `coil`, `kaleido`, `wire`,
`ferro`, `harp`, `comet`, `galaxy`, `knot`, `swirl`, `cells`, `drip`, `burst`, `truchet`, `iso`, `gyro`, `spark`, `jelly`, `fizz`, `cloth`, `globe`,
`fold`, `sand`, `bokeh`, `smoke`, `field`, `chain`, `flame`, `aurora`, `twister`, `radar`, `pulse`, `plexus`, `marble`, `helix`, `aura`, `shatter`, `confetti`.

Each set has `id`, `label`, a `blurbs` text for each state, and an `icon` frame (`{ state, t }`).
To show a still preview of a set, use `icon` with `paused` and `startAt`:

```tsx
<Spinner set={bars} state={bars.icon.state} startAt={bars.icon.t} size={24} paused decorative />
```

## Colors and dark mode

With `theme="auto"`, the spinner uses the CSS `color` of the canvas. Set the color on the spinner or on a parent element:

```css
.reply { color: #444; }
@media (prefers-color-scheme: dark) { .reply { color: #ddd; } }
```

The spinner reads the color again on each frame. A theme change on the page updates the spinner immediately.

## Bundle size

Sizes are after minification and gzip:

- Shared code and the default `matrix` set: approximately 3.1 kB.
- Each additional set: 1.4 kB to 2.7 kB.

## Behavior

- All spinners on a page share one `requestAnimationFrame` loop. Spinners with the same speed stay in phase.
- A spinner that is not visible on screen does not draw.
- If the user sets `prefers-reduced-motion: reduce`, the spinner shows one still frame.

## Develop

```sh
npm install
npm run dev          # Gallery page at http://localhost:5173
npm run build        # Library into dist/
npm run build:demo   # Gallery page into dist-demo/
npm run lint
```

## License

[MIT](LICENSE)
