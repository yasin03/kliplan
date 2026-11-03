import { Config } from "@remotion/cli/config";
import { webpackAyari } from "./src/remotion/webpack.js";

Config.overrideWebpackConfig(webpackAyari);
