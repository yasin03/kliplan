import { createContext, useContext } from "react";
import { type Tema, TEMALAR, VARSAYILAN_TEMA } from "./temalar.js";

export type Gorunum = { tema: Tema; vurgu: string };

/** Seçilen tema ve ofisin vurgu rengi; `IlanVideosu` sağlar, bileşenler `useGorunum` ile okur. */
export const GorunumBaglami = createContext<Gorunum>({ tema: TEMALAR[VARSAYILAN_TEMA], vurgu: TEMALAR[VARSAYILAN_TEMA].vurgu });

export const useGorunum = () => useContext(GorunumBaglami);
