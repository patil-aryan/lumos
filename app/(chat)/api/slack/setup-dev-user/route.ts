import { NextRequest, NextResponse } from 'next/server';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { user } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

const DEV_USER_ID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

// Initialize database connection like in queries.ts
const client = postgres(process.env.POSTGRES_URL || '');
const db = drizzle(client);

export async function POST(req: NextRequest) {
  try {
    console.log('Setting up development user...');
    
    // Check if dev user already exists
    const existingUser = await db.select().from(user).where(eq(user.id, DEV_USER_ID)).limit(1);
    
    if (existingUser.length > 0) {
      return NextResponse.json({
        message: 'Development user already exists',
        userId: DEV_USER_ID,
        email: existingUser[0].email,
      });
    }
    
    // Create development user
    const [newUser] = await db.insert(user).values({
      id: DEV_USER_ID,
      email: 'dev-user@localhost.dev',
    }).returning();
    
    console.log('Created development user:', newUser);
    
    return NextResponse.json({
      message: 'Development user created successfully',
      userId: newUser.id,
      email: newUser.email,
    });
  } catch (error) {
    console.error('Error setting up development user:', error);
    return NextResponse.json({
      message: 'Failed to create development user',
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    // Just check if the user exists
    const existingUser = await db.select().from(user).where(eq(user.id, DEV_USER_ID)).limit(1);
    
    return NextResponse.json({
      exists: existingUser.length > 0,
      userId: DEV_USER_ID,
      user: existingUser[0] || null,
    });
  } catch (error) {
    return NextResponse.json({
      exists: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
} 