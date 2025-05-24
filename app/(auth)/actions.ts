'use server';

import { z } from 'zod';

import { createUser, getUser } from '@/lib/db/queries';

import { signIn } from './auth';

const authFormSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export interface LoginActionState {
  status: 'idle' | 'in_progress' | 'success' | 'failed' | 'invalid_data';
}

export const login = async (
  _: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> => {
  try {
    const validatedData = authFormSchema.parse({
      email: formData.get('email'),
      password: formData.get('password'),
    });

    console.log('Attempting login for:', validatedData.email);

    const result = await signIn('credentials', {
      email: validatedData.email,
      password: validatedData.password,
      redirect: false,
      redirectTo: '/integrations',
    });

    console.log('SignIn result:', result);

    // NextAuth can return different things:
    // - null/undefined for success
    // - object with error property for failure  
    // - URL string for redirect
    if (result === null || result === undefined) {
      console.log('Login successful (null/undefined result)');
      return { status: 'success' };
    }

    if (typeof result === 'string') {
      // If it's a URL string, check if it contains error
      if (result.includes('error=')) {
        console.log('Login failed - error in URL:', result);
        return { status: 'failed' };
      }
      console.log('Login successful (URL result)');
      return { status: 'success' };
    }

    if (typeof result === 'object' && result.error) {
      console.log('SignIn error:', result.error);
      return { status: 'failed' };
    }

    // If we get here, assume success
    console.log('Login successful (fallback)');
    return { status: 'success' };
  } catch (error) {
    console.error('Login action error:', error);
    
    if (error instanceof z.ZodError) {
      return { status: 'invalid_data' };
    }

    return { status: 'failed' };
  }
};

export interface RegisterActionState {
  status:
    | 'idle'
    | 'in_progress'
    | 'success'
    | 'failed'
    | 'user_exists'
    | 'invalid_data'
    | 'db_error';
  error?: string;
}

export const register = async (
  _: RegisterActionState,
  formData: FormData,
): Promise<RegisterActionState> => {
  try {
    // Start the registration process
    console.log('Starting registration process...');
    
    const validatedData = authFormSchema.parse({
      email: formData.get('email'),
      password: formData.get('password'),
    });

    console.log('Data validated, checking if user exists...');
    
    // Check if user exists
    try {
      const users = await getUser(validatedData.email);
      
      if (users && users.length > 0) {
        console.log('User already exists');
        return { status: 'user_exists' };
      }
    } catch (getUserError) {
      console.error('Database error during user check:', getUserError);
      return { 
        status: 'db_error',
        error: 'Database connection failed. Please check if POSTGRES_URL is properly set.'
      };
    }
    
    console.log('Creating new user...');
    
    // Create the user
    try {
      await createUser(validatedData.email, validatedData.password);
    } catch (dbError) {
      console.error('Database error during user creation:', dbError);
      return { 
        status: 'db_error',
        error: 'Failed to create user in database. Please try again.' 
      };
    }
    
    console.log('User created, attempting sign in...');
    
    // Sign in the user
    try {
      await signIn('credentials', {
        email: validatedData.email,
        password: validatedData.password,
        redirect: false,
      });
    } catch (signInError) {
      console.error('Error during sign in after registration:', signInError);
      // Don't return an error here - user is created but sign-in failed
      // They can try logging in manually
    }

    console.log('Registration successful');
    return { status: 'success' };
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Validation error during registration:', error);
      return { 
        status: 'invalid_data',
        error: 'Please ensure your email is valid and password is at least 6 characters.' 
      };
    }
    
    console.error('Unexpected error during registration:', error);
    return { 
      status: 'failed',
      error: 'An unexpected error occurred. Please try again.' 
    };
  }
};
