import { ComponentContext, DataSourceDefinition, IDataSource } from '../../../src';
import { User, LoginInput, AuthPayload } from './types';

// Mock JWT operations (in real app, use proper JWT library)
const JWT_SECRET = 'demo-secret-key';

interface JWTPayload {
  userId: string;
  username: string;
  roles: string[];
  iat: number;
  exp: number;
}

export default class AuthDataSource implements DataSourceDefinition<AuthDataSource>, IDataSource {
  name = 'auth';

  // Mock user database
  private users: Map<string, User & { password: string }> = new Map([
    ['1', {
      id: '1',
      username: 'admin',
      email: 'admin@example.com',
      roles: ['admin', 'user'],
      createdAt: new Date().toISOString(),
      password: 'admin123' // In real app, this would be hashed
    }],
    ['2', {
      id: '2',
      username: 'user',
      email: 'user@example.com',
      roles: ['user'],
      createdAt: new Date().toISOString(),
      password: 'user123'
    }],
    ['3', {
      id: '3',
      username: 'guest',
      email: 'guest@example.com',
      roles: ['guest'],
      createdAt: new Date().toISOString(),
      password: 'guest123'
    }]
  ]);

  async login(context: ComponentContext, input: LoginInput): Promise<AuthPayload> {
    const user = Array.from(this.users.values())
      .find(u => u.username === input.username);

    if (!user || user.password !== input.password) {
      throw new Error('Invalid credentials');
    }

    const token = this.generateToken({
      userId: user.id,
      username: user.username,
      roles: user.roles,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24) // 24 hours
    });

    const { password, ...publicUser } = user;
    return { token, user: publicUser };
  }

  async validateToken(context: ComponentContext, token: string): Promise<User | null> {
    try {
      console.log('🔍 AuthDataSource.validateToken called with token:', token?.substring(0, 20) + '...');
      const payload = this.verifyToken(token);
      console.log('🔍 JWT payload:', payload);
      
      const user = this.users.get(payload.userId);
      console.log('🔍 Found user:', user ? user.username : 'null');
      
      if (!user) {
        console.log('❌ User not found for userId:', payload.userId);
        return null;
      }

      const { password, ...publicUser } = user;
      console.log('✅ Token validation successful for user:', publicUser.username);
      return publicUser;
    } catch (error) {
      console.log('❌ Token validation failed:', error.message);
      return null;
    }
  }

  async getUserById(context: ComponentContext, id: string): Promise<User | null> {
    const user = this.users.get(id);
    if (!user) {
      return null;
    }

    const { password, ...publicUser } = user;
    return publicUser;
  }

  async getAllUsers(context: ComponentContext): Promise<User[]> {
    return Array.from(this.users.values()).map(({ password, ...user }) => user);
  }

  // Mock JWT implementation (use real JWT library in production)
  private generateToken(payload: JWTPayload): string {
    // This is a simplified mock - use proper JWT library like jsonwebtoken
    const header = { alg: 'HS256', typ: 'JWT' };
    const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64');
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64');
    const signature = Buffer.from(`${encodedHeader}.${encodedPayload}.${JWT_SECRET}`).toString('base64');
    
    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  private verifyToken(token: string): JWTPayload {
    // This is a simplified mock - use proper JWT library like jsonwebtoken
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid token format');
    }

    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    
    // Check expiration
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      throw new Error('Token expired');
    }

    // Verify signature (simplified)
    const expectedSignature = Buffer.from(`${parts[0]}.${parts[1]}.${JWT_SECRET}`).toString('base64');
    if (parts[2] !== expectedSignature) {
      throw new Error('Invalid token signature');
    }

    return payload;
  }
} 