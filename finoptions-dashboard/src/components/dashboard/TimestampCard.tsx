import { Clock } from 'lucide-react'

import { Card, CardContent, CardTitle } from '@/components/ui/card'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { formatEasternDate, formatEasternTime } from '@/lib/formatters'

export function TimestampCard({ timestamp }: { timestamp: string }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <CardTitle className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" /> Timestamp
        </CardTitle>
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="mt-2 cursor-help">
                <div className="text-lg font-semibold">{formatEasternDate(timestamp)}</div>
                <div className="tabular text-sm text-muted-foreground">
                  {formatEasternTime(timestamp)}
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent className="font-mono">{timestamp}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </CardContent>
    </Card>
  )
}
