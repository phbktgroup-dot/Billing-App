-- ==========================================
-- VYAPAR-STYLE BUSINESS MANAGEMENT SCHEMA
-- ==========================================

-- 1. USERS TABLE (Extends Auth Users)
-- We define this first because other tables reference it
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('Super Admin', 'Admin', 'Business User');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY, -- Matches auth.users.id
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    role user_role DEFAULT 'Business User',
    business_id UUID, -- Will be linked after business creation
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL ON UPDATE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure column exists if table was created earlier
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users(id) ON DELETE SET NULL ON UPDATE CASCADE;

-- Fix: Drop old check constraint if it exists to prevent conflicts with the ENUM type
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;

-- 2. BUSINESS PROFILES
CREATE TABLE IF NOT EXISTS business_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    name TEXT NOT NULL,
    owner_name TEXT,
    address TEXT,
    mobile TEXT,
    email TEXT,
    gst_number TEXT,
    pan_number TEXT,
    bank_name TEXT,
    bank_account_no TEXT,
    bank_ifsc TEXT,
    bank_branch TEXT,
    logo_url TEXT,
    gemini_api_key TEXT,
    invoice_prefix TEXT DEFAULT 'INV',
    invoice_number_format TEXT DEFAULT 'YYYY-MM-0001',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Add foreign key to users table now that business_profiles exists
DO $$ BEGIN
    ALTER TABLE public.users 
    ADD CONSTRAINT users_business_id_fkey 
    FOREIGN KEY (business_id) REFERENCES business_profiles(id) ON DELETE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Ensure columns exist if table was created earlier
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS owner_name TEXT;
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS mobile TEXT;
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS gst_number TEXT;
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS pan_number TEXT;
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS bank_name TEXT;
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS bank_account_no TEXT;
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS bank_ifsc TEXT;
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS bank_branch TEXT;
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS gemini_api_key TEXT;
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS invoice_prefix TEXT DEFAULT 'INV';
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS invoice_number_format TEXT DEFAULT 'YYYY-MM-0001';

-- 3. CUSTOMERS
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES business_profiles(id) ON DELETE CASCADE ON UPDATE CASCADE,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL ON UPDATE CASCADE,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    address TEXT,
    gstin TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure columns exist if table was created earlier
ALTER TABLE customers ADD COLUMN IF NOT EXISTS gstin TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users(id);

-- 4. PRODUCTS / INVENTORY
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES business_profiles(id) ON DELETE CASCADE ON UPDATE CASCADE,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL ON UPDATE CASCADE,
    name TEXT NOT NULL,
    sku TEXT,
    category TEXT,
    price DECIMAL(12,2) DEFAULT 0,
    purchase_price DECIMAL(12,2) DEFAULT 0,
    gst_rate DECIMAL(5,2) DEFAULT 18,
    stock INTEGER DEFAULT 0,
    unit TEXT DEFAULT 'pcs',
    min_stock INTEGER DEFAULT 5,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure columns exist if table was created earlier
ALTER TABLE products ADD COLUMN IF NOT EXISTS price DECIMAL(12,2) DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS purchase_price DECIMAL(12,2) DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS gst_rate DECIMAL(5,2) DEFAULT 18;
ALTER TABLE products ADD COLUMN IF NOT EXISTS stock INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS min_stock INTEGER DEFAULT 5;
ALTER TABLE products ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'pcs';
ALTER TABLE products ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users(id);

