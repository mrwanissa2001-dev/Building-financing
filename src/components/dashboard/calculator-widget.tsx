"use client"

import { useState, useCallback } from "react"
import { useI18n } from "@/lib/i18n"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Delete } from "lucide-react"

/**
 * Calculator Widget: A self-contained floating calculator for quick math operations.
 * Features: 0-9 digits, decimal point, operators (+, -, *, /), equals, clear, backspace.
 * Keyboard support: number keys, operators, Enter (equals), Escape (clear), Backspace.
 */
export function CalculatorWidget() {
  const { t } = useI18n()

  const [display, setDisplay] = useState("0")
  const [accumulator, setAccumulator] = useState<number | null>(null)
  const [operation, setOperation] = useState<string | null>(null)
  const [fresh, setFresh] = useState(true)

  // Handle digit input
  const handleDigit = useCallback((digit: string) => {
    setDisplay((prev) => {
      if (fresh) {
        setFresh(false)
        return digit
      }
      if (prev === "0" && digit !== ".") {
        return digit
      }
      if (digit === "." && prev.includes(".")) {
        return prev
      }
      return prev + digit
    })
  }, [fresh])

  // Handle operator input
  const handleOperator = useCallback((op: string) => {
    const num = parseFloat(display)
    if (accumulator !== null && operation && !fresh) {
      // Perform pending operation
      let result = accumulator
      switch (operation) {
        case "+":
          result = accumulator + num
          break
        case "-":
          result = accumulator - num
          break
        case "*":
          result = accumulator * num
          break
        case "/":
          result = accumulator / num
          break
      }
      setDisplay(result.toString())
      setAccumulator(result)
    } else {
      setAccumulator(num)
    }
    setOperation(op)
    setFresh(true)
  }, [display, accumulator, operation, fresh])

  // Handle equals
  const handleEquals = useCallback(() => {
    if (accumulator === null || operation === null) return
    const num = parseFloat(display)
    let result = accumulator
    switch (operation) {
      case "+":
        result = accumulator + num
        break
      case "-":
        result = accumulator - num
        break
      case "*":
        result = accumulator * num
        break
      case "/":
        result = accumulator / num
        break
    }
    setDisplay(result.toString())
    setAccumulator(null)
    setOperation(null)
    setFresh(true)
  }, [display, accumulator, operation])

  // Handle clear
  const handleClear = useCallback(() => {
    setDisplay("0")
    setAccumulator(null)
    setOperation(null)
    setFresh(true)
  }, [])

  // Handle backspace
  const handleBackspace = useCallback(() => {
    setDisplay((prev) => {
      if (fresh) return "0"
      if (prev.length === 1) {
        setFresh(true)
        return "0"
      }
      return prev.slice(0, -1)
    })
  }, [fresh])

  // Handle keyboard input
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const key = e.key
      if (/^[0-9]$/.test(key)) {
        e.preventDefault()
        handleDigit(key)
      } else if (key === ".") {
        e.preventDefault()
        handleDigit(".")
      } else if (key === "+") {
        e.preventDefault()
        handleOperator("+")
      } else if (key === "-" && !e.shiftKey) {
        e.preventDefault()
        handleOperator("-")
      } else if (key === "*" || key === "x" || key === "X") {
        e.preventDefault()
        handleOperator("*")
      } else if (key === "/" || (key === ":" && e.shiftKey)) {
        e.preventDefault()
        handleOperator("/")
      } else if (key === "Enter") {
        e.preventDefault()
        handleEquals()
      } else if (key === "Escape") {
        e.preventDefault()
        handleClear()
      } else if (key === "Backspace") {
        e.preventDefault()
        handleBackspace()
      }
    },
    [handleDigit, handleOperator, handleEquals, handleClear, handleBackspace]
  )

  const buttonClass = "h-10 rounded-lg font-medium transition-colors"
  const digitButtonClass = `${buttonClass} bg-muted text-foreground hover:bg-muted/80`
  const operatorButtonClass = `${buttonClass} bg-primary text-primary-foreground hover:bg-primary/90`

  return (
    <Card className="p-5" onKeyDown={handleKeyDown} tabIndex={0}>
      <div className="space-y-4">
        <div>
          <h2 className="font-semibold tracking-tight">{t("Calculator")}</h2>
        </div>

        {/* Display */}
        <div className="rounded-lg bg-muted p-4">
          <p className="font-mono text-right text-2xl font-semibold text-foreground break-words">{display}</p>
        </div>

        {/* Button Grid */}
        <div className="grid grid-cols-4 gap-2">
          {/* Row 1 */}
          <Button
            onClick={handleClear}
            className={`${operatorButtonClass} col-span-2`}
            aria-label={t("Clear")}
          >
            {t("Clear")}
          </Button>
          <Button
            onClick={handleBackspace}
            className={operatorButtonClass}
            aria-label={t("Backspace")}
            title="Backspace"
          >
            <Delete className="h-4 w-4" />
          </Button>
          <Button
            onClick={() => handleOperator("/")}
            className={operatorButtonClass}
            aria-label="Divide"
          >
            ÷
          </Button>

          {/* Row 2 */}
          <Button onClick={() => handleDigit("7")} className={digitButtonClass}>
            7
          </Button>
          <Button onClick={() => handleDigit("8")} className={digitButtonClass}>
            8
          </Button>
          <Button onClick={() => handleDigit("9")} className={digitButtonClass}>
            9
          </Button>
          <Button
            onClick={() => handleOperator("*")}
            className={operatorButtonClass}
            aria-label="Multiply"
          >
            ×
          </Button>

          {/* Row 3 */}
          <Button onClick={() => handleDigit("4")} className={digitButtonClass}>
            4
          </Button>
          <Button onClick={() => handleDigit("5")} className={digitButtonClass}>
            5
          </Button>
          <Button onClick={() => handleDigit("6")} className={digitButtonClass}>
            6
          </Button>
          <Button
            onClick={() => handleOperator("-")}
            className={operatorButtonClass}
            aria-label="Subtract"
          >
            −
          </Button>

          {/* Row 4 */}
          <Button onClick={() => handleDigit("1")} className={digitButtonClass}>
            1
          </Button>
          <Button onClick={() => handleDigit("2")} className={digitButtonClass}>
            2
          </Button>
          <Button onClick={() => handleDigit("3")} className={digitButtonClass}>
            3
          </Button>
          <Button
            onClick={() => handleOperator("+")}
            className={operatorButtonClass}
            aria-label="Add"
          >
            +
          </Button>

          {/* Row 5 */}
          <Button onClick={() => handleDigit("0")} className={`${digitButtonClass} col-span-2`}>
            0
          </Button>
          <Button onClick={() => handleDigit(".")} className={digitButtonClass}>
            .
          </Button>
          <Button onClick={handleEquals} className={operatorButtonClass} aria-label="Equals">
            =
          </Button>
        </div>
      </div>
    </Card>
  )
}
