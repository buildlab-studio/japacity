// How the browser tests start Chromium.

/** The world's scene needs WebGL, drawn in software where the machine has no GPU. */
export const SOFTWARE_WEBGL = { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] };
