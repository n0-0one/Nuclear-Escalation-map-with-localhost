# Nuclear Thunder Live

Samodzielna mapa Nuclear Escalation dla War Thunder: strona statyczna oraz aplikacja Windows 11 z frontendem dołączonym do EXE. Zachowuje narzędzia i dane mapy majorliera, dodając lokalną telemetrię, stany komponentów, planowanie lotu i historię bitwy.

**Wersja 0.1.0 — działający build do testów w grze.** Ograniczenia API są jawne: scenariusz, układ stron i afiliację wybiera użytkownik. Zniknięcie pojazdu nie oznacza zniszczenia. Repozytorium docelowe: [n0-0one/Nuclear-Escalation-map-with-localhost](https://github.com/n0-0one/Nuclear-Escalation-map-with-localhost).

## Uruchomienie Windows

Gotowe pliki po buildzie:

- `target/release/bundle/nsis/Nuclear Thunder Live_0.1.0_x64-setup.exe` — instalator x64.
- `target/release/ntl-desktop.exe` — samodzielna aplikacja z mapami osadzonymi w EXE.
- `target/release/ntl-bridge.exe` — opcjonalny mostek dla przeglądarki.

Przygotowane wydanie znajduje się również w `release/0.1.0/`: `Nuclear-Thunder-Live-Setup.exe`, `Nuclear-Thunder-Live.exe`, paczki Windows/Web/Source ZIP oraz `SHA256SUMS.txt`. Paczka Windows zawiera program, opcjonalny mostek, dokumentację i informacje o licencjach. Paczka Web zawiera gotowy katalog `dist/`.

Uruchom instalator lub bezpośrednio aplikację. Potrzebny jest Microsoft Edge WebView2 Runtime (standardowo obecny w Windows 11). Instalator może pobrać runtime, jeśli go brakuje. Sama mapa i kolejne uruchomienia aplikacji nie wymagają połączenia z oryginalną stroną ani z internetem. Wydanie nie jest podpisane certyfikatem wydawcy.

W aplikacji Windows tryb **Native War Thunder** automatycznie sprawdza lokalną grę. Gdy gra jest zamknięta, wszystkie narzędzia mapy pozostają dostępne. Nie uruchamiaj mostka dla aplikacji desktopowej.

## Korzystanie z mapy

1. W lewym panelu wybierz Archipelago lub South Eastern City, scenariusz i ewentualnie **Swap sides**.
2. Oryginalny prawy panel udostępnia warstwy, teren, drogi, jednostki, zasięgi i legendę. Na dole po lewej są Measure, Line of sight, Flight brush i Threat cover.
3. **Live panel** otwiera panel połączenia, stany komponentów, konwoje, planer i historię. Można go zwinąć, aby odsłonić oryginalne warstwy.
4. Kliknij pozycję lub wyszukaj ją w Target & component states. Osobno oznaczaj radary, wyrzutnie, czołgi, SPAA i budynki. **Undo** cofa ręczną zmianę. Focus target i Previous view sterują widokiem.
5. Dopiero po wybraniu właściwego scenariusza i stron zaznacz **I selected the correct scenario and side layout**, aby dopuścić ostrożne dopasowanie obserwacji do statycznych komponentów. Wynik jest oznaczony INFERRED, nie jako pewna identyfikacja.
6. Planer lotu przyjmuje 2–12 klikniętych punktów. Domyślnie uwzględnia również nieznane zagrożenia. Wynik jest estymacją; nie gwarantuje osłony terenu ani bezpiecznego przelotu.

**PREDICTED** na trasie konwoju oznacza trasę wynikającą z misji. Turkusowa historia ruchu oznacza obserwowany anonimowy obiekt, bez potwierdzonej tożsamości konwoju. **SIMULATED** oznacza tryb demonstracyjny; wyjście z niego usuwa stany wygenerowane przez symulację.

Eksport historii zapisuje kontekst i stany bitwy jako JSON. Eksport diagnostyczny zawiera statusy, błędy i podstawowe metryki, bez kodu parowania i wiadomości HUD. W desktopie plik trafia do Pobranych, w przeglądarce używa zwykłego pobierania pliku.

## Strona lokalna

Wymagany Node.js 24. Z katalogu repozytorium:

```powershell
npm ci
npm run dev
```

Otwórz `http://127.0.0.1:5173`. Build produkcyjny:

```powershell
npm run build
npm run preview
```

Podgląd: `http://127.0.0.1:4173`. Nie otwieraj `index.html` przez `file://`; przeglądarki blokują wówczas odczyt danych JSON. Gotowy `dist/` można serwować dowolnym serwerem statycznym. Wszystkie potrzebne pliki znajdują się w tym katalogu; nie trzeba pobierać źródeł majorliera.

## Połączenie przeglądarki z grą

**Manual / offline** działa zawsze. **Direct localhost** próbuje czytać `127.0.0.1:8111`; dostęp zależy od zasad przeglądarki i CORS gry. Przy blokadzie wybierz mostek lub desktop. Nie wyłączaj zabezpieczeń przeglądarki.

Mostek lokalny:

```powershell
.\target\release\ntl-bridge.exe
```

W panelu strony wybierz **Local bridge**, wklej kod parowania wydrukowany w konsoli mostka i naciśnij **Connect**. Kod jest losowy i zmienia się po każdym uruchomieniu. Mostek akceptuje domyślnie wyłącznie lokalne originy podglądu na portach 5173 i 4173. Dla GitHub Pages uruchom:

```powershell
.\target\release\ntl-bridge.exe --origin https://n0-0one.github.io
```

Origin nie zawiera ścieżki repozytorium ani końcowego ukośnika. Mostek nasłuchuje wyłącznie `127.0.0.1:8112`. Ctrl+C go zatrzymuje. Każdy odwiedzający uruchamia własną grę i własny mostek. Hosting nie otrzymuje telemetrii. Przeglądarka może poprosić o dostęp do sieci lokalnej; jeśli nie obsługuje tego połączenia, aplikacja Windows pozostaje niezależną ścieżką.

## Budowanie Windows

Wymagane: Node.js 24, Rust stable MSVC, Visual Studio C++ Build Tools z Windows SDK oraz WebView2. Zależności są przypięte w lockfile'ach.

```powershell
npm ci
npm run desktop:build
cargo build --locked --release -p ntl-bridge
```

`desktop:build` buduje frontend, uruchamia Tauri z production custom protocol i generuje instalator NSIS. Pierwszy build pobiera pakiety oraz narzędzia NSIS. Nie zastępuj go samym `cargo build --release` bez feature `custom-protocol`, ponieważ build deweloperski wskazuje serwer Vite.

Alternatywnie, EXE bez pakowania instalatora:

```powershell
npm run build
cargo build --locked --release -p ntl-desktop --features custom-protocol
```

Development: uruchom `npm run dev` w pierwszym terminalu i `npm run desktop:dev` w drugim. Zamykanie natywnego okna kończy proces; aplikacja nie uruchamia żadnego ukrytego mostka.

## GitHub Pages i wydania

Workflow `.github/workflows/pages.yml` buduje i waliduje stronę, a następnie publikuje `dist`. W ustawieniach repozytorium wybierz **Pages → Source → GitHub Actions**. Push do `main` lub ręczne uruchomienie workflow rozpoczyna publikację. Własna domena może zostać ustawiona w Pages; relatywne ścieżki assetów obsługują także domenę główną.

Adres docelowy po udanym wdrożeniu: `https://n0-0one.github.io/Nuclear-Escalation-map-with-localhost/`. Sam zapis tego adresu w README nie oznacza, że strona została już wdrożona. Prywatne repozytorium musi mieć plan GitHub obsługujący Pages; nie zmieniaj jego widoczności bez decyzji właściciela.

`.github/workflows/windows.yml` tworzy EXE i instalator na `windows-latest`, po ręcznym uruchomieniu lub tagu `v*`. Pliki pojawiają się jako artifact Nuclear-Thunder-Live-Windows. Workflow nie tworzy automatycznie publicznego GitHub Release.

## Testy

```powershell
npm test
npm run build
npm run test:browser
cargo test --locked -p war-thunder-telemetry -p ntl-bridge
node tests/integration/bridge-security.mjs
```

Testy przeglądarkowe używają zainstalowanego Microsoft Edge. Test rzeczywistej gry z mostkiem: uruchom Vite i `node tests/integration/bridge-security.mjs --browser` podczas bitwy. Test uruchamia własny mostek i kończy go po wykonaniu; port 8112 musi być wolny. Wynik zapisuje w `docs/verification/` i nie wysyła go do sieci.

Test produkcyjnego podkatalogu: uruchom `node scripts/serve-build.mjs`, a następnie `node tests/integration/production-browser.mjs`. To sprawdza `/ntl-test/`, obie mapy, scenariusze, style ikon i brak zewnętrznych zasobów.

Test natywnego EXE bez Vite: `./tests/integration/native-smoke.ps1`. Skrypt uruchamia ukrytą instancję, sprawdza osadzoną mapę i natywny odczyt telemetrii, zapisuje lokalny raport i kończy proces testowy. Brak uruchomionej gry nie blokuje testu mapy.

Pakowanie po zbudowaniu Windows, mostka i strony oraz dodaniu źródeł do Git: `python scripts/package-release.py`. Opcja `--desktop-dir target/final/release` wskazuje alternatywny katalog builda. Skrypt pakuje tylko śledzone źródła; lokalne przechwycenia telemetrii i raporty nie trafiają do archiwum źródłowego.

## Dokumentacja

- [Architektura](docs/architecture.md)
- [Telemetria i semantyka pewności](docs/telemetry.md)
- [Dane map](docs/map-data.md)
- [Ograniczenia](docs/limitations.md)
- [Wyniki odbioru](docs/acceptance.md)
- [Pochodzenie i licencje](LICENSES/NOTICE.md)

Original map: [majorlier/nuclear-thunder-interactive-map](https://github.com/majorlier/nuclear-thunder-interactive-map), commit `d3b9854ed3fa065324840c2b8e7f1324837e86da`. Autorstwo i prawa do materiałów gry zostały zachowane. Projekt nie jest powiązany z Gaijin Entertainment.
