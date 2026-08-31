/** Subset of Massive's `/v2/reference/news` payload that this module reads. */
export interface MassiveNewsInsight {
  ticker?: string;
  sentiment?: string;
  sentiment_reasoning?: string;
}

export interface MassiveNewsPublisher {
  name?: string;
}

export interface MassiveNewsItem {
  id?: string;
  publisher?: MassiveNewsPublisher;
  title?: string;
  author?: string;
  published_utc?: string;
  article_url?: string;
  tickers?: string[];
  description?: string;
  keywords?: string[];
  insights?: MassiveNewsInsight[];
}

export interface MassiveNewsResponse {
  results?: MassiveNewsItem[];
  status?: string;
  count?: number;
}
