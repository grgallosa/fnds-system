import { Request, Response, NextFunction, RequestHandler } from "express";

/**
 * Wraps an async Express handler so thrown errors / rejected promises are
 * forwarded to Express's error middleware instead of crashing the process
 * or hanging the request.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function notFound(resource: string): ApiError {
  return new ApiError(404, `${resource} not found`);
}
