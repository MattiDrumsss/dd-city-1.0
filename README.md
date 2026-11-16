# D&D CITY 1.0 — Prototype 0.1

Prima build giocabile di D&D City: prototipo 3D single-player per browser desktop.

## Funzionalità presenti
- Città 3D procedurale con strade, edifici, finestre illuminate e lampioni.
- Personaggio controllabile in terza persona.
- Visuale in prima persona selezionabile con `V`.
- Movimento WASD, corsa, salto e accovacciamento predisposto nei controlli.
- Mouse con Pointer Lock per controllare la visuale.
- Un'auto guidabile: avvicinati e premi `F`.
- HUD, menu iniziale e pausa.

## Requisiti
- Node.js 20.19+ oppure 22.12+
- Connessione internet al primo avvio per installare le dipendenze.

## Avvio in locale
1. Estrai lo ZIP.
2. Apri la cartella `dd_city_1_0` con VS Code.
3. Apri il terminale nella cartella.
4. Esegui:

```bash
npm install
npm run dev
```

5. Apri l'indirizzo locale mostrato da Vite, normalmente `http://localhost:5173`.

## Comandi
- `W A S D`: movimento / guida
- `SHIFT`: corsa
- `SPACE`: salto a piedi / freno a mano in auto
- `CTRL`: accovacciamento (controllo predisposto; animazione da completare)
- `Mouse`: visuale
- `V`: alterna prima e terza persona
- `F`: entra/esci dall'auto
- `ESC`: pausa
- Click sul canvas: riattiva il controllo del mouse

## Pubblicazione su GitHub e Vercel
1. Crea un repository GitHub vuoto.
2. Carica tutti i file di questa cartella, mantenendo la struttura.
3. Su Vercel scegli **Add New → Project** e importa il repository.
4. Framework: Vite (rilevamento automatico).
5. Build command: `npm run build`.
6. Output directory: `dist`.
7. Premi Deploy.

Non servono variabili d'ambiente o Firebase in questa prima versione.

## Stato e limiti del prototipo
Questa è una prima build giocabile, non un GTA completo. La città è generata proceduralmente e i modelli sono placeholder originali creati con geometrie Three.js. Non sono ancora presenti multiplayer, account, armi, missioni, salvataggi, audio, modelli umani dettagliati o fisica avanzata. La grafica è una base 3D notturna stilizzata-realistica, da migliorare nelle fasi successive.

## Struttura
- `src/main.js`: scena 3D, città, personaggio, veicolo e controlli.
- `src/style.css`: menu, HUD e interfaccia.
- `index.html`: struttura della pagina.
