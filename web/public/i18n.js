'use strict';
// UI texts in German, English and Dutch. Static markup marks its texts with
// data-i18n / data-i18n-placeholder; app.js calls t() for everything it
// renders. {name} placeholders are filled from the params object.
(function () {
  const LANGS = {
    de: { flag: '🇩🇪', name: 'Deutsch', locale: 'de-DE' },
    en: { flag: '🇬🇧', name: 'English', locale: 'en-GB' },
    nl: { flag: '🇳🇱', name: 'Nederlands', locale: 'nl-NL' },
  };

  const T = {
    'lang.label': ['Sprache', 'Language', 'Taal'],
    'conn.connecting': ['Verbinde …', 'Connecting …', 'Verbinden …'],
    'conn.live': ['Live verbunden', 'Live connected', 'Live verbonden'],
    'conn.lost': ['Verbindung unterbrochen …', 'Connection lost …', 'Verbinding verbroken …'],
    'account.login': ['Anmelden', 'Log in', 'Inloggen'],

    'hero.loading': ['Lade Daten …', 'Loading data …', 'Gegevens laden …'],
    'hero.freeTitle': ['Freie Plätze', 'Free spaces', 'Vrije plekken'],
    'hero.of': ['von {total} frei', 'of {total} free', 'van {total} vrij'],
    'hero.occ': ['{p} % belegt', '{p}% occupied', '{p}% bezet'],
    'pill.offline': ['Sensoren offline', 'Sensors offline', 'Sensoren offline'],
    'pill.locked': ['Gesperrt', 'Locked', 'Geblokkeerd'],
    'pill.full': ['Voll', 'Full', 'Vol'],
    'pill.almost': ['Fast voll', 'Almost full', 'Bijna vol'],
    'pill.plenty': ['Viel Platz', 'Plenty of space', 'Genoeg plek'],
    'title.last': ['Letzter Stand', 'Last known state', 'Laatste stand'],
    'title.nodata': ['Noch keine Daten', 'No data yet', 'Nog geen gegevens'],
    'title.locked': ['Station wegen Alarm gesperrt', 'Station locked due to an alarm', 'Station geblokkeerd door een alarm'],
    'title.full': ['Gerade kein Platz frei', 'No space right now', 'Nu geen plek vrij'],
    'title.one': ['Noch 1 Platz frei', '1 space left', 'Nog 1 plek vrij'],
    'title.few': ['Noch {n} Plätze frei', '{n} spaces left', 'Nog {n} plekken vrij'],
    'title.many': ['{n} Plätze frei', '{n} spaces free', '{n} plekken vrij'],
    'sub.live': ['Live · aktualisiert {ago}', 'Live · updated {ago}', 'Live · bijgewerkt {ago}'],
    'sub.stale': ['Stand {ago} – die Sensoren melden gerade nichts.', 'As of {ago} – the sensors are not reporting.', 'Stand van {ago} – de sensoren melden nu niets.'],
    'sub.waiting': ['Warte auf die ersten Messwerte.', 'Waiting for the first readings.', 'Wachten op de eerste metingen.'],
    'hint.best': ['Tipp: {day} gegen {time} sind ≈{n} Plätze frei.', 'Tip: {day} around {time} about {n} spaces are free.', 'Tip: {day} rond {time} zijn ≈{n} plekken vrij.'],
    'hint.peak': ['Am vollsten wird es {day} gegen {time} (≈{p} % belegt).', 'Busiest {day} around {time} (≈{p}% occupied).', 'Het drukst wordt het {day} rond {time} (≈{p}% bezet).'],

    'ago.now': ['gerade eben', 'just now', 'zojuist'],
    'ago.s': ['vor {n} s', '{n} s ago', '{n} s geleden'],
    'ago.m': ['vor {n} min', '{n} min ago', '{n} min geleden'],
    'ago.at': ['um {t}', 'at {t}', 'om {t}'],
    'time.hour': ['{h} Uhr', '{h}:00', '{h}:00'],
    'time.range': ['{a}–{b} Uhr', '{a}:00–{b}:00', '{a}:00–{b}:00'],

    'access.title': ['Gate per Handy öffnen', 'Open the gate by phone', 'Poort openen met je telefoon'],
    'access.text': ['Kein Chip dabei? Mit einem Konto öffnest du das Gate direkt hier.', 'No chip on you? With an account you can open the gate right here.', 'Geen chip bij je? Met een account open je de poort gewoon hier.'],
    'access.register': ['Registrieren', 'Sign up', 'Registreren'],
    'access.hello': ['Hallo,', 'Hi,', 'Hallo,'],
    'access.logout': ['Abmelden', 'Log out', 'Uitloggen'],
    'access.hold': ['Zum Öffnen gedrückt halten, damit das Gate nicht aus Versehen aufgeht.', 'Press and hold to open, so the gate never opens by accident.', 'Ingedrukt houden om te openen, zodat de poort niet per ongeluk opengaat.'],
    'btn.park': ['Einparken', 'Park', 'Parkeren'],
    'btn.parkSub': ['reserviert einen Slot', 'reserves a slot', 'reserveert een plek'],
    'btn.pickup': ['Abholen', 'Pick up', 'Ophalen'],
    'btn.pickupSub': ['öffnet nur das Gate', 'only opens the gate', 'opent alleen de poort'],
    'gate.opening': ['Gate öffnet …', 'Gate opening …', 'Poort gaat open …'],
    'gate.open': ['Gate ist offen', 'Gate is open', 'Poort is open'],
    'gate.closing': ['Gate schließt', 'Gate closing', 'Poort sluit'],
    'gate.slot': ['Slot {n} ist für dich reserviert.', 'Slot {n} is reserved for you.', 'Plek {n} is voor je gereserveerd.'],
    'gate.assign': ['Ein freier Slot wird dir zugewiesen.', 'A free slot is being assigned to you.', 'Er wordt een vrije plek voor je gekozen.'],
    'gate.bye': ['Viel Spaß mit deinem Rad!', 'Enjoy your ride!', 'Veel fietsplezier!'],

    'slots.title': ['Stellplätze', 'Parking slots', 'Stallingsplekken'],
    'slots.live': ['live', 'live', 'live'],
    'slots.offline': ['offline', 'offline', 'offline'],
    'slot.label': ['SLOT {n}', 'SLOT {n}', 'PLEK {n}'],
    'state.free': ['Frei', 'Free', 'Vrij'],
    'state.occupied': ['Belegt', 'Occupied', 'Bezet'],
    'state.reserved': ['Reserviert', 'Reserved', 'Gereserveerd'],
    'state.alarm': ['Alarm', 'Alarm', 'Alarm'],
    'state.unknown': ['Unbekannt', 'Unknown', 'Onbekend'],
    'slot.nodata': ['keine Daten', 'no data', 'geen gegevens'],
    'slot.asof': ['Stand {ago}', 'as of {ago}', 'stand {ago}'],

    'fc.title': ['Erwartete Auslastung', 'Expected occupancy', 'Verwachte bezetting'],
    'fc.best': ['Beste Zeit', 'Best time', 'Beste tijd'],
    'fc.peak': ['Stoßzeit', 'Peak time', 'Spitsuur'],
    'fc.bestSub': ['≈{n} von {total} frei', '≈{n} of {total} free', '≈{n} van {total} vrij'],
    'fc.peakSub': ['≈{p} % belegt', '≈{p}% occupied', '≈{p}% bezet'],
    'day.0': ['Heute', 'Today', 'Vandaag'],
    'day.1': ['Morgen', 'Tomorrow', 'Morgen'],
    'day.2': ['Übermorgen', 'Day after', 'Overmorgen'],
    'dayl.0': ['heute', 'today', 'vandaag'],
    'dayl.1': ['morgen', 'tomorrow', 'morgen'],
    'dayl.2': ['übermorgen', 'the day after tomorrow', 'overmorgen'],
    'legend.measured': ['Gemessen', 'Measured', 'Gemeten'],
    'legend.forecast': ['Prognose', 'Forecast', 'Voorspelling'],
    'legend.now': ['Jetzt', 'Now', 'Nu'],
    'chart.now': ['jetzt', 'now', 'nu'],
    'chart.aria': ['Auslastung {day}, pro Stunde', 'Occupancy {day}, per hour', 'Bezetting {day}, per uur'],
    'tip.value': ['{p} % belegt · ≈{n} frei', '{p}% occupied · ≈{n} free', '{p}% bezet · ≈{n} vrij'],
    'tip.nodata': ['keine Daten', 'no data', 'geen gegevens'],
    'fc.note': ['Grundlage: Belegung der letzten {n} Tage, je Wochentag und Stunde gemittelt', 'Based on the occupancy of the last {n} days, averaged per weekday and hour', 'Gebaseerd op de bezetting van de afgelopen {n} dagen, gemiddeld per weekdag en uur'],
    'fc.noteLive': ['; die nächsten Stunden sind an den Live-Stand angeglichen', '; the next hours are adjusted to the live state', '; de komende uren zijn afgestemd op de live-stand'],
    'fc.noteDemo': ['Enthält fiktive Demo-Daten.', 'Includes fictional demo data.', 'Bevat fictieve demogegevens.'],
    'fc.noteNone': ['Noch zu wenig Verlauf für eine Prognose.', 'Not enough history for a forecast yet.', 'Nog te weinig historie voor een voorspelling.'],
    'fc.table': ['Als Tabelle anzeigen', 'Show as table', 'Als tabel tonen'],
    'table.hour': ['Stunde', 'Hour', 'Uur'],
    'table.kind': ['Art', 'Type', 'Soort'],
    'table.occ': ['Belegt', 'Occupied', 'Bezet'],
    'table.free': ['Frei (≈)', 'Free (≈)', 'Vrij (≈)'],

    'act.title': ['Letzte Aktivität', 'Recent activity', 'Recente activiteit'],
    'act.none': ['Noch nichts passiert.', 'Nothing has happened yet.', 'Nog niets gebeurd.'],
    'act.chip': ['Chip ••{uid}', 'Chip ••{uid}', 'Chip ••{uid}'],
    'act.park': ['Per App eingeparkt', 'Parked via app', 'Geparkeerd via app'],
    'act.pickup': ['Per App abgeholt', 'Picked up via app', 'Opgehaald via app'],
    'act.full': ['App: Station war voll', 'App: station was full', 'App: station was vol'],
    'act.error': ['App: Öffnen fehlgeschlagen', 'App: opening failed', 'App: openen mislukt'],

    'sys.title': ['System', 'System', 'Systeem'],
    'sys.none': ['Keine Geräte gemeldet.', 'No devices reported.', 'Geen apparaten gemeld.'],
    'sys.online': ['online', 'online', 'online'],
    'sys.offline': ['offline', 'offline', 'offline'],
    'sys.db': ['Datenbank', 'Database', 'Database'],
    'sys.raw': ['Rohdaten', 'Raw data', 'Ruwe data'],
    'sys.rawVal': ['{n} Zeilen (letzte Minuten)', '{n} rows (last minutes)', '{n} rijen (laatste minuten)'],
    'sys.minutes': ['Minutenwerte', 'Minute values', 'Minuutwaarden'],
    'sys.minutesVal': ['{live} live · {demo} Demo', '{live} live · {demo} demo', '{live} live · {demo} demo'],
    'sys.cleanup': ['Aufräumen', 'Cleanup', 'Opschonen'],
    'sys.cleanupEvery': ['läuft alle 5 min', 'runs every 5 min', 'draait elke 5 min'],
    'sys.gate': ['Gate-Steuerung', 'Gate control', 'Poortbesturing'],
    'sys.connected': ['verbunden', 'connected', 'verbonden'],
    'sys.disconnected': ['getrennt', 'disconnected', 'verbroken'],

    'auth.welcome': ['Willkommen zurück', 'Welcome back', 'Welkom terug'],
    'auth.create': ['Konto erstellen', 'Create account', 'Account aanmaken'],
    'auth.displayName': ['Anzeigename', 'Display name', 'Weergavenaam'],
    'auth.displayNamePh': ['z. B. Luca', 'e.g. Luca', 'bv. Luca'],
    'auth.username': ['Benutzername', 'Username', 'Gebruikersnaam'],
    'auth.password': ['Passwort', 'Password', 'Wachtwoord'],
    'auth.code': ['Registrierungscode', 'Registration code', 'Registratiecode'],
    'auth.cancel': ['Abbrechen', 'Cancel', 'Annuleren'],

    'toast.hello': ['Hallo {name}!', 'Hi {name}!', 'Hoi {name}!'],
    'toast.welcome': ['Konto erstellt – willkommen, {name}!', 'Account created – welcome, {name}!', 'Account aangemaakt – welkom, {name}!'],
    'toast.bye': ['Abgemeldet.', 'Logged out.', 'Uitgelogd.'],
    'toast.hold': ['Gedrückt halten, bis der Balken voll ist.', 'Hold until the bar is full.', 'Ingedrukt houden tot de balk vol is.'],

    'bike.title': ['Mein Rad', 'My bike', 'Mijn fiets'],
    'bike.parked': ['Dein Rad steht in Slot {n}', 'Your bike is in slot {n}', 'Je fiets staat op plek {n}'],
    'bike.parkedSince': ['geparkt seit {time}', 'parked since {time}', 'geparkeerd sinds {time}'],
    'bike.reserved': ['Slot {n} ist für dich reserviert', 'Slot {n} is reserved for you', 'Plek {n} is voor je gereserveerd'],
    'bike.reservedSub': ['Stell dein Rad ab, bevor die Zeit abläuft.', 'Park your bike before the time runs out.', 'Zet je fiets neer voordat de tijd om is.'],
    'bike.none': ['Kein Rad geparkt', 'No bike parked', 'Geen fiets geparkeerd'],
    'bike.noneSub': ['„Einparken“ reserviert dir einen freien Slot.', '"Park" reserves a free slot for you.', '"Parkeren" reserveert een vrije plek voor je.'],
    'bike.last': ['Zuletzt {dur} in Slot {n}', 'Last time {dur} in slot {n}', 'Laatst {dur} op plek {n}'],
    'bike.parkedToast': ['Dein Rad steht sicher in Slot {n}.', 'Your bike is secured in slot {n}.', 'Je fiets staat veilig op plek {n}.'],
    'bike.expiredToast': ['Deine Reservierung ist abgelaufen.', 'Your reservation has expired.', 'Je reservering is verlopen.'],
    'bike.doneToast': ['Abgeholt nach {dur} – gute Fahrt!', 'Picked up after {dur} – enjoy your ride!', 'Opgehaald na {dur} – goede rit!'],
    'bike.yours': ['Dein Rad', 'Your bike', 'Jouw fiets'],
    'bike.forYou': ['Für dich', 'For you', 'Voor jou'],
    'dur.hm': ['{h} h {m} min', '{h} h {m} min', '{h} u {m} min'],
    'dur.m': ['{m} min', '{m} min', '{m} min'],
    'dur.s': ['{s} s', '{s} s', '{s} s'],

    'chip.linked': ['Chip verknüpft', 'Chip linked', 'Chip gekoppeld'],
    'chip.none': ['Kein Chip verknüpft', 'No chip linked', 'Geen chip gekoppeld'],
    'chip.noneSub': ['Dann erkennt dich die Station auch am Chip.', 'Then the station recognises you by your chip too.', 'Dan herkent het station je ook aan je chip.'],
    'chip.linkedSub': ['Chip ••{uid} · die Station begrüßt dich mit Namen', 'Chip ••{uid} · the station greets you by name', 'Chip ••{uid} · het station begroet je bij naam'],
    'chip.link': ['Verknüpfen', 'Link', 'Koppelen'],
    'chip.unlink': ['Entfernen', 'Remove', 'Verwijderen'],
    'chip.unlinkConfirm': ['Chip wirklich vom Konto entfernen?', 'Really remove the chip from your account?', 'Chip echt van je account verwijderen?'],
    'chip.pairTitle': ['Halte jetzt deinen Chip an den Leser', 'Hold your chip to the reader now', 'Houd je chip nu tegen de lezer'],
    'chip.pairText': ['Der nächste unbekannte Chip wird mit deinem Konto verknüpft.', 'The next unknown chip will be linked to your account.', 'De volgende onbekende chip wordt aan je account gekoppeld.'],
    'chip.pairLeft': ['noch {s} s', '{s} s left', 'nog {s} s'],
    'chip.success': ['Chip verknüpft!', 'Chip linked!', 'Chip gekoppeld!'],
    'chip.timeout': ['Kein neuer Chip erkannt – gehört er schon zu einem anderen Konto?', 'No new chip detected – does it already belong to another account?', 'Geen nieuwe chip herkend – hoort hij al bij een ander account?'],

    'err.bad_action': ['Unbekannte Aktion.', 'Unknown action.', 'Onbekende actie.'],
    'err.mqtt_down': ['Keine Verbindung zum Gate.', 'No connection to the gate.', 'Geen verbinding met de poort.'],
    'err.cooldown': ['Bitte noch {wait} s warten.', 'Please wait {wait} s.', 'Nog {wait} s wachten a.u.b.'],
    'err.full': ['Die Station ist gerade voll.', 'The station is full right now.', 'Het station is nu vol.'],
    'err.locked': ['Die Station ist wegen eines Alarms gesperrt.', 'The station is locked due to an alarm.', 'Het station is geblokkeerd door een alarm.'],
    'err.has_bike': ['Du hast schon ein Rad in Slot {n}.', 'You already have a bike in slot {n}.', 'Je hebt al een fiets op plek {n}.'],
    'err.no_bike': ['Du hast kein Rad geparkt.', 'You have no bike parked.', 'Je hebt geen fiets gestald.'],
    'err.auth_required': ['Bitte zuerst anmelden.', 'Please log in first.', 'Log eerst in.'],
    'err.rate_limited': ['Zu viele Versuche. Bitte in ein paar Minuten erneut probieren.', 'Too many attempts. Please try again in a few minutes.', 'Te veel pogingen. Probeer het over een paar minuten opnieuw.'],
    'err.bad_code': ['Der Registrierungscode stimmt nicht.', 'The registration code is wrong.', 'De registratiecode klopt niet.'],
    'err.bad_username': ['Benutzername: 3–32 Zeichen, nur a–z, 0–9, Punkt, Minus, Unterstrich.', 'Username: 3–32 characters, only a–z, 0–9, dot, dash, underscore.', 'Gebruikersnaam: 3–32 tekens, alleen a–z, 0–9, punt, streepje, underscore.'],
    'err.short_password': ['Das Passwort braucht mindestens 8 Zeichen.', 'The password needs at least 8 characters.', 'Het wachtwoord moet minstens 8 tekens hebben.'],
    'err.username_taken': ['Diesen Benutzernamen gibt es schon.', 'This username is already taken.', 'Deze gebruikersnaam bestaat al.'],
    'err.bad_login': ['Benutzername oder Passwort falsch.', 'Wrong username or password.', 'Gebruikersnaam of wachtwoord onjuist.'],
    'err.internal': ['Interner Fehler.', 'Internal error.', 'Interne fout.'],
    'err.network': ['Keine Verbindung zum Server.', 'Cannot reach the server.', 'Server niet bereikbaar.'],
  };

  const ORDER = ['de', 'en', 'nl'];
  const KEY = 'bikestation.lang';

  function detect() {
    try {
      const saved = localStorage.getItem(KEY);
      if (LANGS[saved]) return saved;
    } catch { /* storage blocked - fall back to the browser language */ }
    const nav = (navigator.languages || [navigator.language || 'de']).map((l) => l.slice(0, 2).toLowerCase());
    return nav.find((l) => LANGS[l]) || 'de';
  }

  let lang = detect();

  function t(key, params) {
    const row = T[key];
    let s = row ? row[ORDER.indexOf(lang)] ?? row[0] : key;
    if (params) s = s.replace(/\{(\w+)\}/g, (m, k) => (params[k] ?? m));
    return s;
  }

  function applyStatic(root = document) {
    document.documentElement.lang = lang;
    root.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
    root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => { el.placeholder = t(el.dataset.i18nPlaceholder); });
    root.querySelectorAll('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
  }

  function setLang(next) {
    if (!LANGS[next]) return;
    lang = next;
    try { localStorage.setItem(KEY, next); } catch { /* not persisted - fine */ }
    applyStatic();
  }

  window.I18N = {
    LANGS, t, applyStatic, setLang,
    get lang() { return lang; },
    get locale() { return LANGS[lang].locale; },
  };
}());
