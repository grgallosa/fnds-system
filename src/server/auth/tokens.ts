import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error(
    "JWT_SECRET must be set in environment variables. Generate one with: node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\""
  );
}

export interface AuthTokenPayload {
  userId: string;
  username: string;
  role: "ADMIN" | "TECHNICIAN";
  technicianId?: string | null;
}

const TOKEN_TTL = "12h";

export function signAuthToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, JWT_SECRET as string, { expiresIn: TOKEN_TTL });
}

export function verifyAuthToken(token: string): AuthTokenPayload {
  return jwt.verify(token, JWT_SECRET as string) as AuthTokenPayload;
}
