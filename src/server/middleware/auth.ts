import { Request, Response, NextFunction } from "express";
import { verifyAuthToken, AuthTokenPayload } from "../auth/tokens.ts";

// Extend Express's Request type with the authenticated user.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthTokenPayload;
    }
  }
}

/**
 * Reads the Bearer token, verifies it, and attaches the decoded payload to
 * req.user. Rejects the request with 401 if missing/invalid/expired.
 *
 * This is the ONLY source of truth for "who is this" and "what role do they
 * have" on the server. The client is never trusted to self-report its role.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or malformed Authorization header" });
  }

  const token = header.slice("Bearer ".length);
  try {
    req.user = verifyAuthToken(token);
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired session. Please log in again." });
  }
}

/**
 * Restricts a route to one or more roles. Verifies the token itself first
 * (via requireAuth) so callers don't have to remember to chain requireAuth
 * before this - a route that only lists requireRole/requireAdmin in its
 * middleware chain still gets full authentication, not just a role check.
 */
export function requireRole(...roles: Array<"ADMIN" | "TECHNICIAN">) {
  return (req: Request, res: Response, next: NextFunction) => {
    requireAuth(req, res, (err?: unknown) => {
      if (err) return next(err);
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      if (!roles.includes(req.user.role)) {
        return res.status(403).json({
          error: `Forbidden: this action requires role ${roles.join(" or ")}`,
        });
      }
      next();
    });
  };
}

export const requireAdmin = requireRole("ADMIN");