import { Field, FieldGrid } from '@/components/dashboard/Field'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { formatEnum, formatInteger, formatPercent } from '@/lib/formatters'
import type { NewsContext } from '@/types/trade-decision'

function sentimentVariant(sentiment: string | null) {
  if (sentiment === 'BULLISH') return 'bull' as const
  if (sentiment === 'BEARISH') return 'bear' as const
  return 'neutral' as const
}

export function NewsCard({ news }: { news: NewsContext }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center justify-between">
          <CardTitle>News Intelligence</CardTitle>
          {news.available ? (
            <Badge variant={sentimentVariant(news.sentiment)}>{formatEnum(news.sentiment)}</Badge>
          ) : null}
        </div>

        {news.available ? (
          <>
            <FieldGrid>
              <Field label="Sentiment Confidence" value={formatPercent(news.sentimentConfidence)} />
              <Field label="Market Risk Bias" value={formatEnum(news.marketRiskBias)} />
              <Field label="Risk Bias Confidence" value={formatPercent(news.riskBiasConfidence)} />
              <Field label="Impact" value={formatEnum(news.impact)} />
              <Field label="Article Count" value={formatInteger(news.articleCount)} />
            </FieldGrid>
            <div className="mt-3">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Dominant Catalysts
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {news.dominantCatalysts.length > 0 ? (
                  news.dominantCatalysts.map((catalyst) => (
                    <Badge key={catalyst} variant="outline">
                      {formatEnum(catalyst)}
                    </Badge>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground">No dominant catalysts</span>
                )}
              </div>
            </div>
          </>
        ) : (
          <p className="py-4 text-center text-sm text-muted-foreground">
            News intelligence unavailable
          </p>
        )}
      </CardContent>
    </Card>
  )
}
