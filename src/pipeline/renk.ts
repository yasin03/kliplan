/** Fiyat vurgu renginde 104 px yazılır; WCAG'ın büyük yazı sınırı (3:1) yeterli. */
export const EN_AZ_KONTRAST = 3;

/** WCAG 2.1 göreli parlaklık, `#RRGGBB` için. */
function parlaklik(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function kontrastOrani(a: string, b: string): number {
  const [acik, koyu] = [parlaklik(a), parlaklik(b)].sort((x, y) => y - x) as [number, number];
  return (acik + 0.05) / (koyu + 0.05);
}
