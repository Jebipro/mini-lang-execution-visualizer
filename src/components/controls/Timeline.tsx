import { useEffect, useRef } from 'react';
import { phaseStarts } from '../../model/scenario';
import type { Scenario } from '../../model/types';

interface Props {
  scenario: Scenario;
  step: number;
  onSelect: (step: number) => void;
}

export function Timeline({ scenario, step, onSelect }: Props) {
  const starts = phaseStarts(scenario);
  const currentPhase = scenario.steps[step]?.phase;
  const currentIndex = scenario.phases.findIndex((p) => p.id === currentPhase);
  const nav = useRef<HTMLElement>(null);

  // keep the current phase visible when the timeline scrolls horizontally (narrow screens)
  useEffect(() => {
    const el = nav.current;
    const cur = el?.querySelector<HTMLElement>('.tl-phase.is-current');
    if (!el || !cur) return;
    const box = cur.getBoundingClientRect();
    const frame = el.getBoundingClientRect();
    if (box.left < frame.left || box.right > frame.right) {
      el.scrollTo({ left: el.scrollLeft + box.left - frame.left - frame.width / 3, behavior: 'smooth' });
    }
  }, [currentIndex]);

  return (
    <nav className="timeline" aria-label="실행 단계 타임라인" ref={nav}>
      <ol>
        {scenario.phases.map((phase, i) => {
          const state = i < currentIndex ? 'done' : i === currentIndex ? 'current' : 'todo';
          const stepIdx = scenario.steps.map((s, j) => (s.phase === phase.id ? j : -1)).filter((j) => j >= 0);
          return (
            <li key={phase.id} className={`tl-phase is-${state}`}>
              <button
                type="button"
                onClick={() => onSelect(starts.get(phase.id) ?? 0)}
                aria-current={state === 'current' ? 'step' : undefined}
                title={`${phase.label} 단계로 이동`}
              >
                <span className="tl-label">
                  {state === 'done' && (
                    <span className="tl-check" aria-hidden="true">
                      ✓{' '}
                    </span>
                  )}
                  {phase.label}
                  {state === 'done' && <span className="visually-hidden"> (완료)</span>}
                </span>
                <span className="tl-pips" aria-hidden="true">
                  {stepIdx.map((j) => (
                    <span key={j} className={`tl-pip${j < step ? ' is-done' : j === step ? ' is-current' : ''}`} />
                  ))}
                </span>
              </button>
              {i < scenario.phases.length - 1 && (
                <span className="tl-arrow" aria-hidden="true">
                  →
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
