import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';

import { users } from '@/lib/auth-store';

const useDynamoDB = !!process.env.AUTH_JS_TABLE_NAME;

export async function POST(request: Request) {
  try {
    const { email, password, firstName, lastName } = await request.json();

    if (!email || !password || !firstName || !lastName) {
      return NextResponse.json(
        { message: 'Email, password, first name, and last name are required.' },
        { status: 400 },
      );
    }

    // Check DynamoDB first (handles OAuth merge)
    if (useDynamoDB) {
      const { DynamoDBAdapter } = await import('@/lib/dynamodb-adapter');
      const adapter = DynamoDBAdapter();
      const existing = await adapter.getUserByEmail!(email);
      if (existing) {
        // User exists from OAuth — merge: add credentials to existing account
        if (existing.hashedPassword) {
          return NextResponse.json(
            { message: 'User with this email already exists.' },
            { status: 409 },
          );
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        await adapter.updateUser!({
          ...existing,
          hashedPassword,
          firstName,
          lastName,
          name: `${firstName} ${lastName}`,
        });
        return NextResponse.json({ message: 'Account linked! You can now sign in with email/password or Google.' }, { status: 200 });
      }
    } else if (users.find((u) => u.email === email)) {
      return NextResponse.json(
        { message: 'User with this email already exists.' },
        { status: 409 },
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const id = crypto.randomUUID();
    const user = {
      id,
      email,
      hashedPassword,
      firstName,
      lastName,
      name: `${firstName} ${lastName}`,
      userType: 'citizen',
    };

    users.push(user);

    if (useDynamoDB) {
      const { DynamoDBAdapter } = await import('@/lib/dynamodb-adapter');
      const adapter = DynamoDBAdapter();
      await adapter.createUser!(user as any);
    }

    return NextResponse.json({ message: 'User registered successfully.' }, { status: 201 });
  } catch (error) {
    console.error('Registration API error:', error);
    return NextResponse.json({ message: 'Internal server error.' }, { status: 500 });
  }
}