-- 5. INVOICES
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES business_profiles(id) ON DELETE CASCADE ON UPDATE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL ON UPDATE CASCADE,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL ON UPDATE CASCADE,
    invoice_number TEXT NOT NULL,
    date DATE DEFAULT CURRENT_DATE,
    due_date DATE,
    subtotal DECIMAL(12,2) DEFAULT 0,
    tax_amount DECIMAL(12,2) DEFAULT 0,
    total DECIMAL(12,2) DEFAULT 0,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'unpaid', 'paid', 'cancelled', 'overdue')),
    payment_mode TEXT DEFAULT 'Cash',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure columns exist if table was created earlier
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS subtotal DECIMAL(12,2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(12,2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS total DECIMAL(12,2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users(id);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_mode TEXT DEFAULT 'Cash';

-- 6. INVOICE ITEMS
CREATE TABLE IF NOT EXISTS invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(12,2) NOT NULL,
    gst_rate DECIMAL(5,2) DEFAULT 18,
    total_price DECIMAL(12,2) NOT NULL
);

-- Ensure columns exist if table was created earlier
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS gst_rate DECIMAL(5,2) DEFAULT 18;
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS total_price DECIMAL(12,2) DEFAULT 0;

-- 7. OTP TABLE
CREATE TABLE IF NOT EXISTS otps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    otp TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ==========================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================

-- Enable RLS on all tables
ALTER TABLE business_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;

-- Helper functions to break recursion in RLS
-- These run as SECURITY DEFINER to bypass RLS checks on the users table
CREATE OR REPLACE FUNCTION public.get_auth_business_id()
RETURNS UUID AS $$
DECLARE
  bid UUID;
BEGIN
  -- Try to get it from users table first
  SELECT business_id INTO bid FROM public.users WHERE id = auth.uid();
  
  -- If not found in users table (e.g. trigger delay or missing link), 
  -- try to get it from business_profiles if they are the owner
  IF bid IS NULL THEN
    SELECT id INTO bid FROM public.business_profiles WHERE user_id = auth.uid() LIMIT 1;
  END IF;
  
  RETURN bid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_auth_admin()
RETURNS BOOLEAN AS $$
  SELECT role::text = 'Admin' FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
  -- Check for role or hardcoded super admin email
  SELECT role::text = 'Super Admin' OR email = 'phbktgroup@gmail.com' 
  FROM public.users 
  WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

-- USERS POLICY
-- 1. Everyone can manage their own record (including insert/upsert)
DROP POLICY IF EXISTS "Users can manage themselves" ON users;
CREATE POLICY "Users can manage themselves" ON users
    FOR ALL 
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- 2. Super Admins can manage everything
DROP POLICY IF EXISTS "Super Admins can manage all users" ON users;
CREATE POLICY "Super Admins can manage all users" ON users
    FOR ALL 
    USING (public.is_super_admin());

-- 3. Admins can see/manage colleagues in their business
DROP POLICY IF EXISTS "Admins can manage colleagues" ON users;
CREATE POLICY "Admins can manage colleagues" ON users
    FOR ALL 
    USING (business_id = public.get_auth_business_id() AND public.is_auth_admin());

-- Remove old policies if they exist under different names
DROP POLICY IF EXISTS "Users can see colleagues" ON users;

-- BUSINESS PROFILES POLICY
DROP POLICY IF EXISTS "Users can see their business" ON business_profiles;
CREATE POLICY "Users can see their business" ON business_profiles
    FOR SELECT USING (
        public.is_super_admin()
        OR auth.uid() = user_id 
        OR id = public.get_auth_business_id()
    );

DROP POLICY IF EXISTS "Users can create their business" ON business_profiles;
CREATE POLICY "Users can create their business" ON business_profiles
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their business" ON business_profiles;
CREATE POLICY "Users can update their business" ON business_profiles
    FOR UPDATE USING (
        public.is_super_admin()
        OR id = public.get_auth_business_id()
    )
    WITH CHECK (
        public.is_super_admin()
        OR id = public.get_auth_business_id()
    );

-- CUSTOMERS POLICY
DROP POLICY IF EXISTS "Users can manage their customers" ON customers;
CREATE POLICY "Users can manage their customers" ON customers
    FOR ALL USING (
        public.is_super_admin()
        OR (business_id = public.get_auth_business_id() AND public.is_auth_admin())
        OR created_by = auth.uid()
    );

-- PRODUCTS POLICY
DROP POLICY IF EXISTS "Users can manage their products" ON products;
CREATE POLICY "Users can manage their products" ON products
    FOR ALL USING (
        public.is_super_admin()
        OR (business_id = public.get_auth_business_id() AND public.is_auth_admin())
        OR created_by = auth.uid()
    );

-- INVOICES POLICY
DROP POLICY IF EXISTS "Users can manage their invoices" ON invoices;
CREATE POLICY "Users can manage their invoices" ON invoices
    FOR ALL USING (
        public.is_super_admin()
        OR (business_id = public.get_auth_business_id() AND public.is_auth_admin())
        OR created_by = auth.uid()
    );

-- INVOICE ITEMS POLICY
DROP POLICY IF EXISTS "Users can manage their invoice items" ON invoice_items;
CREATE POLICY "Users can manage their invoice items" ON invoice_items
    FOR ALL USING (
        public.is_super_admin()
        OR EXISTS (
            SELECT 1 FROM invoices 
            WHERE invoices.id = invoice_items.invoice_id
            AND (
                (invoices.business_id = public.get_auth_business_id() AND public.is_auth_admin())
                OR invoices.created_by = auth.uid()
            )
        )
    );

-- ==========================================
-- AUTH & BUSINESS TRIGGERS
-- ==========================================

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  existing_id UUID;
BEGIN
  -- Check if a user with this email already exists (e.g. pre-created by Admin)
  SELECT id INTO existing_id FROM public.users WHERE email = new.email LIMIT 1;

  IF existing_id IS NOT NULL THEN
    -- If the ID is already correct, just update metadata
    IF existing_id = new.id THEN
      UPDATE public.users 
      SET name = COALESCE(new.raw_user_meta_data->>'name', name)
      WHERE id = new.id;
    ELSE
      -- Update the existing record with the real Auth ID
      -- This will cascade to other tables if ON UPDATE CASCADE is set
      UPDATE public.users 
      SET id = new.id,
          name = COALESCE(new.raw_user_meta_data->>'name', name)
      WHERE id = existing_id;
    END IF;
  ELSE
    -- Create new record
    INSERT INTO public.users (id, email, name, role)
    VALUES (new.id, new.email, new.raw_user_meta_data->>'name', 'Business User');
  END IF;
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to link business to user on creation
CREATE OR REPLACE FUNCTION public.handle_new_business()
RETURNS trigger AS $$
BEGIN
  UPDATE public.users 
  SET business_id = new.id
  WHERE id = new.user_id;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Trigger on business_profiles
DROP TRIGGER IF EXISTS on_business_created ON business_profiles;
CREATE TRIGGER on_business_created
  AFTER INSERT ON business_profiles
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_business();

-- ==========================================
-- STORAGE POLICIES (Run in SQL Editor)
-- ==========================================

-- 1. Create the bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Allow public to view logos
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access" ON storage.objects 
FOR SELECT USING (bucket_id = 'logos');

-- 3. Allow authenticated users to upload logos
DROP POLICY IF EXISTS "Authenticated Upload" ON storage.objects;
CREATE POLICY "Authenticated Upload" ON storage.objects 
FOR INSERT WITH CHECK (
    bucket_id = 'logos' 
    AND auth.role() = 'authenticated'
);

-- 4. Allow users to update/delete their own business logos
DROP POLICY IF EXISTS "Owner Manage" ON storage.objects;
CREATE POLICY "Owner Manage" ON storage.objects 
FOR ALL USING (
    bucket_id = 'logos' 
    AND auth.role() = 'authenticated'
);
