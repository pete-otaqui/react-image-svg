export interface RenderAsPromise {
  (el: JSX.Element, domEl: HTMLElement): Promise<void>;
}

export enum ImageFormat {
  PNG = "png",
  JPEG = "jpeg",
  WEBP = "webp",
}

export enum ImageOutput {
  DATA_URL = "data_url",
  BLOB = "blob",
}

export type RenderSvgAsImageOptions = {
  format?: ImageFormat;
  output?: ImageOutput;
  injectSelector?: string;
  ignoreAllSelectors?: string[];
  scale?: number;
  quality?: number;
  throwErrors?: boolean;
};

const INJECTOR_CONTAINER_ATTRIBUTE = "data-react-svg-image-injector-container";

let renderAsPromise: RenderAsPromise;
/**
 * Call this function first, passing in your own render function.
 * 
 * The argument you pass in should perform the correct ReactDOM render call,
 * and resolve to a promise when the render is complete.
 * 
 * Example for React 16 an 17:
 * ```js
 * async function renderAsPromise(el, domEl) {
 *   return new Promise((resolve) => {
 *     ReactDOM.render(el, domEl, resolve);
 *   });
 * }
 * ```
 * 
 * Example for React 18:
 * ```js
 * async function renderAsPromise(el, domEl) {
 *   const root = ReactDOM.createRoot(domEl);
 *   root.render(el);
 *   return new Promise((resolve) => {
 *     requestIdleCallback(resolve);
 *   });
 * }
 * ```
 */
export function setDomRenderer(renderer: RenderAsPromise) {
  renderAsPromise = renderer;
}

/**
 * Render a React SVG element as an image, returning a promise that resolves to
 * either a data URL or a Blob.
 *
 * You can configure the quality (default is 97), and the output format (from
 * PNG which is the default, JPEG or WEBP).
 * 
 * This function will trigger a whole new "react app" to render your component,
 * so you won't be able to use any Contexts that are not in the JSX.Element you
 * pass in.
 * 
 * By default the new react app will be rendered on the body element, but you can
 * pass in a CSS Selector for a different element if you prefer.
 */
export async function renderSvgAsImage(
  el: JSX.Element,
  {
    format = ImageFormat.PNG,
    injectSelector = "body",
    output = ImageOutput.DATA_URL,
    scale = 1,
    quality = 0.97,
    throwErrors = true,
    ignoreAllSelectors = [],
  }: RenderSvgAsImageOptions
): Promise<string | Blob> {
  try {
    if (!renderAsPromise) {
      throw new Error(
        "You must call setDomRenderer before calling renderSvgAsImage"
      );
    }
    const renderId = uuidv4();
    const injectorRoot = document.querySelector(injectSelector);
    if (!injectorRoot) {
      throw new Error(`Could not find element with selector ${injectorRoot}`);
    }
    if (!Object.values(ImageFormat).includes(format)) {
      throw new Error(`Invalid image format ${format}`);
    }
    if (!Object.values(ImageOutput).includes(output)) {
      throw new Error(`Invalid image output ${output}`);
    }
    const injectorContainer = getInjectorContainer(injectorRoot, renderId);

    try {
      await renderAsPromise(el, injectorContainer);
    } catch (e) {
      removeInjectorContainer(injectorRoot, renderId);
      console.error("Failed to render element");
      throw e;
    }

    const renderedSvg = injectorContainer.querySelector("svg");
    if (!renderedSvg) {
      removeInjectorContainer(injectorRoot, renderId);
      throw new Error("Could not find a rendered SVG");
    }

    normaliseSvg(renderedSvg, ignoreAllSelectors);

    const canvas = await copyToCanvas(renderedSvg, scale);
    let returnValue = toOutput(canvas, output, format, quality);

    removeInjectorContainer(injectorRoot, renderId);

    return returnValue;
  } catch (e) {
    if (throwErrors) {
      throw e;
    } else {
      console.error(e);
      return "";
    }
  }
}

/**
 * Create a new container we will use to render the app in, inside the
 * injectorRoot element (default is `document.body`)
 */
