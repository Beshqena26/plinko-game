import './App.css';
import PlinkoBoard from './components/PlinkoBoard';
import BetControls from './components/BetControls';
import BetHistory from './components/BetHistory';
import { useGameEngine } from './hooks/useGameEngine';

function App() {
  const game = useGameEngine();

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      {/* Header */}
      <header className="border-b border-border bg-bg-secondary/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-accent-green/20 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent-green">
                <circle cx="12" cy="12" r="10"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </div>
            <h1 className="text-lg font-bold tracking-tight">
              Plinko
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 text-xs text-text-secondary">
              <div className="w-2 h-2 rounded-full bg-accent-green animate-pulse" />
              Provably Fair
            </div>
            <div className="bg-bg-card border border-border rounded-lg px-4 py-2">
              <span className="text-xs text-text-secondary mr-2">Balance</span>
              <span className="font-bold text-accent-green">${game.balance.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row gap-5">
          {/* Left Panel - Controls */}
          <div className="w-full lg:w-72 flex-shrink-0 order-2 lg:order-1">
            <BetControls
              balance={game.balance}
              betAmount={game.betAmount}
              setBetAmount={game.setBetAmount}
              rows={game.rows}
              setRows={game.setRows}
              risk={game.risk}
              setRisk={game.setRisk}
              isAutoBetting={game.isAutoBetting}
              autoBetCount={game.autoBetCount}
              setAutoBetCount={game.setAutoBetCount}
              onDrop={game.dropBall}
              onStartAutoBet={game.startAutoBet}
              onStopAutoBet={game.stopAutoBet}
              onHalf={game.halfBet}
              onDouble={game.doubleBet}
            />
          </div>

          {/* Center - Game Board */}
          <div className="flex-1 order-1 lg:order-2">
            <div className="bg-bg-card rounded-xl overflow-hidden border border-border/50" style={{ height: '580px' }}>
              <PlinkoBoard
                rows={game.rows}
                balls={game.balls}
                setBalls={game.setBalls}
                multipliers={game.multipliers}
                flashingBucket={game.flashingBucket}
              />
            </div>
          </div>

          {/* Right Panel - History */}
          <div className="w-full lg:w-64 flex-shrink-0 order-3">
            <BetHistory results={game.results} />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border mt-8 py-4">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between text-xs text-text-secondary">
          <span>Plinko Game - For Entertainment Only</span>
          <span>Provably Fair Gaming</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
