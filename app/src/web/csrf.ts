import crypto from "node:crypto";
import type { Request, Response, NextFunction } from "express";

/**
 * Synchronizer-token CSRF protection. Deliberately hand-rolled rather than
 * a dependency — this app has no client-side JS (every state change is a
 * plain HTML form POST), so a session-bound hidden-field token is the
 * whole mechanism: no double-submit cookie, no header variant needed.
 *
 * Session-bound (not per-request) so a user can have several tabs/forms
 * open without one submission invalidating another's token.
 */
export function ensureCsrfToken(req: Request, _res: Response, next: NextFunction) {
  const session = (req as any).session;
  if (session && !session.csrfToken) {
    session.csrfToken = crypto.randomBytes(24).toString("hex");
  }
  next();
}

export function verifyCsrf(req: Request, res: Response, next: NextFunction) {
  const session = (req as any).session;
  const submitted = req.body?._csrf;
  if (!session?.csrfToken || typeof submitted !== "string" || !timingSafeEqual(submitted, session.csrfToken)) {
    res.status(403).send("Your session expired or this form was submitted from an untrusted page. Please go back and try again.");
    return;
  }
  next();
}

function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function csrfField(token: string): string {
  return `<input type="hidden" name="_csrf" value="${token}">`;
}
