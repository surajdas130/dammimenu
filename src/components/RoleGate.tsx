import { useState } from 'react';
import { Lock, ShieldCheck, Smartphone, Delete } from 'lucide-react';
import type { Role } from '@shared/types';
import { api } from '@/lib/api';
import {
  getOrCreateDeviceId,
  getStoredDeviceName,
  saveRoleAuth,
  setStoredDeviceName,
  type StoredRoleAuth,
} from '@/lib/device';

interface RoleGateProps {
  role: Role;
  title: string;
  subtitle: string;
  defaultDeviceLabel: string;
  onAuthenticated: (auth: StoredRoleAuth) => void;
}

export function RoleGate({
  role,
  title,
  subtitle,
  defaultDeviceLabel,
  onAuthenticated,
}: RoleGateProps) {
  const [pin, setPin] = useState('');
  const [deviceName, setDeviceName] = useState(() => getStoredDeviceName(defaultDeviceLabel));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const deviceId = getOrCreateDeviceId();

  const submitPin = async (pinValue: string) => {
    if (!pinValue.trim()) {
      setError('Enter the dashboard password/PIN');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const cleanName = deviceName.trim() || defaultDeviceLabel;
      setStoredDeviceName(cleanName);
      const res = await api.login({
        role,
        pin: pinValue,
        deviceId,
        deviceName: cleanName,
      });
      const auth: StoredRoleAuth = {
        deviceId: res.session.deviceId,
        deviceName: res.session.deviceName,
        role,
        passwordVersion: res.session.passwordVersion,
      };
      saveRoleAuth(auth);
      onAuthenticated(auth);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid password');
      setPin('');
    } finally {
      setSubmitting(false);
    }
  };

  const appendDigit = (digit: string) => {
    if (pin.length < 12) {
      setPin((prev) => prev + digit);
      setError(null);
    }
  };

  return (
    <div className="mx-auto my-8 max-w-md px-4">
      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-xl">
        <div className="bg-neutral-950 px-6 py-6 text-white">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-2 rounded-full bg-red-600/20 px-3 py-1 text-xs font-bold uppercase tracking-wider text-red-400 border border-red-500/30">
              <Lock className="h-3.5 w-3.5" />
              Protected Terminal
            </span>
            <span className="text-xs font-mono text-neutral-400">{deviceId}</span>
          </div>
          <h2 className="mt-4 text-2xl font-extrabold tracking-tight">{title}</h2>
          <p className="mt-1 text-sm text-neutral-300">{subtitle}</p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submitPin(pin);
          }}
          className="space-y-5 p-6"
        >
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-neutral-600">
              <Smartphone className="h-3.5 w-3.5 text-red-600" />
              Device Name
            </label>
            <input
              type="text"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              placeholder={defaultDeviceLabel}
              className="w-full rounded-xl border border-neutral-300 bg-neutral-50 px-3.5 py-2.5 text-sm font-medium text-neutral-900 focus:border-red-600 focus:bg-white focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-neutral-600">
              Access Password / PIN
            </label>
            <input
              type="password"
              value={pin}
              onChange={(e) => {
                setPin(e.target.value);
                setError(null);
              }}
              placeholder="Enter PIN (e.g. 1234)"
              autoFocus
              className="w-full rounded-xl border-2 border-neutral-200 bg-neutral-50 px-4 py-3 text-center text-xl font-extrabold tracking-[0.35em] text-neutral-900 focus:border-red-600 focus:bg-white focus:outline-none"
            />
          </div>

          {/* Quick Touch Keypad */}
          <div className="grid grid-cols-3 gap-2">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'Clear', '0', 'Del'].map((key) => {
              if (key === 'Clear') {
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setPin('')}
                    className="rounded-xl border border-neutral-200 bg-neutral-100 py-2.5 text-xs font-bold uppercase text-neutral-700 hover:bg-neutral-200 active:scale-95 transition"
                  >
                    Clear
                  </button>
                );
              }
              if (key === 'Del') {
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setPin((p) => p.slice(0, -1))}
                    className="flex items-center justify-center rounded-xl border border-neutral-200 bg-neutral-100 py-2.5 text-neutral-700 hover:bg-neutral-200 active:scale-95 transition"
                  >
                    <Delete className="h-4 w-4" />
                  </button>
                );
              }
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => appendDigit(key)}
                  className="rounded-xl border border-neutral-200 bg-white py-2.5 text-base font-bold text-neutral-900 shadow-xs hover:border-red-300 hover:bg-red-50 active:scale-95 transition"
                >
                  {key}
                </button>
              );
            })}
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-semibold text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-red-700 disabled:opacity-60 transition cursor-pointer"
          >
            <ShieldCheck className="h-4 w-4" />
            {submitting ? 'Verifying...' : `Unlock ${role.charAt(0).toUpperCase() + role.slice(1)} Dashboard`}
          </button>

          <p className="text-center text-xs text-neutral-500">
            Passwords & device access are managed live from the Manager Console.
          </p>
        </form>
      </div>
    </div>
  );
}
