export class AppError extends Error {
  readonly httpStatus: number;
  readonly code: string;

  constructor(httpStatus: number, code: string, message: string) {
    super(message);
    this.name = 'AppError';
    this.httpStatus = httpStatus;
    this.code = code;
  }
}

export const errors = {
  notFound: (msg = 'Not found') => new AppError(404, 'not_found', msg),
  gone: (msg = 'Session expired or ended') => new AppError(410, 'gone', msg),
  locked: (msg = 'Temporarily locked') => new AppError(423, 'locked', msg),
  invalidSecret: (msg = 'Invalid secret') =>
    new AppError(401, 'invalid_secret', msg),
  badRequest: (msg = 'Bad request') => new AppError(400, 'bad_request', msg),
  unsupportedMedia: (msg = 'Unsupported media type') =>
    new AppError(415, 'unsupported_media', msg),
};
