import { useEffect, useState } from "react";
import { claudeAccess, type ClaudeAccess } from "../lib/claudeWriter";
import { inClaudeViewer } from "../lib/platform";
import { useStore } from "../state/store";
import { Dialog, Switch } from "./common";

export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const { state, photos, updateSettings, catchUpRecognition, forgetEverything } = useStore();
  const { settings, models } = state;
  const [confirmForget, setConfirmForget] = useState(false);
  const [access, setAccess] = useState<ClaudeAccess>({ kind: "keiner" });
  const withoutRecognition = photos.filter((p) => p.status === "fertig" && !p.recognition).length;

  useEffect(() => {
    void claudeAccess(settings.apiKey).then(setAccess);
  }, [settings.apiKey]);

  const modelStatus =
    models === "bereit"
      ? { cls: "ok", text: "Geladen und bereit" }
      : models === "laedt"
        ? { cls: "busy", text: "Wird geladen (einmalig ca. 31 MB) …" }
        : models === "fehler"
          ? { cls: "bad", text: "Konnte nicht geladen werden" }
          : { cls: "", text: settings.recognition ? "Wird beim nächsten Foto geladen" : "Aus" };

  return (
    <Dialog title="Einstellungen" onClose={onClose}>
      <div className="field">
        <div className="toggle-row">
          <div>
            <strong>KI-Motiverkennung</strong>
            <p className="muted small">
              Erkennt Motive (z. B. Küste, Pizza, Kirche) und Objekte wie Personen, Hunde oder Autos – mit MobileNet und COCO-SSD direkt in deinem Browser. Ohne sie sortiert die App nach Datum, Ort,
              Farben und Qualität.
            </p>
          </div>
          <Switch checked={settings.recognition} onChange={(v) => updateSettings({ recognition: v })} label="KI-Motiverkennung" />
        </div>
        <div className="btn-row">
          <span className={`status ${modelStatus.cls}`}>{modelStatus.text}</span>
          {settings.recognition && withoutRecognition > 0 && (
            <button type="button" className="btn btn-small" onClick={catchUpRecognition}>
              Für {withoutRecognition} Fotos nachholen
            </button>
          )}
        </div>
      </div>

      <div className="toggle-row">
        <div>
          <strong>Ortsnamen nachschlagen</strong>
          <p className="muted small">
            Wandelt GPS-Koordinaten über OpenStreetMap in Ortsnamen um (höchstens eine Anfrage pro Erlebnis). Dabei werden nur Koordinaten gesendet, keine Bilder.
          </p>
        </div>
        <Switch checked={settings.placeNames} onChange={(v) => updateSettings({ placeNames: v })} label="Ortsnamen nachschlagen" />
      </div>

      <div className="field">
        <strong>Claude als Erzähler</strong>
        {inClaudeViewer() ? (
          <p className="muted small">
            {access.kind === "claude.ai"
              ? "Diese Seite läuft auf claude.ai – Claude schreibt über dein Konto, ein Schlüssel ist nicht nötig. Beim ersten Mal fragt claude.ai nach deiner Erlaubnis."
              : "Auf claude.ai verfügbar, sobald du es erlaubst."}
          </p>
        ) : (
          <>
            <p className="muted small">
              Mit einem API-Schlüssel von platform.claude.com kann Claude die Geschichten freier schreiben. Gesendet werden die Gliederung und je Kapitel ein kleines Vorschaubild. Der Schlüssel wird
              nur in diesem Browser gespeichert und geht direkt an Anthropic – nutze ihn nur auf deinem eigenen Gerät.
            </p>
            <input
              className="input"
              type="password"
              id="api-key"
              autoComplete="off"
              placeholder="sk-ant-…"
              value={settings.apiKey}
              onChange={(e) => updateSettings({ apiKey: e.target.value })}
              aria-label="Claude API-Schlüssel"
            />
          </>
        )}
      </div>

      <div className="field">
        <strong>Daten auf diesem Gerät</strong>
        <p className="muted small">
          Analysen (inklusive kleiner Vorschaubilder), Korrekturen und Geschichten werden nur in diesem Browser gespeichert, damit dieselben Fotos beim nächsten Mal sofort da sind.
        </p>
        {confirmForget ? (
          <div className="banner">
            <p>Alle gespeicherten Analysen, Korrekturen und Geschichten löschen?</p>
            <button type="button" className="btn btn-small" onClick={() => setConfirmForget(false)}>
              Abbrechen
            </button>
            <button
              type="button"
              className="btn btn-small"
              onClick={async () => {
                await forgetEverything();
                setConfirmForget(false);
                onClose();
              }}
            >
              Ja, alles löschen
            </button>
          </div>
        ) : (
          <div>
            <button type="button" className="btn btn-small btn-danger" onClick={() => setConfirmForget(true)}>
              Alles vergessen
            </button>
          </div>
        )}
      </div>

      <p className="credits">
        Beispielfotos von Unsplash (Unsplash-Lizenz) über picsum.photos; Aufnahmedaten und Orte der Beispiele sind erfunden. Erkennung: MobileNet v2 und COCO-SSD (Apache 2.0) mit TensorFlow.js.
      </p>
    </Dialog>
  );
}
