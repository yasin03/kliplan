import { createContext, useContext } from "react";
import { tema } from "./tema.js";

/** Ofise özel vurgu rengi; `IlanVideosu` sağlar, bileşenler `useVurgu` ile okur. */
export const VurguRengi = createContext<string>(tema.renkler.vurgu);

export const useVurgu = () => useContext(VurguRengi);
