import { Router } from "express";
import rateLimit from "express-rate-limit";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.ts";
import { users, technicians } from "../../db/schema.ts";
import { comparePassword } from "../auth/passwords.ts";
import { signAuthToken } from "../auth/tokens.ts";
import { validateBody } from "../middleware/validate.ts";
import { loginSchema } from "../validation/schemas.ts";
import { asyncHandler, ApiError } from "../utils/asyncHandler.ts";
import { requireAuth } from "../middleware/auth.ts";

const router = Router();

// Throttle brute-force login attempts per IP. Deliberately scoped to just
// this route - /me doesn't take a password, so there's nothing to
// brute-force there and no reason to rate-limit it.
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 10, // 10 attempts per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Please try again later." },
});

router.post(
  "/login",
  loginRateLimiter,
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const { username, password } = req.body;

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.username, username));

    if (!user || !user.isActive) {
      throw new ApiError(401, "Invalid username or password");
    }

    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) {
      throw new ApiError(401, "Invalid username or password");
    }

    let technicianId: string | null = null;
    if (user.role === "TECHNICIAN") {
      const [tech] = await db
        .select({ id: technicians.id })
        .from(technicians)
        .where(eq(technicians.userId, user.id));
      technicianId = tech?.id ?? null;
    }

    await db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, user.id));

    const token = signAuthToken({
      userId: user.id,
      username: user.username,
      role: user.role,
      technicianId,
    });

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        technicianId,
      },
    });
  })
);

// Lets the frontend verify an existing token / restore a session on refresh.
router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ user: req.user });
  })
);

export default router;
