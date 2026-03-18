import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { supabase } from "@/lib/supabase";

const handler = NextAuth({
  secret: process.env.NEXTAUTH_SECRET,
  trustHost: true,
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          return null;
        }

        // Check if this is the admin user from env
        if (
          credentials.username === process.env.USER1_NAME &&
          credentials.password === process.env.USER1_PASSWORD
        ) {
          return {
            id: credentials.username,
            name: credentials.username,
            isAdmin: true,
          };
        }

        // Try to authenticate from Supabase users table
        try {
          const { data: dbUser, error } = await supabase
            .from("users")
            .select("id, username, password, is_admin")
            .eq("username", credentials.username)
            .maybeSingle();

          if (!error && dbUser && dbUser.password === credentials.password) {
            return {
              id: dbUser.id,
              name: dbUser.username,
              isAdmin: dbUser.is_admin || false,
            };
          }
        } catch {
          // Fall through if database fails
        }

        return null;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.name) {
        token.name = user.name;
      }

      if (user?.id) {
        token.sub = user.id;
      }

      if (user?.isAdmin !== undefined) {
        token.isAdmin = user.isAdmin;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.name = token.name || "User";
        session.user.isAdmin = token.isAdmin || false;
      }

      return session;
    },
  },
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
});

export { handler as GET, handler as POST };
