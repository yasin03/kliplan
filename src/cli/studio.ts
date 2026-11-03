import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { Command } from "commander";
import { calistir, onbellekKlasoru, ornekVideoVerisiHazirla } from "./ortak.js";

const program = new Command()
  .name("studio")
  .description("Remotion Studio'da örnek sahnelerle önizleme açar.")
  .argument("<klasor>", "ilan klasörü, ör. ilanlar/temurlar")
  .option("--senaryo <dosya>", "sahne listesi JSON dosyası (varsayılan: <klasor>/ornek-sahneler.json)")
  .action((klasor: string, secenekler: { senaryo?: string }) =>
    calistir(async () => {
      const { props, publicKlasoru } = await ornekVideoVerisiHazirla(klasor, secenekler.senaryo);
      const propsYolu = path.join(onbellekKlasoru(klasor), "props.json");
      await writeFile(propsYolu, JSON.stringify(props, null, 2));

      const surec = spawn(
        "npx",
        ["remotion", "studio", "src/remotion/index.ts", `--public-dir=${publicKlasoru}`, `--props=${propsYolu}`],
        { stdio: "inherit" },
      );
      await new Promise<void>((tamam) => surec.on("exit", () => tamam()));
    }),
  );

await program.parseAsync();
