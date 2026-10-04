import { useEffect, useReducer, useState } from 'react';
import { SyntaxPanel } from './components/ast/SyntaxPanel';
import { Controls } from './components/controls/Controls';
import { Timeline } from './components/controls/Timeline';
import { Evidence } from './components/Evidence';
import { ExplanationPanel } from './components/explanation/ExplanationPanel';
import { OutputPanel } from './components/explanation/OutputPanel';
import { Intro } from './components/Intro';
import { RuntimePanel } from './components/runtime/RuntimePanel';
import { SourcePanel } from './components/source/SourcePanel';
import { currentView, hashOf, lastStep, loaded, reduce, sessionFromHash } from './model/session';
import type { Span } from './model/types';

const PLAY_MS = 2200;

export function App() {
  const [session, dispatch] = useReducer(reduce, undefined, () => sessionFromHash(window.location.hash));
  const [hover, setHover] = useState<Span | null>(null);
  const { scenario, states } = loaded(session.scenarioId);
  const view = currentView(session);
  const previous = states[session.step - 1]?.runtime ?? null;

  useEffect(() => {
    if (!session.playing) return;
    const t = window.setInterval(() => dispatch({ type: 'tick' }), PLAY_MS);
    return () => window.clearInterval(t);
  }, [session.playing]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      if (e.key === 'ArrowRight') dispatch({ type: 'next' });
      else if (e.key === 'ArrowLeft') dispatch({ type: 'prev' });
      else if (e.key === 'Home') dispatch({ type: 'reset' });
      else if (e.key === 'End') dispatch({ type: 'goto', step: Number.MAX_SAFE_INTEGER });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // deep link to the current step, e.g. #closure/14 (replaceState: stepping does not flood history)
  useEffect(() => {
    const hash = hashOf(session);
    if (window.location.hash !== hash) window.history.replaceState(null, '', hash);
  }, [session]);

  // a hover highlight belongs to the step it was made on
  useEffect(() => setHover(null), [session.step, session.scenarioId]);

  return (
    <div className="app">
      <Intro scenarioId={session.scenarioId} onScenario={(id) => dispatch({ type: 'setScenario', id })} />

      <div className="console">
        <Timeline scenario={scenario} step={session.step} onSelect={(step) => dispatch({ type: 'goto', step })} />
        <div className="console-row">
          <p className="step-caption" aria-live="polite">
            <span className="step-count mono">
              {session.step + 1}/{lastStep(session) + 1}
            </span>
            <span className="step-title">{view.def.title}</span>
          </p>
          <Controls
            playing={session.playing}
            atStart={session.step === 0}
            atEnd={session.step === lastStep(session)}
            onReset={() => dispatch({ type: 'reset' })}
            onPrev={() => dispatch({ type: 'prev' })}
            onNext={() => dispatch({ type: 'next' })}
            onPlay={() => dispatch({ type: 'play' })}
            onPause={() => dispatch({ type: 'pause' })}
          />
        </div>
      </div>

      <main className="stage">
        <SourcePanel scenario={scenario} view={view} hover={hover} />
        <SyntaxPanel key={`${scenario.id}`} scenario={scenario} view={view} onHover={setHover} />
        <RuntimePanel scenario={scenario} view={view} previous={previous} />
        <div className="side">
          <ExplanationPanel view={view} />
          <OutputPanel scenario={scenario} runtime={view.runtime} />
        </div>
      </main>

      <Evidence />
    </div>
  );
}
