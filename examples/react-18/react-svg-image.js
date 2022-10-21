var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
export var ImageFormat;
(function (ImageFormat) {
    ImageFormat["PNG"] = "png";
    ImageFormat["JPEG"] = "jpeg";
    ImageFormat["WEBP"] = "webp";
})(ImageFormat || (ImageFormat = {}));
export var ImageOutput;
(function (ImageOutput) {
    ImageOutput["DATA_URL"] = "data_url";
    ImageOutput["BLOB"] = "blob";
})(ImageOutput || (ImageOutput = {}));
const INJECTOR_CONTAINER_ATTRIBUTE = "data-react-svg-image-injector-container";
let renderAsPromise;
export function setDomRenderer(renderer) {
    renderAsPromise = renderer;
}
export function renderSvgAsImage(el, { format = ImageFormat.PNG, injectSelector = "body", output = ImageOutput.DATA_URL, scale = 1, quality = 97, throwErrors = true, ignoreAllSelectors = [], }) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            if (!renderAsPromise) {
                throw new Error("You must call setDomRenderer before calling renderSvgAsImage");
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
                yield renderAsPromise(el, injectorContainer);
            }
            catch (e) {
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
            const canvas = yield copyToCanvas(renderedSvg, scale);
            let returnValue = toOutput(canvas, output, format, quality);
            removeInjectorContainer(injectorRoot, renderId);
            return returnValue;
        }
        catch (e) {
            if (throwErrors) {
                throw e;
            }
            else {
                console.error(e);
                return "";
            }
        }
    });
}
function getInjectorContainer(injectorRoot, renderId) {
    const injectorContainer = document.createElement("div");
    injectorContainer.setAttribute("data-react-svg-image-injector-container", renderId);
    injectorContainer.style.visibility = "hidden";
    injectorContainer.style.position = "absolute";
    injectorContainer.style.top = "0";
    injectorContainer.style.left = "0";
    injectorRoot.appendChild(injectorContainer);
    return injectorContainer;
}
function removeInjectorContainer(injectorRoot, renderId) {
    const injectorContainer = injectorRoot.querySelector(`[${INJECTOR_CONTAINER_ATTRIBUTE}="${renderId}"]`);
    if (injectorContainer) {
        injectorRoot.removeChild(injectorContainer);
    }
    else {
        console.error(`Could not find injector container with id ${renderId}`);
    }
}
function uuidv4() {
    return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) => (c ^
        (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16));
}
function normaliseSvg(svg, ignoreAllSelectors) {
    ignoreAllSelectors.forEach(selector => {
        var _a;
        const els = svg.querySelectorAll(selector);
        for (let i = 0; i < els.length; i++) {
            (_a = els[i].parentNode) === null || _a === void 0 ? void 0 : _a.removeChild(els[i]);
        }
    });
    inlineStyles(svg, svg);
}
function inlineStyles(source, target) {
    const computed = window.getComputedStyle(source);
    for (const styleKey of computed) {
        if (styleKey === "visibility") {
            continue;
        }
        target.style[styleKey] = computed[styleKey];
    }
    for (let i = 0; i < source.children.length; i++) {
        inlineStyles(source.children[i], target.children[i]);
    }
}
function copyToCanvas(source, scale) {
    let svgData = new XMLSerializer().serializeToString(source);
    let canvas = document.createElement("canvas");
    let svgSize = source.getBoundingClientRect();
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
    img.setAttribute("src", "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData))));
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
function toOutput(canvas, output, format, quality) {
    return __awaiter(this, void 0, void 0, function* () {
        if (output === ImageOutput.DATA_URL) {
            return toDataUrl(canvas, format, quality);
        }
        else {
            const blob = yield toBlob(canvas, format, quality);
            if (!blob) {
                throw new Error("Could not convert canvas to blob");
            }
            return blob;
        }
    });
}
function toDataUrl(canvas, format, quality) {
    return canvas.toDataURL(`image/${format}`, quality);
}
function toBlob(canvas, format, quality) {
    return new Promise((resolve) => {
        canvas.toBlob((blob) => resolve(blob), `image/${format}`, quality);
    });
}
