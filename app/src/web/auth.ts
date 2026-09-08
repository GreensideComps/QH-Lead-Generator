import type { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import { servicePool } from "../db/pool.js";

export interface SessionUser {
  userId: string;
  businessId: string;
  businessName: string;
}

// cookie-session attaches `session` to req; typed loosely here to avoid
// pulling in @types churn for a dev-scale auth layer.
export async function attemptLogin(email: string, password: string): Promise<SessionUser | null> {
  const { rows } = await servicePool.query(
    `select u.id as user_id, u.password_hash, ub.business_id, b.name as business_name
     from users u
     join user_businesses ub on ub.user_id = u.id
     join businesses b on b.id = ub.business_id
     where u.email = $1
     limit 1`,
    [email],
  );
  if (!rows.length) return null;

  const ok = await bcrypt.compare(password, rows[0].password_hash);
  if (!ok) return null;

  return { userId: rows[0].user_id, businessId: rows[0].business_id, businessName: rows[0].business_name };
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const session = (req as any).session;
  if (!session?.userId || !session?.businessId) {
    res.redirect("/login");
    return;
  }
  next();
}

export function currentUser(req: Request): SessionUser | null {
  const session = (req as any).session;
  if (!session?.userId) return null;
  return { userId: session.userId, businessId: session.businessId, businessName: session.businessName };
}
