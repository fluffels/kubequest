// Barrel: bündelt die einzelnen Phaser-Szenen-Module zu KQScenes (#345). Die Szenen liegen seit
// dem Split eine Datei je Klasse unter src/scenes/; gemeinsame Helfer in src/scenes/shared.ts.
import { BootScene } from "./scenes/BootScene";
import { WorldScene } from "./scenes/WorldScene";
import { InteriorScene } from "./scenes/InteriorScene";
import { ArchipelScene } from "./scenes/ArchipelScene";
import { LighthouseScene } from "./scenes/LighthouseScene";
import { WarehouseScene } from "./scenes/WarehouseScene";
import { TilemapTestScene } from "./scenes/TilemapTestScene";

export const KQScenes = { BootScene, WorldScene, InteriorScene, ArchipelScene, LighthouseScene, WarehouseScene, TilemapTestScene };
