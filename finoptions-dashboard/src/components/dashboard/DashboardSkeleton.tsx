import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export function DashboardSkeleton({ symbol }: { symbol: string }) {
  return (
    <div className="space-y-4" aria-busy="true">
      <div className="text-sm text-muted-foreground">Analyzing {symbol}…</div>
      <Card>
        <CardContent className="flex flex-wrap items-center gap-6 pt-4">
          <Skeleton className="h-12 w-32" />
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-48" />
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((key) => (
          <Card key={key}>
            <CardContent className="space-y-2 pt-4">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-7 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {[0, 1, 2].map((key) => (
          <Card key={key}>
            <CardContent className="space-y-2 pt-4">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-32 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
