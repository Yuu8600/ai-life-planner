import type { Session, User } from '@supabase/supabase-js';

import { loginWithPassword, logout, signupWithPassword } from '@/services/supabase/auth';
import { getSupabaseClient } from '@/services/supabase/client';

jest.mock('@/services/supabase/client', () => ({
  getSupabaseClient: jest.fn(),
}));

const mockGetSupabaseClient = jest.mocked(getSupabaseClient);
const mockSignInWithPassword = jest.fn();
const mockSignUp = jest.fn();
const mockSignOut = jest.fn();

const testUser = {
  email: 'planner@example.com',
  id: '11111111-1111-4111-8111-111111111111',
} as User;

const testSession = {
  access_token: 'test-access-token',
  expires_in: 3600,
  refresh_token: 'test-refresh-token',
  token_type: 'bearer',
  user: testUser,
} as Session;

beforeEach(() => {
  jest.clearAllMocks();
  mockGetSupabaseClient.mockReturnValue({
    auth: {
      signInWithPassword: mockSignInWithPassword,
      signOut: mockSignOut,
      signUp: mockSignUp,
    },
  } as unknown as ReturnType<typeof getSupabaseClient>);
});

describe('Supabase auth service', () => {
  it('logs in with a trimmed email and returns the session', async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { session: testSession, user: testUser },
      error: null,
    });

    await expect(
      loginWithPassword({ email: '  planner@example.com  ', password: 'password123' }),
    ).resolves.toBe(testSession);
    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: 'planner@example.com',
      password: 'password123',
    });
  });

  it('signs up with a trimmed email and returns Supabase data', async () => {
    mockSignUp.mockResolvedValue({
      data: { session: null, user: testUser },
      error: null,
    });

    await expect(
      signupWithPassword({ email: ' planner@example.com ', password: 'password123' }),
    ).resolves.toEqual({ session: null, user: testUser });
    expect(mockSignUp).toHaveBeenCalledWith({
      email: 'planner@example.com',
      password: 'password123',
    });
  });

  it('logs out only the session stored on this device', async () => {
    mockSignOut.mockResolvedValue({ error: null });

    await expect(logout()).resolves.toBeUndefined();
    expect(mockSignOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('propagates an invalid login error without replacing it', async () => {
    const invalidLoginError = new Error('Invalid login credentials');
    mockSignInWithPassword.mockResolvedValue({
      data: { session: null, user: null },
      error: invalidLoginError,
    });

    await expect(
      loginWithPassword({ email: 'planner@example.com', password: 'wrong-password' }),
    ).rejects.toBe(invalidLoginError);
  });
});