function getInjectorContainer(injectorRoot: Element, renderId: string) {
  const injectorContainer = document.createElement("div");
  injectorContainer.setAttribute(
    "data-react-svg-image-injector-container",
    renderId
  );
  injectorContainer.style.visibility = "hidden";
  injectorContainer.style.position = "absolute";
  injectorContainer.style.top = "0";
  injectorContainer.style.left = "0";
  injectorRoot.appendChild(injectorContainer);
  return injectorContainer;
}

/**
 * Remove the container that we added to the root
 */
function removeInjectorContainer(injectorRoot: Element, renderId: string) {
  const injectorContainer = injectorRoot.querySelector(
    `[${INJECTOR_CONTAINER_ATTRIBUTE}="${renderId}"]`
  );
  if (injectorContainer) {
    injectorRoot.removeChild(injectorContainer);
  } else {
    console.error(`Could not find injector container with id ${renderId}`);
  }
}

/**
 * Get a UUID, used to identify the container we are rendering in
 */
function uuidv4(): string {
  // @ts-ignore
  return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) =>
    (
      c ^
      (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))
    ).toString(16)
  );
}

/**
 * Normalise an SVG by removing any elements requested, and inlining styles.
 */
function normaliseSvg(svg: SVGSVGElement, ignoreAllSelectors: string[]) {
  // Strip out elements we don't want
  ignoreAllSelectors.forEach(selector => {
    const els = svg.querySelectorAll(selector);
    for (let i = 0; i < els.length; i++) {
      els[i].parentNode?.removeChild(els[i]);
    }
  });
  // Inline all styles, mutating original since it's already a clone
  inlineStyles(svg, svg);
}

/**
 * Inline all computed styles on an element, and all its children
 */
function inlineStyles(source: SVGElement, target: SVGElement) {
  // inline style from source element to the target (detached) one
  const computed = window.getComputedStyle(source);
  for (const styleKey of <any>computed) {
    if (styleKey === "visibility") {
      continue;
    }
    (<any>target.style)[styleKey] = (<any>computed)[styleKey];
  }

  // recursively call inlineStyles for the element children
  for (let i = 0; i < source.children.length; i++) {
    inlineStyles(
      source.children[i] as SVGElement,
      target.children[i] as SVGElement
    );
  }
}

/**
 * Take a an `<svg />` element, and make it display on a `<canvas />`
 */
function copyToCanvas(
  source: SVGElement,
  scale: number
): Promise<HTMLCanvasElement> {
  let svgData = new XMLSerializer().serializeToString(source);
  let canvas = document.createElement("canvas");
  let svgSize = source.getBoundingClientRect();

  //Resize can break shadows
  canvas.width = svgSize.width * scale;
  canvas.height = svgSize.height * scale;
  canvas.style.width = `${svgSize.width}px`;
  canvas.style.height = `${svgSize.height}px`;


  let ctxt = canvas.getContext("2d");
  if (!ctxt) {
    throw new Error("Could not get canvas context");
  }
  ctxt.scale(scale, scale);

  let img = document.createElement("img");
  img.setAttribute(
    "src",
    "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)))
  );
  return new Promise((resolve) => {
    img.onload = () => {
      if (!ctxt) {
        throw new Error("Could not get canvas context");
      }
      ctxt.drawImage(img, 0, 0);
      resolve(canvas);
    };
  });
}

/**
 * Convert a canvas to the appropriate output format
 */
async function toOutput(
  canvas: HTMLCanvasElement,
  output: ImageOutput,
  format: ImageFormat,
  quality: number
): Promise<string | Blob> {
  if (output === ImageOutput.DATA_URL) {
    return toDataUrl(canvas, format, quality);
  } else {
    const blob = await toBlob(canvas, format, quality);
    if (!blob) {
      throw new Error("Could not convert canvas to blob");
    }
    return blob;
  }
}

/**
 * Convert a canvas to a data url
 */
function toDataUrl(
  canvas: HTMLCanvasElement,
  format: ImageFormat,
  quality: number
): string {
  return canvas.toDataURL(`image/${format}`, quality);
}

/**
 * Convert a canvas to a blob
 */
function toBlob(
  canvas: HTMLCanvasElement,
  format: ImageFormat,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), `image/${format}`, quality);
  });
}
