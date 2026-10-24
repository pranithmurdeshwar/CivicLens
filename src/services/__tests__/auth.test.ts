import { describe, it, expect, beforeEach } from 'vitest';
import { resetTestState } from './helpers';
import {
  getCurrentUser,
  isLoggedIn,
  listAllUsers,
  logout,
  switchUser,
  userToActor,
  currentUserActor,
  DEMO_USERS,
} from '../auth';
import { setSessionUserId } from '../db';

beforeEach(() => {
  resetTestState();
  // Clear any existing session
  setSessionUserId(null);
});

describe('authentication & session service', () => {
  it('correctly lists all demo users with resident and admin roles', () => {
    const users = listAllUsers();
    expect(users.length).toBe(DEMO_USERS.length);
    const residents = users.filter((u) => u.role === 'resident');
    const admins = users.filter((u) => u.role === 'admin');
    expect(residents.length).toBe(4);
    expect(admins.length).toBe(1);
    expect(admins[0].id).toBe('u-meera');
  });

  it('reports isLoggedIn as false when no session is active', () => {
    expect(isLoggedIn()).toBe(false);
  });

  it('logs in a user with switchUser and sets isLoggedIn to true', () => {
    const user = switchUser('u-aarav');
    expect(user.id).toBe('u-aarav');
    expect(user.role).toBe('resident');
    expect(isLoggedIn()).toBe(true);
    expect(getCurrentUser().id).toBe('u-aarav');
  });

  it('logs in an administrator with switchUser', () => {
    const admin = switchUser('u-meera');
    expect(admin.id).toBe('u-meera');
    expect(admin.role).toBe('admin');
    expect(isLoggedIn()).toBe(true);
    expect(getCurrentUser().id).toBe('u-meera');
    const actor = currentUserActor();
    expect(actor.role).toBe('admin');
    expect(actor.kind).toBe('user');
  });

  it('throws an error when switching to an unknown user ID', () => {
    expect(() => switchUser('u-non-existent')).toThrow('Unknown demo user.');
  });

  it('logs out and clears session', () => {
    switchUser('u-priya');
    expect(isLoggedIn()).toBe(true);

    logout();
    expect(isLoggedIn()).toBe(false);
  });

  it('converts a user to an actor object correctly', () => {
    const user = switchUser('u-devika');
    const actor = userToActor(user);
    expect(actor).toEqual({
      id: 'u-devika',
      role: 'resident',
      kind: 'user',
    });
  });
});
