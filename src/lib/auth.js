import { getToken } from "next-auth/jwt";

export async function getUser(req) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  return token;
}

export async function requireAuth(req) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) {
    throw new Error("Unauthorized");
  }
  return token;
}

export async function requireAdmin(req) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) {
    throw new Error("Unauthorized");
  }
  if (!token.isAdmin) {
    throw new Error("Forbidden");
  }
  return token;
}
