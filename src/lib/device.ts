import type { Role } from '@shared/types';

const DEVICE_ID_KEY = 'ct_device_id';
const DEVICE_NAME_KEY = 'ct_device_name';

export interface StoredRoleAuth {
  deviceId: string;
  deviceName: string;
  role: Role;
  passwordVersion: number;
}

export function getOrCreateDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
    id = `DEV-${rand}`;
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

export function getStoredDeviceName(defaultName: string): string {
  return localStorage.getItem(DEVICE_NAME_KEY) || defaultName;
}

export function setStoredDeviceName(name: string): void {
  localStorage.setItem(DEVICE_NAME_KEY, name);
}

export function getRoleAuth(role: Role): StoredRoleAuth | null {
  try {
    const raw = localStorage.getItem(`ct_auth_${role}`);
    if (!raw) return null;
    return JSON.parse(raw) as StoredRoleAuth;
  } catch {
    return null;
  }
}

export function saveRoleAuth(auth: StoredRoleAuth): void {
  localStorage.setItem(`ct_auth_${auth.role}`, JSON.stringify(auth));
}

export function clearRoleAuth(role: Role): void {
  localStorage.removeItem(`ct_auth_${role}`);
}
