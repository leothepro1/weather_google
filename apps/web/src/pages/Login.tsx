import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { setToken } from '../lib/auth.js';

export function Login() {
  const [value, setValue] = useState('');
  const navigate = useNavigate();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    setToken(value.trim());
    navigate('/', { replace: true });
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <form
        onSubmit={submit}
        className="w-full max-w-sm space-y-4 rounded-lg bg-white p-6 shadow"
      >
        <h1 className="text-xl font-semibold">Weather Budget Modifier</h1>
        <label className="block text-sm font-medium">
          Admin token
          <input
            type="password"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 focus:border-slate-500 focus:outline-none"
            autoFocus
          />
        </label>
        <button
          type="submit"
          className="w-full rounded bg-slate-900 px-3 py-2 text-white hover:bg-slate-700 disabled:opacity-50"
          disabled={!value.trim()}
        >
          Sign in
        </button>
      </form>
    </main>
  );
}
