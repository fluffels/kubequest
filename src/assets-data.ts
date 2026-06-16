/* Spritesheets/Grafiken als ES-Modul-Imports statt handgepflegtem Base64.
 * Dieselbe Quelle versorgt beide Build-Wege (Ticket #58): Im Dev-Server und im
 * Host-Build (`npm run build`) gibt Vite eine URL zurück (Asset bleibt eine eigene,
 * cachebare Datei); im Offline-Build (`npm run build:offline`, vite-plugin-singlefile)
 * eine inline Base64-Data-URI – so bleibt der Doppelklick-Offline-Build self-contained,
 * ohne dass Base64 von Hand gepflegt wird.
 * Die PNGs in assets/ sind damit die einzige Quelle. Schlüssel = wie in scenes.ts/ui.ts
 * referenziert; Mapping der Tileset-Schlüssel auf Dateinamen siehe assets/pixellab/README.md. */

// Kenney-Spritesheets (Tiny Town / Tiny Dungeon, CC0)
import town from "../assets/town.png";
import dungeon from "../assets/dungeon.png";
import creatures from "../assets/creatures.png";

// PixelLab Wang-Tilesets (water-sand = coast, sand-grass = meadow, grass-dirt = path, …)
import coast from "../assets/pixellab/water-sand.png";
import meadow from "../assets/pixellab/sand-grass.png";
import path from "../assets/pixellab/grass-dirt.png";
import kai from "../assets/pixellab/water-stone.png";
import dock from "../assets/pixellab/water-wood.png";

// PixelLab-Objekte
import flowers from "../assets/pixellab/flowers.png";
import tree from "../assets/pixellab/tree.png";
import pine from "../assets/pixellab/pine.png";
import bush from "../assets/pixellab/bush.png";
import rock from "../assets/pixellab/rock.png";
import barrel from "../assets/pixellab/barrel.png";
import crate from "../assets/pixellab/crate.png";
import well from "../assets/pixellab/well.png";
import stall from "../assets/pixellab/stall.png";
import lamppost from "../assets/pixellab/lamppost.png";
import mushroom from "../assets/pixellab/mushroom.png";
import seashell from "../assets/pixellab/seashell.png";
import driftwood from "../assets/pixellab/driftwood.png";
import signpost from "../assets/pixellab/signpost.png";
import sign from "../assets/pixellab/sign.png";
import lighthouse from "../assets/pixellab/lighthouse.png";
import house_office from "../assets/pixellab/house_office.png";
import house_forge from "../assets/pixellab/house_forge.png";
import house_chart from "../assets/pixellab/house_chart.png";
import ship from "../assets/pixellab/ship.png";

// PixelLab-Figuren (nur south-Frame genutzt)
import char_player from "../assets/pixellab/char_player.png";
import char_player_east from "../assets/pixellab/char_player_east.png";
import char_player_north from "../assets/pixellab/char_player_north.png";
import char_player_west from "../assets/pixellab/char_player_west.png";
import char_ole from "../assets/pixellab/char_ole.png";
import char_runa from "../assets/pixellab/char_runa.png";
import char_pelle from "../assets/pixellab/char_pelle.png";
import char_bo from "../assets/pixellab/char_bo.png";
import char_ada from "../assets/pixellab/char_ada.png";
import char_theo from "../assets/pixellab/char_theo.png";
import char_kralle from "../assets/pixellab/char_kralle.png";
import char_juno from "../assets/pixellab/char_juno.png";

// PixelLab-Shop-Haustiere
import pet_ratte from "../assets/pixellab/pet_ratte.png";
import pet_fledermaus from "../assets/pixellab/pet_fledermaus.png";
import pet_geist from "../assets/pixellab/pet_geist.png";

export const KQAssets = {
  town, dungeon, creatures,
  coast, meadow, path, kai, dock,
  flowers, tree, pine, bush, rock, barrel, crate, well, stall, lamppost,
  mushroom, seashell, driftwood,
  signpost, sign, lighthouse, house_office, house_forge, house_chart, ship,
  char_player, char_player_east, char_player_north, char_player_west,
  char_ole, char_runa, char_pelle, char_bo, char_ada, char_theo, char_kralle, char_juno,
  pet_ratte, pet_fledermaus, pet_geist,
};
