import Foundation
import UIKit
import Photos
import CoreLocation
import Capacitor

/// Direkter Zugriff auf die Fotomediathek des iPhones – inklusive der Fotos,
/// die nur in iCloud liegen (sie werden bei Bedarf automatisch geladen).
///
/// Die Web-Oberfläche bekommt keine Bilddaten über die Brücke geschickt,
/// sondern Pfade zu verkleinerten JPEG-Dateien, die das Modul auf dem Gerät
/// ablegt. Das hält auch große Mediatheken schnell und speichersparsam.
@objc(PhotoLibraryPlugin)
public class PhotoLibraryPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "PhotoLibraryPlugin"
    public let jsName = "PhotoLibrary"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "checkAccess", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestAccess", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openSettings", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "manageLimitedSelection", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getAlbums", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getAssets", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getImage", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "existingImages", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getOriginal", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "addToAlbum", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "deleteAlbums", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "share", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "keepAwake", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearCache", returnType: CAPPluginReturnPromise)
    ]

    private let imageManager = PHImageManager.default()
    private let workQueue = DispatchQueue(label: "de.fotogeschichten.photolibrary", qos: .userInitiated, attributes: .concurrent)

    /// Vorschaubilder (bis 512 px) bleiben dauerhaft liegen, größere Fassungen
    /// und Originale nur im Zwischenspeicher, den iOS bei Platzmangel leert.
    private let thumbnailDirectory: URL = PhotoLibraryPlugin.makeDirectory(.applicationSupportDirectory, "Fotogeschichten/Vorschau")
    private let cacheDirectory: URL = PhotoLibraryPlugin.makeDirectory(.cachesDirectory, "Fotogeschichten")

    private static func makeDirectory(_ base: FileManager.SearchPathDirectory, _ path: String) -> URL {
        let root = FileManager.default.urls(for: base, in: .userDomainMask)[0]
        let url = root.appendingPathComponent(path, isDirectory: true)
        try? FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        return url
    }

    // MARK: - Zugriff

    private func statusName(_ status: PHAuthorizationStatus) -> String {
        switch status {
        case .authorized: return "authorized"
        case .limited: return "limited"
        case .denied: return "denied"
        case .restricted: return "restricted"
        case .notDetermined: return "notDetermined"
        @unknown default: return "denied"
        }
    }

    @objc func checkAccess(_ call: CAPPluginCall) {
        call.resolve(["status": statusName(PHPhotoLibrary.authorizationStatus(for: .readWrite))])
    }

    @objc func requestAccess(_ call: CAPPluginCall) {
        PHPhotoLibrary.requestAuthorization(for: .readWrite) { status in
            call.resolve(["status": self.statusName(status)])
        }
    }

    @objc func openSettings(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if let url = URL(string: UIApplication.openSettingsURLString) {
                UIApplication.shared.open(url)
            }
            call.resolve()
        }
    }

    /// Bei "Ausgewählte Fotos" kann man die Auswahl hier erweitern.
    @objc func manageLimitedSelection(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let viewController = self.bridge?.viewController else {
                call.reject("Die Ansicht ist nicht bereit.")
                return
            }
            PHPhotoLibrary.shared().presentLimitedLibraryPicker(from: viewController) { identifiers in
                call.resolve(["count": identifiers.count])
            }
        }
    }

    // MARK: - Alben und Fotos auflisten

    private func imagesOnly() -> PHFetchOptions {
        let options = PHFetchOptions()
        options.predicate = NSPredicate(format: "mediaType == %d", PHAssetMediaType.image.rawValue)
        return options
    }

    @objc func getAlbums(_ call: CAPPluginCall) {
        workQueue.async {
            var albums: [[String: Any]] = []
            let collect = { (result: PHFetchResult<PHAssetCollection>, kind: String) in
                result.enumerateObjects { collection, _, _ in
                    if collection.assetCollectionSubtype == .smartAlbumAllHidden { return }
                    let count = PHAsset.fetchAssets(in: collection, options: self.imagesOnly()).count
                    if count == 0 { return }
                    albums.append([
                        "id": collection.localIdentifier,
                        "title": collection.localizedTitle ?? "Album",
                        "count": count,
                        "kind": kind
                    ])
                }
            }
            collect(PHAssetCollection.fetchAssetCollections(with: .smartAlbum, subtype: .any, options: nil), "smart")
            collect(PHAssetCollection.fetchAssetCollections(with: .album, subtype: .any, options: nil), "album")
            call.resolve(["albums": albums])
        }
    }

    /// Fotos seitenweise, neueste zuerst. Optional nur ein Album oder ein Zeitraum.
    @objc func getAssets(_ call: CAPPluginCall) {
        let offset = max(0, call.getInt("offset") ?? 0)
        let limit = max(1, min(call.getInt("limit") ?? 300, 2000))
        let albumId = call.getString("albumId")
        let since = call.getDouble("since")
        let until = call.getDouble("until")

        workQueue.async {
            let options = PHFetchOptions()
            var predicates = [NSPredicate(format: "mediaType == %d", PHAssetMediaType.image.rawValue)]
            if let since = since {
                predicates.append(NSPredicate(format: "creationDate >= %@", Date(timeIntervalSince1970: since / 1000) as NSDate))
            }
            if let until = until {
                predicates.append(NSPredicate(format: "creationDate < %@", Date(timeIntervalSince1970: until / 1000) as NSDate))
            }
            options.predicate = NSCompoundPredicate(andPredicateWithSubpredicates: predicates)
            options.sortDescriptors = [NSSortDescriptor(key: "creationDate", ascending: false)]

            let result: PHFetchResult<PHAsset>
            if let albumId = albumId {
                guard let album = PHAssetCollection.fetchAssetCollections(withLocalIdentifiers: [albumId], options: nil).firstObject else {
                    call.reject("Das Album wurde nicht gefunden.", "NOT_FOUND")
                    return
                }
                result = PHAsset.fetchAssets(in: album, options: options)
            } else {
                result = PHAsset.fetchAssets(with: options)
            }

            let total = result.count
            var assets: [[String: Any]] = []
            if offset < total {
                let end = min(total, offset + limit)
                for asset in result.objects(at: IndexSet(integersIn: offset..<end)) {
                    assets.append(self.describe(asset))
                }
            }
            call.resolve(["total": total, "assets": assets])
        }
    }

    /// Bewusst ohne Dateinamen: PHAssetResource kostet pro Foto einige Millisekunden –
    /// bei zehntausenden Fotos wären das Minuten bei jedem Start. Die App benennt
    /// Mediathek-Fotos stattdessen nach dem Aufnahmedatum.
    private func describe(_ asset: PHAsset) -> [String: Any] {
        var info: [String: Any] = [
            "id": asset.localIdentifier,
            "width": asset.pixelWidth,
            "height": asset.pixelHeight,
            "isFavorite": asset.isFavorite,
            "isScreenshot": asset.mediaSubtypes.contains(.photoScreenshot)
        ]
        if let date = asset.creationDate {
            info["creationDate"] = date.timeIntervalSince1970 * 1000
        }
        if let location = asset.location, CLLocationCoordinate2DIsValid(location.coordinate) {
            info["latitude"] = location.coordinate.latitude
            info["longitude"] = location.coordinate.longitude
        }
        if let burst = asset.burstIdentifier {
            info["burstId"] = burst
        }
        return info
    }

    // MARK: - Bilddaten

    private func fileKey(_ id: String) -> String {
        let allowed = CharacterSet.alphanumerics
        return String(id.unicodeScalars.map { allowed.contains($0) ? Character($0) : "_" })
    }

    private func imageFile(_ id: String, _ maxSize: Int) -> URL {
        let directory = maxSize <= 512 ? thumbnailDirectory : cacheDirectory
        return directory.appendingPathComponent("\(fileKey(id))-\(maxSize).jpg")
    }

    private func fileResult(_ url: URL, extra: [String: Any] = [:]) -> [String: Any] {
        var result = extra
        result["path"] = url.path
        result["webPath"] = bridge?.portablePath(fromLocalURL: url)?.absoluteString ?? url.absoluteString
        return result
    }

    /// Verkleinerte JPEG-Fassung eines Fotos; lädt es bei Bedarf aus iCloud.
    @objc func getImage(_ call: CAPPluginCall) {
        guard let id = call.getString("id") else {
            call.reject("Es fehlt die Foto-ID.")
            return
        }
        let maxSize = max(64, min(call.getInt("maxSize") ?? 512, 4096))
        let quality = CGFloat(call.getDouble("quality") ?? 0.8)
        let file = imageFile(id, maxSize)
        if FileManager.default.fileExists(atPath: file.path) {
            call.resolve(fileResult(file))
            return
        }
        guard let asset = PHAsset.fetchAssets(withLocalIdentifiers: [id], options: nil).firstObject else {
            call.reject("Das Foto ist nicht mehr in der Mediathek.", "NOT_FOUND")
            return
        }

        let options = PHImageRequestOptions()
        options.deliveryMode = .highQualityFormat
        options.resizeMode = .exact
        options.isNetworkAccessAllowed = true
        options.version = .current

        let longest = CGFloat(max(asset.pixelWidth, asset.pixelHeight, 1))
        let scale = min(1, CGFloat(maxSize) / longest)
        let target = CGSize(width: max(1, (CGFloat(asset.pixelWidth) * scale).rounded()),
                            height: max(1, (CGFloat(asset.pixelHeight) * scale).rounded()))

        imageManager.requestImage(for: asset, targetSize: target, contentMode: .aspectFit, options: options) { image, info in
            if (info?[PHImageCancelledKey] as? Bool) == true {
                call.reject("Abgebrochen.", "CANCELLED")
                return
            }
            if let error = info?[PHImageErrorKey] as? Error {
                call.reject("Das Foto konnte nicht geladen werden – vielleicht keine Verbindung zu iCloud.", "LOAD_FAILED", error)
                return
            }
            guard let image = image else {
                call.reject("Das Foto konnte nicht geladen werden.", "LOAD_FAILED")
                return
            }
            self.workQueue.async {
                guard let data = image.jpegData(compressionQuality: quality) else {
                    call.reject("Das Foto konnte nicht umgewandelt werden.", "ENCODE_FAILED")
                    return
                }
                do {
                    try data.write(to: file, options: .atomic)
                    call.resolve(self.fileResult(file))
                } catch {
                    call.reject("Das Foto konnte nicht zwischengespeichert werden.", "WRITE_FAILED", error)
                }
            }
        }
    }

    /// Welche Vorschaubilder liegen schon bereit? Spart beim Start tausende Einzelaufrufe.
    @objc func existingImages(_ call: CAPPluginCall) {
        let ids = call.getArray("ids", String.self) ?? []
        let maxSize = max(64, min(call.getInt("maxSize") ?? 512, 4096))
        workQueue.async {
            var found: [String: Any] = [:]
            for id in ids {
                let file = self.imageFile(id, maxSize)
                if FileManager.default.fileExists(atPath: file.path) {
                    found[id] = self.bridge?.portablePath(fromLocalURL: file)?.absoluteString ?? file.absoluteString
                }
            }
            call.resolve(["images": found])
        }
    }

    /// Originaldatei (z. B. HEIC) – für die Weitergabe in voller Qualität.
    @objc func getOriginal(_ call: CAPPluginCall) {
        guard let id = call.getString("id"),
              let asset = PHAsset.fetchAssets(withLocalIdentifiers: [id], options: nil).firstObject else {
            call.reject("Das Foto ist nicht mehr in der Mediathek.", "NOT_FOUND")
            return
        }
        let fileName = PHAssetResource.assetResources(for: asset).first?.originalFilename ?? "\(fileKey(id)).jpg"
        let options = PHImageRequestOptions()
        options.deliveryMode = .highQualityFormat
        options.isNetworkAccessAllowed = true
        options.version = .current
        imageManager.requestImageDataAndOrientation(for: asset, options: options) { data, _, _, info in
            if let error = info?[PHImageErrorKey] as? Error {
                call.reject("Das Original konnte nicht geladen werden.", "LOAD_FAILED", error)
                return
            }
            guard let data = data else {
                call.reject("Das Original konnte nicht geladen werden.", "LOAD_FAILED")
                return
            }
            let folder = self.cacheDirectory.appendingPathComponent("Originale", isDirectory: true)
            try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
            let file = folder.appendingPathComponent("\(self.fileKey(id))-\(fileName)")
            do {
                try data.write(to: file, options: .atomic)
                call.resolve(self.fileResult(file, extra: ["fileName": fileName, "size": data.count]))
            } catch {
                call.reject("Das Original konnte nicht gespeichert werden.", "WRITE_FAILED", error)
            }
        }
    }

    // MARK: - In Alben sortieren

    private func regularAlbums() -> [PHAssetCollection] {
        var albums: [PHAssetCollection] = []
        PHAssetCollection.fetchAssetCollections(with: .album, subtype: .albumRegular, options: nil)
            .enumerateObjects { collection, _, _ in albums.append(collection) }
        return albums
    }

    private func findOrCreateAlbum(title: String, completion: @escaping (PHAssetCollection?, Error?) -> Void) {
        if let existing = regularAlbums().first(where: { $0.localizedTitle == title }) {
            completion(existing, nil)
            return
        }
        var placeholder: PHObjectPlaceholder?
        PHPhotoLibrary.shared().performChanges({
            let request = PHAssetCollectionChangeRequest.creationRequestForAssetCollection(withTitle: title)
            placeholder = request.placeholderForCreatedAssetCollection
        }, completionHandler: { success, error in
            guard success,
                  let id = placeholder?.localIdentifier,
                  let album = PHAssetCollection.fetchAssetCollections(withLocalIdentifiers: [id], options: nil).firstObject else {
                completion(nil, error)
                return
            }
            completion(album, nil)
        })
    }

    /// Legt ein Album an (oder nutzt ein vorhandenes gleichen Namens) und fügt Fotos hinzu.
    /// Die Fotos werden dabei nicht kopiert – ein Foto kann in vielen Alben stehen.
    @objc func addToAlbum(_ call: CAPPluginCall) {
        guard let title = call.getString("title"), !title.isEmpty else {
            call.reject("Es fehlt der Albumname.")
            return
        }
        let ids = call.getArray("ids", String.self) ?? []
        guard PHPhotoLibrary.authorizationStatus(for: .readWrite) == .authorized else {
            call.reject("Zum Anlegen von Alben braucht die App Zugriff auf alle Fotos.", "NOT_AUTHORIZED")
            return
        }
        findOrCreateAlbum(title: title) { album, error in
            guard let album = album else {
                call.reject("Das Album „\(title)“ konnte nicht angelegt werden.", "ALBUM_FAILED", error)
                return
            }
            let assets = PHAsset.fetchAssets(withLocalIdentifiers: ids, options: nil)
            PHPhotoLibrary.shared().performChanges({
                PHAssetCollectionChangeRequest(for: album)?.addAssets(assets)
            }, completionHandler: { success, error in
                if success {
                    call.resolve(["albumId": album.localIdentifier, "added": assets.count])
                } else {
                    call.reject("Die Fotos konnten nicht zum Album hinzugefügt werden.", "ALBUM_FAILED", error)
                }
            })
        }
    }

    /// Entfernt die von der App angelegten Alben wieder. Die Fotos selbst bleiben.
    /// iOS fragt dabei selbst noch einmal nach.
    @objc func deleteAlbums(_ call: CAPPluginCall) {
        guard let prefix = call.getString("prefix"), !prefix.isEmpty else {
            call.reject("Es fehlt der Namensanfang der Alben.")
            return
        }
        let albums = regularAlbums().filter { ($0.localizedTitle ?? "").hasPrefix(prefix) }
        if albums.isEmpty {
            call.resolve(["deleted": 0])
            return
        }
        PHPhotoLibrary.shared().performChanges({
            PHAssetCollectionChangeRequest.deleteAssetCollections(albums as NSArray)
        }, completionHandler: { success, error in
            if success {
                call.resolve(["deleted": albums.count])
            } else {
                call.reject("Die Alben wurden nicht entfernt.", "DELETE_FAILED", error)
            }
        })
    }

    // MARK: - Teilen und Sonstiges

    /// Öffnet das Teilen-Menü für eine Datei (z. B. eine Geschichte als HTML).
    @objc func share(_ call: CAPPluginCall) {
        guard let fileName = call.getString("fileName"),
              let base64 = call.getString("data"),
              let data = Data(base64Encoded: base64) else {
            call.reject("Die Datei ist unvollständig.")
            return
        }
        let safeName = fileName.replacingOccurrences(of: "/", with: "-")
        let folder = cacheDirectory.appendingPathComponent("Teilen", isDirectory: true)
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        let file = folder.appendingPathComponent(safeName)
        do {
            try data.write(to: file, options: .atomic)
        } catch {
            call.reject("Die Datei konnte nicht vorbereitet werden.", "WRITE_FAILED", error)
            return
        }
        DispatchQueue.main.async {
            guard let viewController = self.bridge?.viewController else {
                call.reject("Die Ansicht ist nicht bereit.")
                return
            }
            let activity = UIActivityViewController(activityItems: [file], applicationActivities: nil)
            if let popover = activity.popoverPresentationController {
                popover.sourceView = viewController.view
                popover.sourceRect = CGRect(x: viewController.view.bounds.midX, y: viewController.view.bounds.midY, width: 0, height: 0)
                popover.permittedArrowDirections = []
            }
            activity.completionWithItemsHandler = { _, completed, _, error in
                if let error = error {
                    call.reject("Teilen hat nicht geklappt.", "SHARE_FAILED", error)
                } else {
                    call.resolve(["completed": completed])
                }
            }
            viewController.present(activity, animated: true)
        }
    }

    /// Hält den Bildschirm während langer Analysen an.
    @objc func keepAwake(_ call: CAPPluginCall) {
        let enabled = call.getBool("enabled") ?? false
        DispatchQueue.main.async {
            UIApplication.shared.isIdleTimerDisabled = enabled
            call.resolve()
        }
    }

    @objc func clearCache(_ call: CAPPluginCall) {
        workQueue.async {
            for directory in [self.thumbnailDirectory, self.cacheDirectory] {
                let items = (try? FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil)) ?? []
                for item in items {
                    try? FileManager.default.removeItem(at: item)
                }
            }
            call.resolve()
        }
    }
}
