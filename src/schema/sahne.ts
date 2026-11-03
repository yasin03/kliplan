import { z } from "zod";

export const sahneSemasi = z.strictObject({
  fotograf: z.string().trim().min(1),
  baslik: z.string().trim().min(1),
  disSes: z.string().trim().min(1),
  altyazi: z.string().trim().min(1).optional(),
  sureSn: z.number().min(1).max(10),
});

export const sahneListesiSemasi = z.array(sahneSemasi).min(2);

/** Sahne listesi tek başına ya da `senaryo.json` içindeki `sahneler` alanı olarak verilebilir. */
export const sahneDosyasiSemasi = z.union([sahneListesiSemasi, z.object({ sahneler: sahneListesiSemasi }).transform((d) => d.sahneler)]);
