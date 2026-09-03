import { Quote } from 'lucide-react'

import { Card, CardContent, CardTitle } from '@/components/ui/card'

export function ThesisCard({ thesis }: { thesis: string }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <CardTitle>Trade Thesis</CardTitle>
        <div className="mt-2 flex gap-3">
          <Quote className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
          <p className="text-base leading-relaxed">{thesis}</p>
        </div>
      </CardContent>
    </Card>
  )
}
