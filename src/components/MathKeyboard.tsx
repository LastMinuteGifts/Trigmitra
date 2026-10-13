interface MathKeyboardProps {
  onInsert: (text: string) => void
  onBackspace: () => void
  onClear: () => void
}

const ROWS: string[][] = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['+', '−', '×', '÷', '=', '(', ')', '.', '^', '%'],
  ['x', 'y', 'θ', 'π', '√', '²', '³', '°', '≤', '≥'],
  ['±', '≠', '∞', '½', '⅓', '¼', '[', ']', '⌫', 'Clear'],
  ['sin', 'cos', 'tan', 'sec', 'cosec', 'cot', '(', ')', '°', '∠'],
]

export default function MathKeyboard({ onInsert, onBackspace, onClear }: MathKeyboardProps) {
  return (
    <div className="math-kb" aria-label="Maths keyboard">
      {ROWS.map((row, i) => (
        <div className="kb-row" key={i}>
          {row.map((key) => {
            if (key === '⌫') {
              return (
                <button key={key} type="button" className="kb-key kb-action" onClick={onBackspace} aria-label="Backspace">
                  ⌫
                </button>
              )
            }
            if (key === 'Clear') {
              return (
                <button key={key} type="button" className="kb-key kb-action" onClick={onClear}>
                  Clear
                </button>
              )
            }
            return (
              <button
                key={key}
                type="button"
                className={key.length > 2 ? 'kb-key kb-word' : 'kb-key'}
                onClick={() => onInsert(key)}
              >
                {key}
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}
