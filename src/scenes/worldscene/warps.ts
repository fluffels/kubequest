/* ===== KubeQuest – WorldScene-Warps (worldscene/warps.ts) =====
 * Schritt des WorldScene.ts-Splits (#393). Hier liegt das Übergangs-System der
 * Hauptkarte: Häuser/Schiff betreten (#6) und das Übersetzen auf die anderen
 * Szenen – GitOps-Archipel (#92), Monitoring-Leuchtturm (#111) und Lagerhallen-
 * Viertel (#124) – plus das pro-Frame „Scharfmachen" der Warp-Gates gegen
 * Pingpong (updateWarps), das die update()-Schleife aufruft.
 *
 * Freie Funktionen mit der Szene als Parameter; das Phaser-Anfassen (scene.scene.
 * launch/sleep, SFX) bleibt damit in EINER Hand, die Übergangs-Logik aber in einem
 * eigenen, fokussierten Modul.
 */
import { warpAt, WORLD_TO_ARCHIPEL, WORLD_RETURN } from "../../archipel";
import { WORLD_TO_LIGHTHOUSE, WORLD_RETURN_LH } from "../../lighthouse";
import { WORLD_TO_WAREHOUSE, WORLD_RETURN_WH } from "../../warehouse";
import { keys, setInteriorOpen } from "../../runtime";
import { findDoorAt, type Door } from "../../world";
import { SFX } from "../../sfx";
import { T } from "../shared";
import type { WorldSceneLike } from "./types";

/** #6: Haus betreten – WorldScene schlafen legen (friert + blendet sie aus)
 *  und die InteriorScene als eigene Szene starten. Der Spieler wird vorher
 *  vor die Tür gesetzt, damit ein Speichern/Neuladen draußen landet (sonst
 *  würde man beim Laden direkt wieder in der Tür stehen). */
export function enterInterior(scene: WorldSceneLike, door: Door) {
  const pl = scene.playerPos;
  pl.x = door.tx * T + 8;
  pl.y = (door.ty + 1) * T + 4;   // eine Kachel unter der Tür, draußen
  pl.face = "south"; pl.moving = false;
  SFX.door();
  setInteriorOpen(true);
  scene.scene.launch("Interior", { door });
  scene.scene.sleep();
}

/** #92: Zum GitOps-Archipel übersetzen – analog zu enterInterior. Der Spieler
 *  wird vorher auf den Steg vor dem Anker zurückgesetzt (WORLD_RETURN), damit
 *  man symmetrisch dort ankommt, wo man abgelegt hat, ein Speichern/Neuladen
 *  draußen landet – und der Warp NICHT sofort erneut triggert: das Gate wird
 *  disarmt, bis die Lauftaste nach der Rückkehr einmal losgelassen wurde. */
export function enterArchipel(scene: WorldSceneLike) {
  const pl = scene.playerPos;
  pl.x = WORLD_RETURN.tx * T + 8;
  pl.y = WORLD_RETURN.ty * T + 8;
  pl.face = "north"; pl.moving = false;
  scene.archipelArmed = false;
  SFX.door();
  setInteriorOpen(true);
  scene.scene.launch("Archipel");
  scene.scene.sleep();
}

/** #111: Zur Monitoring-Leuchtturm-Klippe hinaufsteigen – analog zu enterArchipel.
 *  Der Spieler wird vorher auf die Kachel unter dem Aufgang zurückgesetzt
 *  (WORLD_RETURN_LH), damit er bei der Rückkehr symmetrisch dort ankommt und der
 *  Warp NICHT sofort erneut triggert; das Gate wird disarmt bis zum Loslassen. */
export function enterLighthouse(scene: WorldSceneLike) {
  const pl = scene.playerPos;
  pl.x = WORLD_RETURN_LH.tx * T + 8;
  pl.y = WORLD_RETURN_LH.ty * T + 8;
  pl.face = "north"; pl.moving = false;
  scene.lighthouseArmed = false;
  SFX.door();
  setInteriorOpen(true);
  scene.scene.launch("Lighthouse");
  scene.scene.sleep();
}

/** #124: Ins Lagerhallen-Viertel übersetzen – analog zu enterArchipel/enterLighthouse.
 *  Rücksetzen auf die Planken vor dem Anleger (WORLD_RETURN_WH), Gate disarmen. */
export function enterWarehouse(scene: WorldSceneLike) {
  const pl = scene.playerPos;
  pl.x = WORLD_RETURN_WH.tx * T + 8;
  pl.y = WORLD_RETURN_WH.ty * T + 8;
  pl.face = "north"; pl.moving = false;
  scene.warehouseArmed = false;
  SFX.door();
  setInteriorOpen(true);
  scene.scene.launch("Warehouse");
  scene.scene.sleep();
}

/** Pro Frame aus update(): die Warp-Gates „scharf machen" und bei Betreten einer
 *  Tür-/Warp-Kachel die Zielszene starten. Gibt true zurück, wenn ein
 *  Szenenwechsel ausgelöst wurde – dann überspringt update() den Rest des Frames
 *  (wie früher das inline `return`).
 *
 *  #92: Archipel-Anleger „scharf machen". Der Warp darf erst auslösen, wenn der
 *  Spieler die Lauftaste seit der Ankunft losgelassen hat UND nicht schon auf der
 *  Anker-Kachel steht – sonst pingpongt man mit gehaltener Taste sofort wieder
 *  zurück (Review-Feedback). Bei der Rückkehr landet man eine Kachel vor dem
 *  Anker, also disarmt enterArchipel() das Gate bewusst. #111 (Leuchtturm-Aufgang)
 *  und #124 (Lager-Anleger) nutzen dasselbe Anti-Pingpong-Gate. */
export function updateWarps(scene: WorldSceneLike, blocked: boolean): boolean {
  const pl = scene.playerPos;
  const onArchWarp = warpAt(pl.x, pl.y, WORLD_TO_ARCHIPEL);
  const moveKeyDown = !!(keys["w"] || keys["s"] || keys["a"] || keys["d"] ||
    keys["ArrowUp"] || keys["ArrowDown"] || keys["ArrowLeft"] || keys["ArrowRight"]);
  if (!moveKeyDown && !onArchWarp) scene.archipelArmed = true;

  const onLhWarp = warpAt(pl.x, pl.y, WORLD_TO_LIGHTHOUSE);
  if (!moveKeyDown && !onLhWarp) scene.lighthouseArmed = true;

  const onWhWarp = warpAt(pl.x, pl.y, WORLD_TO_WAREHOUSE);
  if (!moveKeyDown && !onWhWarp) scene.warehouseArmed = true;

  // #6/#194: Auf einer Tür-Kachel? -> Haus/Schiff betreten (Rest dieses Frames
  // überspringen). scene.doors kommt aus dem Tiled-Objektlayer (Datenpfad) bzw.
  // den Code-Eingängen (Default) – findDoorAt prüft generisch dagegen.
  if (!blocked) {
    const door = findDoorAt(scene.doors as Door[], pl.x, pl.y);
    if (door) { enterInterior(scene, door); return true; }
    if (scene.archipelArmed && onArchWarp) { enterArchipel(scene); return true; }
    if (scene.lighthouseArmed && onLhWarp) { enterLighthouse(scene); return true; }
    if (scene.warehouseArmed && onWhWarp) { enterWarehouse(scene); return true; }
  }
  return false;
}
