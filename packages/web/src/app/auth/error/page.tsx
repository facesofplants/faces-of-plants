'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function ErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams?.get('error');

  const errorMessages: Record<string, string> = {
    Configuration: 'Server configuration error. Please try again later.',
    AccessDenied: 'Access was denied. You may not have permission to access this resource.',
    Verification: 'The verification link may have expired or already been used.',
    Default: 'An unexpected error occurred.',
    OAuthAccountNotLinked: 'This email is already associated with another account. Please sign in with the original provider.',
    OAuthCallbackError: 'There was a problem with the OAuth sign-in. Please try again.',
    OAuthCreateAccount: 'Could not create account. Please try again.',
    EmailCreateAccount: 'Could not create account. Please try again.',
    Callback: 'There was a problem with the sign-in callback. Please try again.',
    OAuthSignin: 'Error starting the OAuth sign-in. Please try again.',
  };

  const message = errorMessages[error || ''] || errorMessages.Default;

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
          textAlign: 'center',
        }}
      >
        <h1 style={{ fontSize: '24px', color: '#dc2626', marginBottom: '16px' }}>
          Authentication Error
        </h1>
        <p style={{ color: '#666', marginBottom: '24px' }}>{message}</p>
        {error && (
          <p style={{ color: '#999', fontSize: '12px', marginBottom: '24px' }}>
            Error code: {error}
          </p>
        )}
        <Link
          href="/auth/signin"
          style={{
            display: 'inline-block',
            padding: '12px 24px',
            background: '#0070f3',
            color: '#fff',
            borderRadius: '4px',
            textDecoration: 'none',
            fontSize: '16px',
          }}
        >
          Try Again
        </Link>
      </div>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>Loading...</div>}>
      <ErrorContent />
    </Suspense>
  );
}
