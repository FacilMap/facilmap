const messagesDe = {
	"about-dialog": {
		"header": `Über FacilMap {{version}}`,
		"license-text": `{{facilmap}} is unter der {{license}} verfügbar.`,
		"license-text-facilmap": `FacilMap`,
		"license-text-license": `GNU Affero General Public License, Version 3`,
		"issues-text": `Bitte melden Sie Fehler und Verbesserungsvorschläge auf {{tracker}}.`,
		"issues-text-tracker": `GitHub`,
		"help-text": `Wenn Sie Fragen haben, schauen Sie sich die {{documentation}} an, schreiben Sie ins {{discussions}} oder fragen im {{chat}}.`,
		"help-text-documentation": `Dokumentation`,
		"help-text-discussions": `Forum`,
		"help-text-chat": `Matrix-Chat`,
		"privacy-information": `Informationen zum Datenschutz`,
		"map-data": `Kartendaten`,
		"map-data-search": `Suche`,
		"map-data-pois": `POIs`,
		"map-data-directions": `Routenberechnung`,
		"map-data-geoip": `GeoIP`,
		"map-data-geoip-description": `Dieses Produkt enthält GeoLite2-Daten von Maxmind, verfügbar unter {{maxmind}}.`,
		"attribution-osm-contributors": `OSM-Mitwirkende`,
		"programs-libraries": `Programme/Bibliotheken`,
		"icons": `Symbole`
	},

	"click-marker-tab": {
		"look-up-error": `Fehler beim Laden der Geoinformationen`
	},

	"client-provider": {
		"loading-map-header": `Karte wird geladen`,
		"loading-map": `Karte wird geladen…`,
		"connecting-header": `Verbindung wird hergestellt`,
		"connecting": `Verbindung mit dem Server wird hergestellt…`,
		"map-deleted-header": `Karte gelöscht`,
		"map-deleted": `Die Karte wurde gelöscht.`,
		"close-map": `Karte schließen`,
		"connection-error": `Bei der Verbindung zum Server ist ein Fehler aufgetreten`,
		"open-map-error": `Beim Öffnen der Karte ist ein Fehler aufgetreten`,
		"disconnected-header": `Verbindung unterbrochen`,
		"disconnected": `Die Verbindung zum Server ist verloren gegangen. Verbindung wird wiederhergestellt…`
	},

	"edit-filter-dialog": {
		"title": `Filter`,
		"apply": `Anwenden`,
		"introduction": `Hier können Sie eine Filterformel festlegen, die definiert, welche Marker/Linien basierend auf ihren Attributen angezeigt/versteckt werden sollen. Die Filterformel beeinflusst nur Ihre persönliche Ansicht der Karte, sie kann jedoch als Teil einer gespeicherten Ansicht oder eines geteilten Links wiederverwendet werden.`,
		"syntax-header": `Syntax`,
		"variable": `Variable`,
		"operator": `Operator`,
		"description": `Beschreibung`,
		"example": `Beispiel`,
		"name-description": `Name des Markers oder der Linie`,
		"type-description": `Art des Objekts: {{marker}} (Marker) / {{line}} (Linie)`,
		"typeId-description": `Typ des Objekts: {{items}})`,
		"typeId-description-item": `{{typeId}} ({{typeName}})`,
		"typeId-description-separator": ` / `,
		"data-description-1": `Feldwerte (Beispiel: {{example1}} oder {{example2}}).`,
		"data-description-2": `Für Checkbox-Felder ist der Wert {{uncheckedValue}} (nicht selektiert) oder {{checkedValue}} (selektiert).`,
		"lon-lat-description": `Koordinaten des Markers`,
		"colour-description": `Farbe des Markers oder der Linie`,
		"size-description": `Größe des Markers`,
		"symbol-description": `Symbol des Markers`,
		"shape-description": `Form des Markers`,
		"ele-description": `Höhe über NN des Markers`,
		"mode-description": `Routenmethode der Linie (z.\u202fB. {{straight}} (Luftlinie) / {{car}} (Auto) / {{bicycle}} (Fahrrad) / {{pedestrian}} (zu Fuß) / {{track}} (importierter GPX-Track))`,
		"width-description": `Dicke der Linie`,
		"stroke-description": `Kontur der Linie ({{solid}} (durchgezogen) / {{dashed}} (gestrichelt) / {{dotted}} (gepunktet))`,
		"distance-description": `Länge der Linie in Kilometern`,
		"time-description": `Reisedauer der Linie in Sekunden`,
		"ascent-descent-description": `Gesamteranstieg/-abstieg der Linie`,
		"routePoints-description": `Koordinaten der Wegpunkte der Linie`,
		"number-description": `Zahl`,
		"text-description": `Zeichenkette`,
		"mathematical-description": `Mathematische Operationen ({{modulo}}: modulo, {{power}}: Potenz)`,
		"logical-description": `Logische Operationen`,
		"ternary-description": `Wenn/dann/sonst-Operator`,
		"comparison-description": `Vergleich ({{notEqual}}: ungleich) (Groß-/Kleinschreibung relevant)`,
		"list-description": `Listen-Operator ({{in}}: Wert kommt in der Liste vor, {{notIn}}: Wert kommt nicht in der Liste vor) (Groß-/Kleinschreibung relevant)`,
		"regexp-description": `Regulärer Ausdruck (Groß-/Kleinschreibung relevant)`,
		"lower-description": `Zu Kleinbuchstaben konvertieren`,
		"round-description": `Runden ({{round}}: kaufmännisch runden, {{ceil}}: aufrunden, {{floor}}: abrunden)`,
		"functions-description": `Mathematische Funktionen ({{abs}}: Betrag, {{log}}: Natürlicher Logarithmus, {{sqrt}}: Quadratwurzel)`,
		"min-max-description": `Kleinster/größter Wert`
	},

	"modal-dialog": {
		"close": "Schließen",
		"cancel": "Abbrechen",
		"save": "Speichern"
	},

	"user-preferences-dialog": {
		"title": `Benutzereinstellungen`,
		"introduction": `Diese Einstellungen werden als Cookies auf Ihrem Computer gespeichert und werden unabhängig von der geöffneten Karte angewendet.`,
		"language": `Sprache`,
		"units": `Einheiten`,
		"units-metric": `Metrisch`,
		"units-us": `US customary (Meilen und Füße)`
	}
};

export default messagesDe;