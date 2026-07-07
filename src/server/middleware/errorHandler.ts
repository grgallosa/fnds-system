import { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/asyncHandler.ts";

/**
 * Single place that turns any thrown error into a consistent JSON response.
 * Must be registered LAST, after all routes.
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({ error: err.message });
  }

  console.error("Unhandled server error:", err);
  res.status(500).json({ error: "Something went wrong. Please try again." });
}
