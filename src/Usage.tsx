import { useEffect, useState } from 'react'
import { SPINNER_STATES, Spinner, type SpinnerSet, type SpinnerState, type SpinnerTheme } from './spinner'

type Flavor = 'react' | 'vanilla'

const FLAVORS: { id: Flavor; label: string }[] = [
  { id: 'react', label: 'React' },
  { id: 'vanilla', label: 'JavaScript' },
]
const SIZES = [20, 32, 64]
const INSTALL = 'npm install @x-mesh/ai-spinner'

interface Choice {
  set: SpinnerSet
  state: SpinnerState
  size: number
  theme: SpinnerTheme
  speed: number
}

/** Only options that differ from the defaults go into the snippet. */
function extras({ theme, speed }: Choice) {
  return { theme: theme === 'auto' ? undefined : theme, speed: speed === 1 ? undefined : Number(speed.toFixed(2)) }
}

function reactSnippet(choice: Choice) {
  const { theme, speed } = extras(choice)
  const props = [`set={${choice.set.id}}`, `state="${choice.state}"`, `size={${choice.size}}`]
  if (theme) props.push(`theme="${theme}"`)
  if (speed) props.push(`speed={${speed}}`)
  return [
    `import { Spinner } from '@x-mesh/ai-spinner'`,
    `import { ${choice.set.id} } from '@x-mesh/ai-spinner/sets/${choice.set.id}'`,
    '',
    `<Spinner ${props.join(' ')} />`,
  ].join('\n')
}

function vanillaSnippet(choice: Choice) {
  const { theme, speed } = extras(choice)
  const options = [`set: ${choice.set.id}`, `state: '${choice.state}'`, `size: ${choice.size}`]
  if (theme) options.push(`theme: '${theme}'`)
  if (speed) options.push(`speed: ${speed}`)
  return [
    `import { mountSpinner } from '@x-mesh/ai-spinner/vanilla'`,
    `import { ${choice.set.id} } from '@x-mesh/ai-spinner/sets/${choice.set.id}'`,
    '',
    `const canvas = document.querySelector('canvas')`,
    `const spinner = mountSpinner(canvas, { ${options.join(', ')} })`,
    '',
    `// Later: spinner.update({ state: 'composing' }), spinner.destroy()`,
  ].join('\n')
}

type CopyStatus = 'idle' | 'copied' | 'failed'

const COPY_LABEL: Record<CopyStatus, string> = { idle: 'Copy', copied: 'Copied', failed: 'Copy failed' }

function CopyButton({ text }: { text: string }) {
  const [status, setStatus] = useState<CopyStatus>('idle')

  useEffect(() => {
    if (status === 'idle') return
    const timer = setTimeout(() => setStatus('idle'), 1600)
    return () => clearTimeout(timer)
  }, [status])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setStatus('copied')
    } catch {
      // The Clipboard API exists only on secure origins, so plain-HTTP LAN previews land here.
      setStatus('failed')
    }
  }

  return (
    <button type="button" className="copy" onClick={copy} aria-live="polite">
      {COPY_LABEL[status]}
    </button>
  )
}

interface UsageProps {
  set: SpinnerSet
  state: SpinnerState
  onStateChange: (state: SpinnerState) => void
  theme: SpinnerTheme
  speed: number
  paused: boolean
}

export function Usage({ set, state, onStateChange, theme, speed, paused }: UsageProps) {
  const [flavor, setFlavor] = useState<Flavor>('react')
  const [size, setSize] = useState(32)
  const choice = { set, state, size, theme, speed }
  const code = flavor === 'react' ? reactSnippet(choice) : vanillaSnippet(choice)

  return (
    <section aria-labelledby="usage-title">
      <h2 id="usage-title">
        Use it <span className="dim">code for the set and state you pick</span>
      </h2>
      <div className="usage">
        <div className="usage-preview">
          <div className="usage-stage">
            <Spinner set={set} state={state} size={size} theme={theme} speed={speed} paused={paused} />
          </div>
          <label className="usage-field">
            <span className="control-label">State</span>
            <select value={state} onChange={(event) => onStateChange(event.target.value as SpinnerState)}>
              {SPINNER_STATES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <div className="usage-field">
            <span className="control-label">Size</span>
            <div className="segmented" role="group" aria-label="Size">
              {SIZES.map((value) => (
                <button key={value} type="button" aria-pressed={size === value} onClick={() => setSize(value)}>
                  {value}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="usage-code">
          <div className="install">
            <code>{INSTALL}</code>
            <CopyButton text={INSTALL} />
          </div>
          <div className="usage-bar">
            <div className="segmented" role="group" aria-label="Code flavor">
              {FLAVORS.map(({ id, label }) => (
                <button key={id} type="button" aria-pressed={flavor === id} onClick={() => setFlavor(id)}>
                  {label}
                </button>
              ))}
            </div>
            <CopyButton text={code} />
          </div>
          <pre className="snippet">
            <code>{code}</code>
          </pre>
          <p className="hint">
            Set, theme and speed follow the controls above. Click a state card below to change the state too.
          </p>
        </div>
      </div>
    </section>
  )
}
