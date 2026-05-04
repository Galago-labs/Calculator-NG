import { useState, useEffect, useCallback, useRef } from 'react';

// Safe arithmetic parser — replaces new Function() to avoid XSS
function safeEvaluate(expr: string): number {
  const tokens = expr.match(/(\d+\.?\d*|\.\d+|[+\-*/()])/g);
  if (!tokens) throw new Error('Invalid expression');

  let pos = 0;

  function parseExpr(): number {
    let left = parseTerm();
    while (pos < tokens.length && (tokens[pos] === '+' || tokens[pos] === '-')) {
      const op = tokens[pos++];
      const right = parseTerm();
      left = op === '+' ? left + right : left - right;
    }
    return left;
  }

  function parseTerm(): number {
    let left = parseUnary();
    while (pos < tokens.length && (tokens[pos] === '*' || tokens[pos] === '/')) {
      const op = tokens[pos++];
      const right = parseUnary();
      if (op === '/' && right === 0) throw new Error('Division by zero');
      left = op === '*' ? left * right : left / right;
    }
    return left;
  }

  function parseUnary(): number {
    if (tokens[pos] === '-') { pos++; return -parsePrimary(); }
    if (tokens[pos] === '+') { pos++; return parsePrimary(); }
    return parsePrimary();
  }

  function parsePrimary(): number {
    const token = tokens[pos];
    if (token === undefined) throw new Error('Unexpected end');
    if (token === '(') {
      pos++;
      const val = parseExpr();
      if (tokens[pos] !== ')') throw new Error('Missing )');
      pos++;
      return val;
    }
    const n = parseFloat(token);
    if (isNaN(n)) throw new Error('Unexpected token: ' + token);
    pos++;
    return n;
  }

  const result = parseExpr();
  if (pos < tokens.length) throw new Error('Unexpected token');
  return result;
}

const MAX_DISPLAY_LENGTH = 15;

const BUTTONS = [
  { id: 'clear',    label: 'C',   value: 'C'   },
  { id: 'back',     label: '←',   value: '←'   },
  { id: 'divide',   label: '÷',   value: '/'   },
  { id: 'multiply', label: '×',   value: '*'   },
  { id: 'seven',    label: '7',   value: '7'   },
  { id: 'eight',    label: '8',   value: '8'   },
  { id: 'nine',     label: '9',   value: '9'   },
  { id: 'minus',    label: '-',   value: '-'   },
  { id: 'four',     label: '4',   value: '4'   },
  { id: 'five',     label: '5',   value: '5'   },
  { id: 'six',      label: '6',   value: '6'   },
  { id: 'plus',     label: '+',   value: '+'   },
  { id: 'one',      label: '1',   value: '1'   },
  { id: 'two',      label: '2',   value: '2'   },
  { id: 'three',    label: '3',   value: '3'   },
  { id: 'equals',   label: '=',   value: '='   },
  { id: 'zero',     label: '0',   value: '0'   },
  { id: 'dot',      label: '.',   value: '.'   },
  { id: 'negate',   label: '+/-', value: '+/-' },
];

export default function App() {
  const [display, setDisplay] = useState('0');
  const [expression, setExpression] = useState('');
  const [isNewCalculation, setIsNewCalculation] = useState(true);

  // useRef keeps state accessible in stable callback — no memory leak
  const stateRef = useRef({ display, expression, isNewCalculation });
  stateRef.current = { display, expression, isNewCalculation };

  const handleButtonClick = useCallback((value: string) => {
    const { display, expression, isNewCalculation } = stateRef.current;

    if (isNewCalculation && /^[0-9.]$/.test(value)) {
      setDisplay(value === '.' ? '0.' : value);
      setIsNewCalculation(false);
      return;
    }

    if (isNewCalculation && ['+', '-', '*', '/'].includes(value)) {
      setExpression(display + value);
      setDisplay('0');
      setIsNewCalculation(false);
      return;
    }

    switch (value) {
      case 'C':
        setDisplay('0');
        setExpression('');
        setIsNewCalculation(true);
        break;

      case '←':
        if (display === 'Error') {
          setDisplay('0');
          setIsNewCalculation(true);
        } else if (display.length === 1 || (display.length === 2 && display.startsWith('-'))) {
          setDisplay('0');
        } else {
          setDisplay(display.slice(0, -1));
        }
        break;

      case '=': {
        if (!expression) break;
        try {
          const result = safeEvaluate(expression + display);
          if (!isFinite(result)) {
            setDisplay('Error');
            setExpression('');
            setIsNewCalculation(true);
            break;
          }
          setDisplay(parseFloat(result.toFixed(10)).toString());
          setExpression('');
          setIsNewCalculation(true);
        } catch {
          setDisplay('Error');
          setExpression('');
          setIsNewCalculation(true);
        }
        break;
      }

      case '.':
        if (display === 'Error') break;
        if (!display.includes('.')) setDisplay(display + '.');
        break;

      case '+/-':
        if (display !== '0' && display !== 'Error') {
          setDisplay(display.startsWith('-') ? display.slice(1) : '-' + display);
        }
        break;

      default:
        if (['+', '-', '*', '/'].includes(value)) {
          if (display === 'Error') break;
          if (expression && display === '0') {
            setExpression(expression.slice(0, -1) + value);
          } else {
            setExpression(expression + display + value);
            setDisplay('0');
          }
        } else {
          if (display === 'Error') break;
          if (display === '0') {
            setDisplay(value);
          } else if (display.length < MAX_DISPLAY_LENGTH) {
            setDisplay(display + value);
          }
        }
    }
  }, []);

  // Added/removed only once — no memory leak
  useEffect(() => {
    const keyMap: Record<string, string> = {
      'Enter': '=', '=': '=',
      'Escape': 'C',
      'Backspace': '←',
      '+': '+', '-': '-', '*': '*', '/': '/',
      '.': '.',
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        handleButtonClick(e.key);
      } else if (keyMap[e.key]) {
        e.preventDefault();
        handleButtonClick(keyMap[e.key]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleButtonClick]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#1e1e1e] p-4">
      <div className="w-full max-w-xs rounded-2xl bg-[#252526] p-6 shadow-2xl">
        <div className="mb-4 h-20 w-full overflow-hidden rounded-xl bg-[#2d2d2d] p-4 text-right">
          {expression && (
            <div className="mb-1 truncate text-sm text-gray-400">{expression}</div>
          )}
          <div className="truncate text-3xl font-light text-white">{display}</div>
        </div>

        <div className="grid grid-cols-4 gap-3">
          {BUTTONS.map((btn) => (
            <button
              key={btn.id}
              onClick={() => handleButtonClick(btn.value)}
              className={`
                flex h-16 items-center justify-center rounded-xl text-xl font-medium
                transition-all duration-200 active:scale-95
                ${
                  btn.value === 'C' || btn.value === '←'
                    ? 'bg-[#3a3a3a] text-gray-200 hover:bg-[#454545]'
                    : btn.value === '='
                    ? 'bg-[#3a8dde] text-white hover:bg-[#4a9def]'
                    : ['+', '-', '*', '/'].includes(btn.value)
                    ? 'bg-[#3a3a3a] text-[#3a8dde] hover:bg-[#454545]'
                    : 'bg-[#2d2d2d] text-white hover:bg-[#3a3a3a]'
                }
                ${btn.value === '=' ? 'row-span-2 h-auto' : ''}
              `}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
