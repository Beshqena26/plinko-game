// Dev-only test harness: mounts the real game hook and exposes it on window
// so a headless-browser script can drive drop()/onLand() like the board does.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { usePlinkoGame } from './hooks/usePlinkoGame';

declare global {
  interface Window { __game: ReturnType<typeof usePlinkoGame> }
}

function Harness() {
  const game = usePlinkoGame(8, 'low');
  window.__game = game;
  return (
    <pre id="state">
      {JSON.stringify({
        balance: game.balance,
        grant: game.freeGrant,
        summary: game.freeSummary,
        ending: game.freeEnding,
        flight: game.ballsInFlight,
      }, null, 2)}
    </pre>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode><Harness /></StrictMode>,
);
