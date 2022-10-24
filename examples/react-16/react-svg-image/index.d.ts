interface RenderAsPromise {
    (el: JSX.Element, domEl: HTMLElement): Promise<void>;
}
declare enum ImageFormat {
    PNG = "png",
    JPEG = "jpeg",
    WEBP = "webp"
}
declare enum ImageOutput {
    DATA_URL = "data_url",
    BLOB = "blob"
}
declare type RenderSvgAsImageOptions = {
    format?: ImageFormat;
    output?: ImageOutput;
    injectSelector?: string;
    ignoreAllSelectors?: string[];
    scale?: number;
    quality?: number;
    throwErrors?: boolean;
};
declare function setDomRenderer(renderer: RenderAsPromise): void;
declare function renderSvgAsImage(el: JSX.Element, { format, injectSelector, output, scale, quality, throwErrors, ignoreAllSelectors, }?: RenderSvgAsImageOptions): Promise<string | Blob>;

export { ImageFormat, ImageOutput, RenderAsPromise, RenderSvgAsImageOptions, renderSvgAsImage, setDomRenderer };
