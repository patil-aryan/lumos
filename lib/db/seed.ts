import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { user, chat } from './schema';
import { generateHashedPassword } from './utils';
import { eq } from 'drizzle-orm';
import { generateUUID } from '../utils';

// Load environment variables
config({
  path: '.env.local',
});

const seedDatabase = async () => {
  if (!process.env.POSTGRES_URL) {
    throw new Error('POSTGRES_URL is not defined');
  }

  const connection = postgres(process.env.POSTGRES_URL, { max: 1 });
  const db = drizzle(connection);
  
  console.log('⏳ Seeding database...');
  
  // Check if default user exists
  const defaultEmail = 'user@example.com';
  const existingUsers = await db.select().from(user).where(eq(user.email, defaultEmail));
  
  let userId;
  
  if (existingUsers.length === 0) {
    // Create a default user
    console.log('Creating default user...');
    const hashedPassword = generateHashedPassword('password123');
    
    const insertedUsers = await db.insert(user).values({
      email: defaultEmail,
      password: hashedPassword
    }).returning({ id: user.id });
    
    userId = insertedUsers[0].id;
    console.log('Default user created successfully with ID:', userId);
  } else {
    userId = existingUsers[0].id;
    console.log('Default user already exists with ID:', userId);
  }
  
  // Create a guest user
  console.log('Creating guest user...');
  const guestEmail = `guest-${Date.now()}`;
  const guestPassword = generateHashedPassword('guest-password');
  
  const insertedGuestUsers = await db.insert(user).values({
    email: guestEmail,
    password: guestPassword
  }).returning({ id: user.id });
  
  const guestUserId = insertedGuestUsers[0].id;
  console.log('Guest user created with email:', guestEmail, 'and ID:', guestUserId);
  
  // Create a sample chat for each user
  console.log('Creating sample chats...');
  
  // Check if the default user already has chats
  const existingChats = await db.select().from(chat).where(eq(chat.userId, userId));
  
  if (existingChats.length === 0) {
    await db.insert(chat).values({
      id: generateUUID(),
      userId: userId,
      title: 'Welcome Chat',
      visibility: 'private',
      createdAt: new Date()
    });
    console.log('Sample chat created for default user');
  } else {
    console.log('Default user already has chats, skipping chat creation');
  }
  
  // Create a sample chat for the guest user
  await db.insert(chat).values({
    id: generateUUID(),
    userId: guestUserId,
    title: 'Guest Welcome Chat',
    visibility: 'private',
    createdAt: new Date()
  });
  console.log('Sample chat created for guest user');
  
  console.log('✅ Database seeded successfully');
  
  // Close the connection
  await connection.end();
  process.exit(0);
};

seedDatabase().catch((err) => {
  console.error('❌ Seeding failed');
  console.error(err);
  process.exit(1);
}); 