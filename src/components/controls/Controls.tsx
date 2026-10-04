interface Props {
  playing: boolean;
  atStart: boolean;
  atEnd: boolean;
  onReset: () => void;
  onPrev: () => void;
  onNext: () => void;
  onPlay: () => void;
  onPause: () => void;
}

export function Controls({ playing, atStart, atEnd, onReset, onPrev, onNext, onPlay, onPause }: Props) {
  return (
    <div className="controls" role="group" aria-label="재생 컨트롤">
      <button type="button" className="btn" onClick={onReset} aria-label="처음 단계로 되돌리기" title="처음으로 (Home)">
        <span aria-hidden="true">⟲</span> Reset
      </button>
      <button type="button" className="btn" onClick={onPrev} disabled={atStart} aria-label="이전 단계" title="이전 (←)">
        <span aria-hidden="true">←</span> Prev
      </button>
      {playing ? (
        <button type="button" className="btn" onClick={onPause} aria-label="일시정지" title="일시정지">
          <span aria-hidden="true">❚❚</span> Pause
        </button>
      ) : (
        <button type="button" className="btn" onClick={onPlay} aria-label={atEnd ? '처음부터 다시 재생' : '자동 재생'} title="자동 재생">
          <span aria-hidden="true">▶</span> {atEnd ? 'Replay' : 'Play'}
        </button>
      )}
      <button type="button" className="btn btn-primary" onClick={onNext} disabled={atEnd} aria-label="다음 단계" title="다음 (→)">
        Next <span aria-hidden="true">→</span>
      </button>
    </div>
  );
}
