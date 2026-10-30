import { useEffect, useState } from 'react'
import { SPINNER_STATES, Spinner, type SpinnerState, type SpinnerTheme } from './spinner'
import { SPINNER_SETS } from './spinner/sets'
import { Usage } from './Usage'
import './App.css'

type Appearance = 'system' | 'light' | 'dark'

const APPEARANCES: Appearance[] = ['system', 'light', 'dark']
const SPINNER_THEMES: SpinnerTheme[] = ['auto', 'light', 'dark']

function App() {
  const [appearance, setAppearance] = useState<Appearance>('system')
  const [spinnerTheme, setSpinnerTheme] = useState<SpinnerTheme>('auto')
  const [speed, setSpeed] = useState(1)
  const [paused, setPaused] = useState(false)
  const [avatarState, setAvatarState] = useState<SpinnerState>('searching')
  const [set, setSet] = useState(SPINNER_SETS[0])
  const [previewId, setPreviewId] = useState<string | null>(null)

  // Drives both the page palette and the spinners' `theme="auto"` detection,
  // which reads `data-theme` from any ancestor.
  useEffect(() => {
    const root = document.documentElement
    if (appearance === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', appearance)
  }, [appearance])

  return (
    <main className="page">
      <header className="head">
        <Spinner set={set} state="breathing" size={64} theme={spinnerTheme} speed={speed} paused={paused} />
        <div>
          <h1>AI Spinner</h1>
          <p className="lede">
            Sixty-eight style sets of nine canvas states that replace the spinner while an AI is thinking.
          </p>
          <p className="links">
            <a href="https://github.com/x-mesh/ai-spinner">GitHub</a>
            <a href="https://www.npmjs.com/package/@x-mesh/ai-spinner">npm</a>
          </p>
        </div>
      </header>

      <section className="controls" aria-label="Spinner controls">
        <div className="control control-wide">
          <span className="control-label">
            Style <code>set</code>
          </span>
          <div className="segmented" role="group">
            {SPINNER_SETS.map((value) => (
              <button
                key={value.id}
                type="button"
                aria-pressed={set === value}
                title={value.label}
                onClick={() => setSet(value)}
                onMouseEnter={() => setPreviewId(value.id)}
                onMouseLeave={() => setPreviewId(null)}
                onFocus={() => setPreviewId(value.id)}
                onBlur={() => setPreviewId(null)}
              >
                <Spinner
                  set={value}
                  state={value.icon.state}
                  startAt={value.icon.t}
                  size={24}
                  theme={spinnerTheme}
                  speed={speed}
                  paused={paused || (set !== value && previewId !== value.id)}
                  decorative
                />
                <span className="set-name">{value.label}</span>
              </button>
            ))}
          </div>
          <p className="hint">
            Each set is its own module, so an app bundles only the sets it imports.
          </p>
        </div>

        <div className="control">
          <span className="control-label">Page appearance</span>
          <div className="segmented" role="group">
            {APPEARANCES.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={appearance === value}
                onClick={() => setAppearance(value)}
              >
                {value}
              </button>
            ))}
          </div>
          <p className="hint">
            Sets <code>data-theme</code> on <code>&lt;html&gt;</code>. Spinners on <code>auto</code> follow it live.
          </p>
        </div>

        <div className="control">
          <span className="control-label">
            Spinner <code>theme</code>
          </span>
          <div className="segmented" role="group">
            {SPINNER_THEMES.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={spinnerTheme === value}
                onClick={() => setSpinnerTheme(value)}
              >
                {value}
              </button>
            ))}
          </div>
          <p className="hint">
            <code>light</code> and <code>dark</code> pin the ink and ignore the page.
          </p>
        </div>

        <div className="control">
          <label className="control-label" htmlFor="speed">
            <code>speed</code> &times;{speed.toFixed(2)}
          </label>
          <input
            id="speed"
            type="range"
            min={0.25}
            max={3}
            step={0.05}
            value={speed}
            onChange={(event) => setSpeed(Number(event.target.value))}
          />
          <p className="hint">Multiplies each preset&rsquo;s baked speed.</p>
        </div>

        <div className="control">
          <span className="control-label">
            <code>paused</code>
          </span>
          <label className="switch">
            <input
              type="checkbox"
              checked={paused}
              onChange={(event) => setPaused(event.target.checked)}
            />
            <span>Freeze on the current frame</span>
          </label>
          <p className="hint">All instances share one clock, so they freeze in phase.</p>
        </div>
      </section>

      <Usage
        set={set}
        state={avatarState}
        onStateChange={setAvatarState}
        theme={spinnerTheme}
        speed={speed}
        paused={paused}
      />

      <section aria-labelledby="gallery-title">
        <h2 id="gallery-title">
          Nine states <span className="dim">at size 64</span>
        </h2>
        <ul className="gallery">
          {SPINNER_STATES.map((state) => (
            <li key={state}>
              <button
                type="button"
                className="tile"
                aria-pressed={avatarState === state}
                onClick={() => setAvatarState(state)}
              >
                <Spinner
                  set={set}
                  state={state}
                  size={64}
                  theme={spinnerTheme}
                  speed={speed}
                  paused={paused}
                />
                <span className="tile-name">{state}</span>
                <span className="tile-blurb">{set.blurbs[state]}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="inline-title">
        <h2 id="inline-title">
          Inline scale <span className="dim">size 20</span>
        </h2>
        <p className="hint tight">
          A separate design, not a scaled-down 64: a coarser 5&times;5 grid.
        </p>
        <ul className="inline-rows">
          {SPINNER_STATES.map((state) => (
            <li key={state}>
              <Spinner
                set={set}
                state={state}
                size={20}
                theme={spinnerTheme}
                speed={speed}
                paused={paused}
              />
              <span>
                Agent is <strong>{state}</strong> through the repository&hellip;
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="chat-title">
        <h2 id="chat-title">
          Chat avatar <span className="dim">size 64</span>
        </h2>
        <p className="hint tight">
          Pick a state above to swap the avatar. <code>aria-label</code> overrides the per-state default.
        </p>
        <div className="chat">
          <Spinner
            set={set}
            state={avatarState}
            size={64}
            theme={spinnerTheme}
            speed={speed}
            paused={paused}
            aria-label={`Assistant is ${avatarState}`}
          />
          <div className="bubble">
            <p className="bubble-who">Assistant</p>
            <p className="bubble-body">
              Currently <strong>{avatarState}</strong>. Replace this block with your own streaming
              response and keep the spinner mounted until the first token lands.
            </p>
          </div>
        </div>
      </section>

      <footer className="foot">
        <p>
          MIT licensed &middot; no runtime dependencies &middot; React optional
        </p>
        <p>
          Respects <code>prefers-reduced-motion</code>, and pauses offscreen or on a hidden tab.
        </p>
      </footer>
    </main>
  )
}

export default App
