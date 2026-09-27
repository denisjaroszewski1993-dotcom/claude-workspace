import type { CapacitorConfig } from "@capacitor/cli";

// iPhone-App: dieselbe Oberfläche wie im Browser, dazu direkter Zugriff auf
// die Fotomediathek (inklusive iCloud) über das eigene Swift-Modul
// ios/App/App/PhotoLibraryPlugin.swift.
const config: CapacitorConfig = {
  appId: "de.fotogeschichten.app",
  appName: "Fotogeschichten",
  webDir: "dist",
  ios: {
    // Die Oberfläche berücksichtigt Notch und Home-Leiste selbst (env(safe-area-inset-*)).
    contentInset: "never",
  },
};

export default config;
