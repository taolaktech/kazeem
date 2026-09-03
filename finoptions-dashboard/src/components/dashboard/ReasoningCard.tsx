import { CheckCircle2, Info } from 'lucide-react'

import { Card, CardContent, CardTitle } from '@/components/ui/card'

const POSITIVE_HINTS = ['confirm', 'supports', 'aligned', 'breakout', 'within budget']

function isConfirmation(line: string): boolean {
  const lower = line.toLowerCase()
  return POSITIVE_HINTS.some((hint) => lower.includes(hint))
}

export function ReasoningCard({ reasoning }: { reasoning: string[] }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <CardTitle>Reasoning</CardTitle>
        <ul className="mt-2 space-y-1.5">
          {reasoning.map((line, index) => {
            const Icon = isConfirmation(line) ? CheckCircle2 : Info
            return (
              <li key={`${index}-${line}`} className="flex gap-2 text-xs leading-relaxed">
                <Icon
                  className={
                    isConfirmation(line)
                      ? 'mt-0.5 h-3.5 w-3.5 shrink-0 text-bull'
                      : 'mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground'
                  }
                />
                <span>{line}</span>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
