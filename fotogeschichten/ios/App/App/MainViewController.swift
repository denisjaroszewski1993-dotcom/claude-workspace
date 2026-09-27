import UIKit
import Capacitor

/// Startansicht der App: die Web-Oberfläche von Fotogeschichten plus das
/// eigene Modul für den direkten Zugriff auf die Fotomediathek.
class MainViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(PhotoLibraryPlugin())
    }
}
