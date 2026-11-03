import type { WebpackOverrideFn } from "@remotion/bundler";

/** Proje NodeNext kullandığı için importlar `.js` uzantılı; webpack'in bunları `.ts/.tsx` olarak çözmesini sağlar. */
export const webpackAyari: WebpackOverrideFn = (ayar) => ({
  ...ayar,
  resolve: {
    ...ayar.resolve,
    extensionAlias: { ".js": [".tsx", ".ts", ".js"] },
  },
});
