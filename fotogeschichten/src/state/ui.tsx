import { createContext, useContext } from "react";
import type { CategoryId, StorySource } from "../types";

export type PickKind = "fotos" | "ordner" | "zip";

export type Tab = "uebersicht" | "fotos" | "zeitleiste" | "erlebnisse" | "geschichten" | "aufraeumen";

export interface UiActions {
  setTab(tab: Tab): void;
  showCategory(id: CategoryId | "alle"): void;
  openPhoto(id: string, list: string[]): void;
  openCreator(source?: StorySource, photoIds?: string[]): void;
  openStory(id: string): void;
  openExport(): void;
  openSettings(): void;
  openImport(): void;
  pickFiles(kind: PickKind): void;
}

export const UiContext = createContext<UiActions | null>(null);

export function useUi(): UiActions {
  const ui = useContext(UiContext);
  if (!ui) throw new Error("useUi außerhalb der App");
  return ui;
}
