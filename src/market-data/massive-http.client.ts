import {
  BadGatewayException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  MASSIVE_CONFIG_KEY,
  type MassiveConfig,
} from './market-data.config.js';

/**
 * Shared transport for the Massive REST API: authentication, timeouts and
 * status mapping. Endpoint paths and payload shapes stay with the callers.
 */
@Injectable()
export class MassiveHttpClient implements OnModuleInit {
  private readonly logger = new Logger(MassiveHttpClient.name);
  readonly config: MassiveConfig;

  constructor(configService: ConfigService) {
    this.config = configService.getOrThrow<MassiveConfig>(MASSIVE_CONFIG_KEY);
  }

  onModuleInit(): void {
    if (!this.config.apiKey) {
      this.logger.error(
        'MASSIVE_API_KEY is not set; Massive requests will fail until it is configured.',
      );
    }
  }

  /** Performs an authenticated GET and returns the decoded JSON body. */
  async getJson(url: string, context: string): Promise<unknown> {
    if (!this.config.apiKey) {
      throw new ServiceUnavailableException(
        'Market data provider is not configured.',
      );
    }

    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(this.config.requestTimeoutMs),
      });
    } catch (error) {
      const reason = error instanceof Error ? error.name : 'UnknownError';
      this.logger.error(
        `Market data request for ${context} failed before a response was received (${reason})`,
      );
      throw new ServiceUnavailableException(
        'Market data provider is unreachable. Please retry shortly.',
      );
    }

    if (!response.ok) {
      throw this.toHttpException(response.status, context);
    }

    return response.json().catch(() => undefined) as Promise<unknown>;
  }

  private toHttpException(status: number, context: string): HttpException {
    if (status === HttpStatus.UNAUTHORIZED || status === HttpStatus.FORBIDDEN) {
      this.logger.error(
        `Market data provider rejected the configured credentials (HTTP ${status}) while fetching ${context}`,
      );
      return new ServiceUnavailableException(
        'Market data provider credentials are invalid or lack access to this data.',
      );
    }
    if (status === HttpStatus.TOO_MANY_REQUESTS) {
      this.logger.warn(
        `Market data provider rate limited request for ${context}`,
      );
      return new HttpException(
        'Market data provider rate limit exceeded. Please retry shortly.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    if (status >= 500) {
      this.logger.error(
        `Market data provider returned HTTP ${status} for ${context}`,
      );
      return new BadGatewayException(
        'Market data provider is currently failing. Please retry shortly.',
      );
    }
    this.logger.error(
      `Market data request for ${context} failed with HTTP ${status}`,
    );
    return new BadGatewayException('Market data request failed.');
  }
}
