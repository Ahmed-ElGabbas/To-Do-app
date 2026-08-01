import { SetMetadata } from '@nestjs/common';

export const SKIP_TRANSFORM_KEY = 'skipTransform';

/**
 * Excludes a route/controller from the global TransformInterceptor envelope.
 * Used where the response shape must stay framework-standard (e.g. health checks).
 */
export const SkipTransform = () => SetMetadata(SKIP_TRANSFORM_KEY, true);
