'use client';

import { useEffect, useState } from 'react';
import { Users, Spinner, ShieldCheck, Shield, Trash } from '@phosphor-icons/react';

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  userType: string;
  authMethods: string[];
  createdAt?: string;
  pk?: string;
}

const providerLabels: Record<string, string> = {
  google: 'Google',
  credentials: 'Email',
};

const providerColors: Record<string, string> = {
  google: 'bg-blue-100 text-blue-700',
  credentials: 'bg-gray-100 text-gray-600',
};

export default function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    const res = await fetch('/api/users');
    const data = await res.json();
    setUsers(data.users || []);
    setLoading(false);
  }

  async function toggleAdmin(user: AdminUser) {
    const newType = user.userType === 'admin' ? 'citizen' : 'admin';
    setUpdating(user.id);

    await fetch('/api/users', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, userType: newType }),
    });

    await fetchUsers();
    setUpdating(null);
  }

  async function inviteAdmin(user: AdminUser) {
    setUpdating(user.id);
    setInviteMessage(null);

    const res = await fetch('/api/users/invite-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, email: user.email, name: user.name }),
    });

    const data = await res.json();
    if (!res.ok) {
      setInviteMessage(data?.error || 'Unable to create admin invite.');
      setUpdating(null);
      return;
    }

    const url = data?.inviteUrl as string | undefined;
    const expiresAt = data?.expiresAt ? new Date(data.expiresAt).toLocaleString() : 'unknown';
    if (data?.emailSent) {
      setInviteMessage(`Invite email sent to ${user.email}. Expires: ${expiresAt}`);
    } else if (url && navigator?.clipboard) {
      try {
        await navigator.clipboard.writeText(url);
        setInviteMessage(`Invite copied for ${user.email}. Expires: ${expiresAt}`);
      } catch {
        setInviteMessage(`Invite created for ${user.email}: ${url}`);
      }
    } else {
      setInviteMessage(`Invite created for ${user.email}: ${url || '(no url)'}`);
    }

    await fetchUsers();
    setUpdating(null);
  }

  async function deleteUser(user: AdminUser) {
    if (!confirm(`Delete ${user.email}?`)) return;
    setUpdating(user.id);

    await fetch(`/api/users?pk=${encodeURIComponent(user.pk || `USER#${user.id}`)}`, {
      method: 'DELETE',
    });

    await fetchUsers();
    setUpdating(null);
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-500">
        <Spinner size={20} className="animate-spin" />
        Loading users...
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Users size={24} className="text-green-600" />
        <h1 className="text-2xl font-bold">Users</h1>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        {users.length} registered users. Manage roles and permissions.
      </p>

      {inviteMessage && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">
          {inviteMessage}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">User</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Role</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Auth</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-4 py-2.5">
                  <p className="text-sm font-medium text-gray-900">{user.name || user.email}</p>
                  {user.name && (
                    <p className="text-xs text-gray-400">{user.email}</p>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                    user.userType === 'admin'
                      ? 'bg-green-100 text-green-700'
                      : user.userType === 'researcher'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-600'
                  }`}>
                    {user.userType === 'admin' ? <ShieldCheck size={11} /> : <Shield size={11} />}
                    {user.userType}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex gap-1">
                    {(Array.isArray(user.authMethods) ? user.authMethods : []).map((m) => (
                      <span key={m} className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${providerColors[m] || 'bg-gray-100 text-gray-600'}`}>
                        {providerLabels[m] || m}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => (user.userType === 'admin' ? toggleAdmin(user) : inviteAdmin(user))}
                      disabled={updating === user.id}
                      className="text-xs text-green-600 hover:text-green-700 font-medium disabled:opacity-50"
                    >
                      {updating === user.id ? 'Saving...' : user.userType === 'admin' ? 'Revoke Admin' : 'Invite Admin'}
                    </button>
                    <button
                      onClick={() => deleteUser(user)}
                      disabled={updating === user.id}
                      className="text-gray-400 hover:text-red-500 disabled:opacity-50"
                      title="Delete user"
                    >
                      <Trash size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && (
          <p className="text-center py-8 text-sm text-gray-500">No users found.</p>
        )}
      </div>
    </div>
  );
}
