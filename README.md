# React SVG Image

Convert an SVG JSX element into an image (either a data URI, or a Blob, as PNG,
JPEG or WEBP). This can be very useful if rendering something other than HTML
in browser environments, such as PDFs.

Built in typescript definitions, published as module, around 1.4Kb minified and
gzipped, no dependencies (although you will need React in your project).

This library is based on https://github.com/JuanIrache/d3-svg-to-png.

## Installation

```bash
npm install react-svg-image
```

## Setup

You must provide a "render" function - this is similar to whatever you are
doing to render your React app (i.e. `ReactDOM.render` for 16 & 17, or
`ReactDOM.createRoot` and `root.render()` for 18) - but it must return a
Promise that resolves when the render has completed.

### Sample renderAsPromise for React 16 and 17

```javascript
import ReactDOM from "react-dom";
import { setDomRenderer } from "react-svg-image";

// For React 16.x and 17.x
async function renderAsPromise(el, domEl) {
  return new Promise((resolve) => {
    ReactDOM.render(el, domEl, resolve);
  });
}

// This only needs to be done once in your app, before you can use the library
setDomRenderer(renderAsPromise);
```

### Sample renderAsPromise for React 18

```javascript
import ReactDOM from "react-dom";
import { setDomRenderer } from "react-svg-image";

// For React 18.x, where ReactDOM.render is deprecated.
async function renderAsPromise(el, domEl) {
  const root = ReactDOM.createRoot(domEl);
  root.render(el);
  return new Promise((resolve) => {
    requestIdleCallback(resolve);
  });
}

// This only needs to be done once in your app, before you can use the library
setDomRenderer(renderAsPromise);
```

## Usage

Once you've setup your renderer, you can use the library to convert your SVG

```javascript
import React from "react";
import ReactDOM from "react-dom";

const SvgThing = ({ color }) => {
  return (
    <svg width="100" height="100">
      <circle
        cx="50"
        cy="50"
        r="40"
        stroke="black"
        strokeWidth="3"
        fill={color}
      />
    </svg>
  );
};

const SomeComponent = () => {
  const [color, setColor] = React.useState("#ff0000");
  const [src, setSrc] = React.useState(null);

  const onClick = async () => {
    // make sure you called `setRenderer` first!
    const src = await renderSvgAsImage(<SvgThing color={color} />);
    setSrc(src);
  };

  return (
    <div>
      <input
        type="color"
        value={color}
        onChange={(e) => setColor(e.target.value)}
      />
      <button onClick={onClick}>Render</button>
      {src ? <img src={src} /> : <>No image set yet</>}
    </div>
  );
};
```

## Working with `@react-pdf/renderer`

React PDF has support for SVG itself, but not the full specification, for
example you can't use `stroke-dashoffset`.

Fortunately react-pdf has support for providing an async function as the `src`
prop of an `Image` component, so we can use that to render the SVG as an image
and then use that image in the PDF.

```javascript
import React from "react";
import { Document, Page, View, Image } from "@react-pdf/renderer";
import { renderSvgAsImage, setDomRenderer } from "react-svg-image";

// For React 16.x and 17.x
async function renderAsPromise(el, domEl) {
  return new Promise((resolve) => {
    ReactDOM.render(el, domEl, resolve);
  });
}

setDomRenderer(renderAsPromise);

// Note the use of an SVG property, `strokeDasharray` that is not supported by
// `@react-pdf/renderer`
const SvgIcon = ({ color }) => {
  return (
    <svg width="100" height="100">
      <circle
        cx="50"
        cy="50"
        r="40"
        stroke="black"
        strokeDashoffset="100"
        strokeDasharray="100"
        strokeWidth="3"
        fill={color}
      />
    </svg>
  );
};

export const PdfDocument = () => {
  return (
    <Document>
      <Page>
        <View>
          <Image src={() => renderSvgAsImage(<SvgIcon color="#ff6600" />)} />
        </View>
      </Page>
    </Document>
  );
};
```

### Wrapper Component for `<Image>`

It's fairly straighforward to make your own component to tidy up the code a bit, you could have an `SvgImage.js` file like this:

```javascript
import React from "react";
import { Image } from "@react-pdf/renderer";
import { renderSvgAsImage } from "react-svg-image";

// Wrapper component for `<Image />`, passing on all props but handling
// children with `renderSvgAsImage`
export const SvgImage = ({ children, ...props }) => {
  return <Image {...props} src={() => renderSvgAsImage(children)} />;
};
```

And then use it like this:
```javascript
import React from "react";
import { Document, Page, View } from "@react-pdf/renderer";

import { SvgImage } from "./SvgImage";


export const PdfDocument = () => {
  return (
    <Document>
      <Page>
        <View>
          <SvgImage><SvgIcon color="#ff6600" /></SvgImage>
        </View>
      </Page>
    </Document>
  );
};
```

## Limitations

- The SVG element will be rendered in a _new react app_, which means you won't
  get any Context ...
  
  You could pass in
  `<ContextProvider><svg>...</svg></ContextProvider>` if you wanted to, but
  it's obviously awkward.
- In a similar vein, since we are rendering this "outside your app", there may
  other limitations on "globals".
- Image format support is browser-dependent
- If you're rendering to `jpeg`, you will probably need to specify a background
  color for your SVG
