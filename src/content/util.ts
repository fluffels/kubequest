/* ===== Inhalte: kleine Helfer =====
 * Zufalls-Helfer, die von mehreren Inhalts-Modulen (Drills, …) gebraucht werden.
 */

/** Ein zufälliges Element aus einem Array. */
export const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

/** Zufallszahl im geschlossenen Intervall [a, b]. */
export const rnd = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
