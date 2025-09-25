import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { authLogger } from '@/lib/logger';

const authOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          authLogger.warn('Tentativa de login sem credenciais');
          return null;
        }

        // Validação básica - em produção, integrar com LDAP ou banco de dados
        const validUsername = process.env.USERNAME || 'admin';
        const validPassword = process.env.PASSWORD || 'admin123';

        if (credentials.username === validUsername && credentials.password === validPassword) {
          authLogger.info(`Login bem-sucedido para usuário: ${credentials.username}`);
          return {
            id: '1',
            name: 'Administrador',
            email: 'admin@escola.com',
            role: 'admin'
          };
        }

        authLogger.warn(`Tentativa de login falhada para usuário: ${credentials.username}`);
        return null;
      },
    }),
  ],
  pages: {
    signIn: '/auth/signin',
  },
  callbacks: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async jwt({ token, user }: { token: any; user: any }) {
      if (user) {
        token.role = user.role;
      }
      return token;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async session({ session, token }: { session: any; token: any }) {
      if (token) {
        session.user.id = token.sub;
        session.user.role = token.role;
      }
      return session;
    },
  },
  session: {
    strategy: 'jwt' as const,
    maxAge: 24 * 60 * 60, // 24 horas
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };