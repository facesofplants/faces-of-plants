'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function SignUpPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState(''); // New state for first name
  const [lastName, setLastName] = useState(''); // New state for last name
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, firstName, lastName }), // Include new fields
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || 'Registration failed.');
        return;
      }

      setSuccess('Registration successful! You can now sign in.');
      router.push('/auth/signin');
    } catch (err) {
      console.error('Registration error:', err);
      setError('An unexpected error occurred during registration.');
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        flexDirection: 'column',
        padding: '20px',
      }}
    >
      <div
        style={{
          background: '#fff',
          padding: '40px',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          maxWidth: '400px',
          width: '100%',
        }}
      >
        <h1 style={{ textAlign: 'center', marginBottom: '30px', fontSize: '24px', color: '#333' }}>
          Sign Up
        </h1>

        {error && (
          <p style={{ color: 'red', textAlign: 'center', marginBottom: '15px' }}>{error}</p>
        )}
        {success && (
          <p style={{ color: 'green', textAlign: 'center', marginBottom: '15px' }}>{success}</p>
        )}

        <form
          onSubmit={handleSubmit}
          style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}
        >
          {/* New fields for First Name and Last Name */}
          <div>
            <label
              htmlFor="firstName"
              style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#555' }}
            >
              First Name:
            </label>
            <input
              type="text"
              id="firstName"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '16px',
              }}
            />
          </div>
          <div>
            <label
              htmlFor="lastName"
              style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#555' }}
            >
              Last Name:
            </label>
            <input
              type="text"
              id="lastName"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '16px',
              }}
            />
          </div>
          {/* Existing Email field */}
          <div>
            <label
              htmlFor="email"
              style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#555' }}
            >
              Email:
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '16px',
              }}
            />
          </div>
          <div>
            <label
              htmlFor="password"
              style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#555' }}
            >
              Password:
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '16px',
              }}
            />
          </div>
          <div>
            <label
              htmlFor="confirmPassword"
              style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#555' }}
            >
              Confirm Password:
            </label>
            <input
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '16px',
              }}
            />
          </div>
          <button
            type="submit"
            style={{
              padding: '12px 20px',
              background: '#28a745',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              fontSize: '18px',
              cursor: 'pointer',
              transition: 'background 0.3s ease',
            }}
          >
            Sign Up
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '14px' }}>
          Already have an account?{' '}
          <Link href="/auth/signin" style={{ color: '#0070f3', textDecoration: 'none' }}>
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
export const dynamic = 'force-dynamic';
