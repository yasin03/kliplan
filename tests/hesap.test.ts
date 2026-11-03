import { describe, expect, it } from "vitest";
import { altyaziYaziBoyutu, baslikYaziBoyutu, dikeyMi, toplamKareSayisi } from "../src/remotion/hesap.js";
import { tema } from "../src/remotion/tema.js";

describe("video hesapları", () => {
  it("geçişleri düşerek toplam kare sayısını hesaplıyor", () => {
    const sahneler = [{ sureSn: 4 }, { sureSn: 4 }, { sureSn: 5.5 }];
    expect(toplamKareSayisi(sahneler)).toBe(120 + 120 + 165 - 2 * tema.hareket.gecisKare);
    expect(toplamKareSayisi([])).toBe(0);
  });

  it("örnek Temurlar senaryosu 20-30 saniye aralığında", async () => {
    const { default: sahneler } = await import("../ilanlar/temurlar/ornek-sahneler.json", { with: { type: "json" } });
    const sn = toplamKareSayisi(sahneler) / tema.video.fps;
    expect(sn).toBeGreaterThanOrEqual(20);
    expect(sn).toBeLessThanOrEqual(30);
  });

  it("başlık uzadıkça yazı küçülüyor", () => {
    const kisa = baslikYaziBoyutu("Eşyalı salon");
    const orta = baslikYaziBoyutu("Hilton banyo, cam balkon");
    const uzun = baslikYaziBoyutu("Açık Amerikan mutfaklı, yerden ısıtmalı ve cam balkonlu daire");
    expect(kisa).toBeGreaterThan(orta);
    expect(orta).toBeGreaterThan(uzun);
    expect(uzun).toBeGreaterThanOrEqual(56);
  });

  it("Türkçe karakterleri tek karakter sayıyor", () => {
    expect(baslikYaziBoyutu("ÇĞİÖŞÜçğıöşüÇĞİÖŞÜ")).toBe(baslikYaziBoyutu("abcdefghijklmnopqr"));
  });

  it("altyazı uzadıkça yazı küçülüyor", () => {
    expect(altyaziYaziBoyutu("kısa")).toBeGreaterThan(altyaziYaziBoyutu("x".repeat(200)));
  });

  it("yalnızca 9:16'ya yakın fotoğrafları dikey sayıyor", () => {
    expect(dikeyMi(480, 928)).toBe(true);
    expect(dikeyMi(805, 1088)).toBe(false);
    expect(dikeyMi(1600, 1200)).toBe(false);
  });
});
