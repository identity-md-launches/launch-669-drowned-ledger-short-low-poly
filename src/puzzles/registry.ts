import { createElement, type ComponentType } from "react";
import { ComingSoon, type PuzzleProps } from "./ComingSoon";
export { usePuzzleState } from "./usePuzzleState";
export type { PuzzleProps } from "./ComingSoon";

export interface PuzzleDefinition {
  id: string;
  title: string;
  site: { name: string; x: number; y: number; z: number };
  nightOnly: boolean;
  component: ComponentType<PuzzleProps>;
}

function placeholder(flavour: string): ComponentType<PuzzleProps> {
  return function VillageSecret(props: PuzzleProps) {
    return createElement(ComingSoon, { ...props, flavour });
  };
}

/** Swap one component here to install a puzzle. World markers and the quest log
 * derive from this registry; the host supplies onSolved={() => foundWord(id)}. */
export const puzzleRegistry: PuzzleDefinition[] = [
  {
    id: "deliveries",
    title: "The drying line",
    site: { name: "Behind the processing shed", x: -25, y: 5, z: -20 },
    nightOnly: false,
    component: placeholder(
      "The parcels drip onto a line of names. None of the names are dry.",
    ),
  },
  {
    id: "poker",
    title: "The last hand",
    site: { name: "Tavern back room", x: -29, y: 9, z: -3 },
    nightOnly: true,
    component: placeholder(
      "One place is set at the card table. The chair is still warm.",
    ),
  },
  {
    id: "minesweeper",
    title: "The rusted ring",
    site: { name: "Marker posts on the bay", x: 13, y: 2.1, z: 22 },
    nightOnly: false,
    component: placeholder(
      "Between the rusted posts, the water holds its breath.",
    ),
  },
  {
    id: "key-lockbox",
    title: "The locked notice",
    site: { name: "Village square notice board", x: -20.5, y: 4.4, z: -3 },
    nightOnly: false,
    component: placeholder(
      "A small lock keeps the notices shut. Something inside scratches back.",
    ),
  },
  {
    id: "scale",
    title: "The honest weight",
    site: { name: "Weigh-house", x: -20, y: 7, z: -23 },
    nightOnly: false,
    component: placeholder(
      "The empty pans hang unevenly. We owe the bay a little more.",
    ),
  },
  {
    id: "fortune",
    title: "Tomorrow, again",
    site: { name: "Striped tent on the pier", x: -17, y: 5, z: 17 },
    nightOnly: true,
    component: placeholder(
      "Behind the striped curtain, someone has already heard your question.",
    ),
  },
  {
    id: "jigsaw",
    title: "The sodden ledger",
    site: { name: "Customs hut table", x: -27.5, y: 7.5, z: 8.4 },
    nightOnly: false,
    component: placeholder(
      "The scraps cling to the table. In the gaps, your handwriting continues.",
    ),
  },
];
