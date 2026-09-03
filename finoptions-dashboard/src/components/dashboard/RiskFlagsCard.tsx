import { TriangleAlert } from 'lucide-react'

import { Card, CardContent, CardTitle } from '@/components/ui/card'

export function RiskFlagsCard({ riskFlags }: { riskFlags: string[] }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <CardTitle>Risk Flags</CardTitle>
        {riskFlags.length > 0 ? (
          <ul className="mt-2 space-y-1.5">
            {riskFlags.map((flag) => (
              <li key={flag} className="flex gap-2 text-xs leading-relaxed">
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warn" />
                <span>{flag}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">No active risk flags</p>
        )}
      </CardContent>
    </Card>
  )
}
