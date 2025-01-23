-- Create enum for user roles if it doesn't exist
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('customer', 'support', 'admin');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Enable RLS
ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

-- Grant necessary schema permissions
GRANT USAGE ON SCHEMA auth TO anon, authenticated;
GRANT SELECT ON auth.users TO anon, authenticated;
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT USAGE ON TYPE public.user_role TO anon, authenticated;
GRANT USAGE ON SCHEMA auth TO postgres, service_role;
GRANT ALL ON auth.users TO postgres, service_role;
GRANT USAGE ON TYPE public.user_role TO postgres, service_role;

-- Ensure profiles table exists with correct permissions
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    role user_role NOT NULL DEFAULT 'customer'::user_role,
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Grant table permissions
GRANT ALL ON public.profiles TO postgres, service_role;
GRANT ALL ON public.profiles TO anon, authenticated;

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Update profile policies
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone" 
ON public.profiles FOR SELECT 
TO authenticated 
USING (true);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" 
ON public.profiles FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" 
ON public.profiles FOR UPDATE 
TO authenticated 
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Add service role policy for profile creation
DROP POLICY IF EXISTS "Service role can manage all profiles" ON public.profiles;
CREATE POLICY "Service role can manage all profiles" 
ON public.profiles FOR ALL 
TO service_role 
USING (true)
WITH CHECK (true);

-- Update handle_new_user function with better error handling
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    user_role_val user_role;
    user_full_name text;
BEGIN
    -- Log the attempt to create a new user
    RAISE NOTICE 'Attempting to create profile for user %', NEW.id;
    
    BEGIN
        -- Default to customer role
        user_role_val := 'customer'::user_role;
        
        -- Try to get role from metadata if it exists
        IF NEW.raw_user_meta_data IS NOT NULL AND NEW.raw_user_meta_data ? 'role' THEN
            BEGIN
                user_role_val := (NEW.raw_user_meta_data->>'role')::user_role;
            EXCEPTION WHEN OTHERS THEN
                RAISE NOTICE 'Invalid role in metadata, using default';
            END;
        END IF;

        -- Get full_name from metadata if it exists
        IF NEW.raw_user_meta_data IS NOT NULL AND NEW.raw_user_meta_data ? 'full_name' THEN
            user_full_name := NEW.raw_user_meta_data->>'full_name';
        END IF;

        -- Create profile
        INSERT INTO public.profiles (id, role, full_name)
        VALUES (NEW.id, user_role_val, user_full_name)
        ON CONFLICT (id) DO UPDATE 
        SET role = EXCLUDED.role,
            full_name = EXCLUDED.full_name;

        RETURN NEW;
    EXCEPTION WHEN OTHERS THEN
        -- Log error but don't fail
        RAISE WARNING 'Error creating profile: %. Continuing anyway.', SQLERRM;
        RETURN NEW;
    END;
END;
$$;

-- Ensure proper ownership and permissions
ALTER FUNCTION public.handle_new_user() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres, service_role;

-- Ensure the trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Create function to get users
CREATE OR REPLACE FUNCTION public.get_users()
RETURNS TABLE (
    id uuid,
    email varchar(255)
)
SECURITY DEFINER
SET search_path = public, auth
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT au.id, au.email::varchar(255)
    FROM auth.users au;
END;
$$;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION public.get_users() TO authenticated;

-- Create function to safely create a profile
CREATE OR REPLACE FUNCTION public.create_profile_if_not_exists(
  user_id uuid,
  user_role user_role DEFAULT 'customer'::user_role
)
RETURNS TABLE (
  id uuid,
  role user_role,
  full_name text,
  avatar_url text,
  created_at timestamptz,
  updated_at timestamptz
)
SECURITY DEFINER
SET search_path = public, auth
LANGUAGE plpgsql
AS $$
BEGIN
  -- First check if user exists in auth.users
  IF EXISTS (SELECT 1 FROM auth.users WHERE auth.users.id = user_id) THEN
    -- Then try to get or create profile
    RETURN QUERY
    INSERT INTO public.profiles (id, role)
    VALUES (user_id, user_role)
    ON CONFLICT (id) DO UPDATE
    SET updated_at = now()
    RETURNING profiles.id, profiles.role, profiles.full_name, profiles.avatar_url, profiles.created_at, profiles.updated_at;
  ELSE
    RAISE EXCEPTION 'User does not exist in auth.users';
  END IF;
END;
$$;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION public.create_profile_if_not_exists(uuid, user_role) TO authenticated;
