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
    ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS default_notes TEXT;
    ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS default_terms TEXT;
    ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS state TEXT;
    ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS city TEXT;
    ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS pincode TEXT;
    ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS address1 TEXT;
    ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS address2 TEXT;
    ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS aadhar_number TEXT;

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
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS state TEXT;
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS address1 TEXT;
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS address2 TEXT;
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS city TEXT;
    ALTER TABLE customers ADD COLUMN IF NOT EXISTS pincode TEXT;
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
    ALTER TABLE products ADD COLUMN IF NOT EXISTS hsn_code TEXT;
    ALTER TABLE products ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users(id);

    -- 5. INVOICES
    CREATE TABLE IF NOT EXISTS invoices (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        business_id UUID REFERENCES business_profiles(id) ON DELETE CASCADE ON UPDATE CASCADE,
        customer_id UUID REFERENCES customers(id) ON DELETE SET NULL ON UPDATE CASCADE,
        invoice_series_id UUID REFERENCES invoice_series(id) ON DELETE SET NULL ON UPDATE CASCADE,
        created_by UUID REFERENCES public.users(id) ON DELETE SET NULL ON UPDATE CASCADE,
        invoice_number TEXT NOT NULL,
        date DATE DEFAULT CURRENT_DATE,
        due_date DATE,
        subtotal DECIMAL(12,2) DEFAULT 0,
        discount DECIMAL(12,2) DEFAULT 0,
        discount_percentage DECIMAL(5,2) DEFAULT 0,
        tax_amount DECIMAL(12,2) DEFAULT 0,
        total DECIMAL(12,2) DEFAULT 0,
        status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'unpaid', 'paid', 'cancelled', 'overdue')),
        payment_mode TEXT DEFAULT 'Cash',
        notes TEXT,
        terms TEXT,
        created_at TIMESTAMPTZ DEFAULT now()
    );

    -- Ensure columns exist if table was created earlier
    ALTER TABLE invoices ADD COLUMN IF NOT EXISTS subtotal DECIMAL(12,2) DEFAULT 0;
    ALTER TABLE invoices ADD COLUMN IF NOT EXISTS discount DECIMAL(12,2) DEFAULT 0;
    ALTER TABLE invoices ADD COLUMN IF NOT EXISTS discount_percentage DECIMAL(5,2) DEFAULT 0;
    ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(12,2) DEFAULT 0;
    ALTER TABLE invoices ADD COLUMN IF NOT EXISTS cgst_amount DECIMAL(12,2) DEFAULT 0;
    ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sgst_amount DECIMAL(12,2) DEFAULT 0;
    ALTER TABLE invoices ADD COLUMN IF NOT EXISTS igst_amount DECIMAL(12,2) DEFAULT 0;
    ALTER TABLE invoices ADD COLUMN IF NOT EXISTS is_inter_state BOOLEAN DEFAULT false;
    ALTER TABLE invoices ADD COLUMN IF NOT EXISTS billing_state TEXT;
    ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_state TEXT;
    ALTER TABLE invoices ADD COLUMN IF NOT EXISTS total DECIMAL(12,2) DEFAULT 0;
    ALTER TABLE invoices ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users(id);
    ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_mode TEXT DEFAULT 'Cash';
    ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_series_id UUID REFERENCES invoice_series(id);
    ALTER TABLE invoices ADD COLUMN IF NOT EXISTS notes TEXT;
    ALTER TABLE invoices ADD COLUMN IF NOT EXISTS terms TEXT;
    ALTER TABLE invoices ADD COLUMN IF NOT EXISTS due_date DATE;
    ALTER TABLE invoices ADD COLUMN IF NOT EXISTS supply_type TEXT DEFAULT 'O';
    ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sub_supply_type TEXT DEFAULT '1';

    -- 5.1 INVOICE SERIES
    CREATE TABLE IF NOT EXISTS invoice_series (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        business_id UUID REFERENCES business_profiles(id) ON DELETE CASCADE ON UPDATE CASCADE,
        name TEXT NOT NULL,
        prefix TEXT NOT NULL,
        current_number INTEGER DEFAULT 1,
        created_at TIMESTAMPTZ DEFAULT now()
    );

    -- Enable RLS
    ALTER TABLE invoice_series ENABLE ROW LEVEL SECURITY;

    -- INVOICE SERIES POLICY
    DROP POLICY IF EXISTS "Users can manage their invoice series" ON invoice_series;
    CREATE POLICY "Users can manage their invoice series" ON invoice_series
        FOR ALL USING (
            public.can_access_business(business_id)
        );

    -- 6. INVOICE ITEMS
    CREATE TABLE IF NOT EXISTS invoice_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
        product_id UUID REFERENCES products(id),
        quantity INTEGER NOT NULL,
        unit_price DECIMAL(12,2) NOT NULL,
        gst_rate DECIMAL(5,2) DEFAULT 18,
        discount DECIMAL(12,2) DEFAULT 0,
        amount DECIMAL(12,2) NOT NULL,
        total_price DECIMAL(12,2) DEFAULT 0 -- Keep for backward compatibility
    );

    -- Ensure columns exist if table was created earlier
    ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS gst_rate DECIMAL(5,2) DEFAULT 18;
    ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS discount DECIMAL(12,2) DEFAULT 0;
    ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS amount DECIMAL(12,2) DEFAULT 0;
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

    -- Hierarchical access functions
    CREATE OR REPLACE FUNCTION public.is_descendant_user(target_user_id UUID)
    RETURNS BOOLEAN AS $$
    BEGIN
        RETURN EXISTS (
            WITH RECURSIVE descendants AS (
                SELECT id FROM public.users WHERE created_by = auth.uid()
                UNION ALL
                SELECT u.id FROM public.users u
                JOIN descendants d ON u.created_by = d.id
            )
            SELECT 1 FROM descendants WHERE id = target_user_id
        );
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

    CREATE OR REPLACE FUNCTION public.can_access_business(target_business_id UUID)
    RETURNS BOOLEAN AS $$
    DECLARE
        owner_id UUID;
    BEGIN
        -- 1. Super Admin access
        IF public.is_super_admin() THEN
            RETURN TRUE;
        END IF;

        -- 2. Direct business access (own business)
        IF target_business_id = public.get_auth_business_id() THEN
            RETURN TRUE;
        END IF;

        -- 3. Get the owner of the target business
        SELECT user_id INTO owner_id FROM public.business_profiles WHERE id = target_business_id;

        -- 4. Check if the owner is in the current user's creation tree
        RETURN public.is_descendant_user(owner_id);
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

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

    -- 3. Admins can see/manage colleagues in their business AND their descendants
    DROP POLICY IF EXISTS "Admins can manage colleagues" ON users;
    CREATE POLICY "Admins can manage colleagues" ON users
        FOR ALL 
        USING (
            (business_id = public.get_auth_business_id() AND public.is_auth_admin())
            OR public.is_descendant_user(id)
        );

    -- Remove old policies if they exist under different names
    DROP POLICY IF EXISTS "Users can see colleagues" ON users;

    -- BUSINESS PROFILES POLICY
    DROP POLICY IF EXISTS "Users can see their business" ON business_profiles;
    CREATE POLICY "Users can see their business" ON business_profiles
        FOR SELECT USING (
            public.can_access_business(id)
        );

    DROP POLICY IF EXISTS "Users can create their business" ON business_profiles;
    CREATE POLICY "Users can create their business" ON business_profiles
        FOR INSERT WITH CHECK (auth.uid() = user_id);

    DROP POLICY IF EXISTS "Users can update their business" ON business_profiles;
    CREATE POLICY "Users can update their business" ON business_profiles
        FOR UPDATE USING (
            public.can_access_business(id)
        )
        WITH CHECK (
            public.can_access_business(id)
        );

    -- CUSTOMERS POLICY
    DROP POLICY IF EXISTS "Users can manage their customers" ON customers;
    CREATE POLICY "Users can manage their customers" ON customers
        FOR ALL USING (
            public.can_access_business(business_id)
            OR created_by = auth.uid()
        );

    -- PRODUCTS POLICY
    DROP POLICY IF EXISTS "Users can manage their products" ON products;
    CREATE POLICY "Users can manage their products" ON products
        FOR ALL USING (
            public.can_access_business(business_id)
            OR created_by = auth.uid()
        );

    -- INVOICES POLICY
    DROP POLICY IF EXISTS "Users can manage their invoices" ON invoices;
    CREATE POLICY "Users can manage their invoices" ON invoices
        FOR ALL USING (
            public.can_access_business(business_id)
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
                    public.can_access_business(invoices.business_id)
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

    -- 8. SUPPLIERS
    CREATE TABLE IF NOT EXISTS suppliers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        business_id UUID REFERENCES business_profiles(id) ON DELETE CASCADE ON UPDATE CASCADE,
        created_by UUID REFERENCES public.users(id) ON DELETE SET NULL ON UPDATE CASCADE,
        name TEXT NOT NULL,
        gst_number TEXT,
        email TEXT,
        phone TEXT,
        address TEXT,
        created_at TIMESTAMPTZ DEFAULT now()
    );

    -- Ensure columns exist if table was created earlier
    ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS gst_number TEXT;
    ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS state TEXT;

    -- 9. PURCHASES
    CREATE TABLE IF NOT EXISTS purchases (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        business_id UUID REFERENCES business_profiles(id) ON DELETE CASCADE ON UPDATE CASCADE,
        supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL ON UPDATE CASCADE,
        created_by UUID REFERENCES public.users(id) ON DELETE SET NULL ON UPDATE CASCADE,
        invoice_number TEXT,
        date DATE DEFAULT CURRENT_DATE, -- Keep for backward compatibility
        bill_date DATE DEFAULT CURRENT_DATE,
        upload_date DATE DEFAULT CURRENT_DATE,
        subtotal DECIMAL(12,2) DEFAULT 0,
        tax_amount DECIMAL(12,2) DEFAULT 0,
        cgst_amount DECIMAL(12,2) DEFAULT 0,
        sgst_amount DECIMAL(12,2) DEFAULT 0,
        igst_amount DECIMAL(12,2) DEFAULT 0,
        total_amount DECIMAL(12,2) DEFAULT 0,
        status TEXT DEFAULT 'paid' CHECK (status IN ('paid', 'pending', 'cancelled')),
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT now()
    );

    -- Ensure columns exist if table was created earlier
    ALTER TABLE purchases ADD COLUMN IF NOT EXISTS subtotal DECIMAL(12,2) DEFAULT 0;
    ALTER TABLE purchases ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(12,2) DEFAULT 0;
    ALTER TABLE purchases ADD COLUMN IF NOT EXISTS cgst_amount DECIMAL(12,2) DEFAULT 0;
    ALTER TABLE purchases ADD COLUMN IF NOT EXISTS sgst_amount DECIMAL(12,2) DEFAULT 0;
    ALTER TABLE purchases ADD COLUMN IF NOT EXISTS igst_amount DECIMAL(12,2) DEFAULT 0;
    ALTER TABLE purchases ADD COLUMN IF NOT EXISTS total_amount DECIMAL(12,2) DEFAULT 0;
    ALTER TABLE purchases ADD COLUMN IF NOT EXISTS bill_date DATE DEFAULT CURRENT_DATE;
    ALTER TABLE purchases ADD COLUMN IF NOT EXISTS upload_date DATE DEFAULT CURRENT_DATE;
    ALTER TABLE purchases ADD COLUMN IF NOT EXISTS notes TEXT;

    -- Enable RLS
    ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
    ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;

    -- SUPPLIERS POLICY
    DROP POLICY IF EXISTS "Users can manage their suppliers" ON suppliers;
    CREATE POLICY "Users can manage their suppliers" ON suppliers
        FOR ALL USING (
            public.can_access_business(business_id)
            OR created_by = auth.uid()
        );

    -- PURCHASES POLICY
    DROP POLICY IF EXISTS "Users can manage their purchases" ON purchases;
    CREATE POLICY "Users can manage their purchases" ON purchases
        FOR ALL USING (
            public.can_access_business(business_id)
            OR created_by = auth.uid()
        );

    -- 11. PURCHASE ITEMS
    CREATE TABLE IF NOT EXISTS purchase_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        purchase_id UUID REFERENCES purchases(id) ON DELETE CASCADE,
        product_id UUID REFERENCES products(id),
        item_name TEXT NOT NULL,
        hsn_code TEXT,
        quantity INTEGER NOT NULL,
        unit_price DECIMAL(12,2) NOT NULL,
        gst_rate DECIMAL(5,2) DEFAULT 18,
        cgst DECIMAL(12,2) DEFAULT 0,
        sgst DECIMAL(12,2) DEFAULT 0,
        igst DECIMAL(12,2) DEFAULT 0,
        amount DECIMAL(12,2) DEFAULT 0,
        total_price DECIMAL(12,2) DEFAULT 0, -- Keep for backward compatibility
        created_at TIMESTAMPTZ DEFAULT now()
    );

    -- Ensure columns exist if table was created earlier
    ALTER TABLE purchase_items ADD COLUMN IF NOT EXISTS gst_rate DECIMAL(5,2) DEFAULT 18;
    ALTER TABLE purchase_items ADD COLUMN IF NOT EXISTS cgst DECIMAL(12,2) DEFAULT 0;
    ALTER TABLE purchase_items ADD COLUMN IF NOT EXISTS sgst DECIMAL(12,2) DEFAULT 0;
    ALTER TABLE purchase_items ADD COLUMN IF NOT EXISTS igst DECIMAL(12,2) DEFAULT 0;
    ALTER TABLE purchase_items ADD COLUMN IF NOT EXISTS amount DECIMAL(12,2) DEFAULT 0;
    ALTER TABLE purchase_items ADD COLUMN IF NOT EXISTS total_price DECIMAL(12,2) DEFAULT 0;
    ALTER TABLE purchase_items ADD COLUMN IF NOT EXISTS hsn_code TEXT;

    -- Enable RLS
    ALTER TABLE purchase_items ENABLE ROW LEVEL SECURITY;

    -- PURCHASE ITEMS POLICY
    DROP POLICY IF EXISTS "Users can manage their purchase items" ON purchase_items;
    CREATE POLICY "Users can manage their purchase items" ON purchase_items
        FOR ALL USING (
            public.is_super_admin()
            OR EXISTS (
                SELECT 1 FROM purchases 
                WHERE purchases.id = purchase_items.purchase_id
                AND (
                    (purchases.business_id = public.get_auth_business_id() AND public.is_auth_admin())
                    OR purchases.created_by = auth.uid()
                )
            )
        );

    -- 12. EXPENSES
    CREATE TABLE IF NOT EXISTS expenses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        business_id UUID REFERENCES business_profiles(id) ON DELETE CASCADE ON UPDATE CASCADE,
        created_by UUID REFERENCES public.users(id) ON DELETE SET NULL ON UPDATE CASCADE,
        category TEXT NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        description TEXT,
        date DATE DEFAULT CURRENT_DATE,
        created_at TIMESTAMPTZ DEFAULT now()
    );

    -- Enable RLS
    ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

    -- EXPENSES POLICY
    DROP POLICY IF EXISTS "Users can manage their expenses" ON expenses;
    CREATE POLICY "Users can manage their expenses" ON expenses
        FOR ALL USING (
            public.can_access_business(business_id)
            OR created_by = auth.uid()
        );

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_expenses_business_id ON expenses(business_id);
    CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase_id ON purchase_items(purchase_id);
    CREATE INDEX IF NOT EXISTS idx_purchases_business_id ON purchases(business_id);
    CREATE INDEX IF NOT EXISTS idx_purchases_supplier_id ON purchases(supplier_id);
    CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(date);
    CREATE INDEX IF NOT EXISTS idx_invoices_business_id ON invoices(business_id);
    CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON invoices(customer_id);
    CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id);
    CREATE INDEX IF NOT EXISTS idx_products_business_id ON products(business_id);
    CREATE INDEX IF NOT EXISTS idx_customers_business_id ON customers(business_id);

    -- 10. NOTIFICATIONS
    CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        link TEXT,
        type TEXT DEFAULT 'global',
        created_by UUID REFERENCES public.users(id) ON DELETE SET NULL ON UPDATE CASCADE,
        created_at TIMESTAMPTZ DEFAULT now()
    );

    -- Enable RLS
    ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

    -- NOTIFICATIONS POLICY
    -- 1. Users can read relevant notifications
    DROP POLICY IF EXISTS "Anyone can read notifications" ON notifications;
    DROP POLICY IF EXISTS "Users can read relevant notifications" ON notifications;
    CREATE POLICY "Users can read relevant notifications" ON notifications
        FOR SELECT USING (
            auth.role() = 'authenticated'
        );

    -- 2. Only Super Admins can manage notifications
    DROP POLICY IF EXISTS "Super Admins can manage notifications" ON notifications;
    CREATE POLICY "Super Admins can manage notifications" ON notifications
        FOR ALL USING (public.is_super_admin());

    -- Trigger to create user_notifications for all users when a new notification is created
    CREATE OR REPLACE FUNCTION public.create_user_notifications()
    RETURNS TRIGGER AS $$
    BEGIN
        -- Only automatically create user_notifications for 'global' type
        -- 'user' type notifications are handled manually by the API for specific users
        IF NEW.type = 'global' THEN
            INSERT INTO public.user_notifications (user_id, notification_id)
            SELECT id, NEW.id FROM public.users;
        END IF;
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

    DROP TRIGGER IF EXISTS on_notification_created ON public.notifications;
    CREATE TRIGGER on_notification_created
    AFTER INSERT ON public.notifications
    FOR EACH ROW EXECUTE FUNCTION public.create_user_notifications();

    -- 15. USER NOTIFICATIONS
    CREATE TABLE IF NOT EXISTS user_notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
        notification_id UUID REFERENCES public.notifications(id) ON DELETE CASCADE,
        is_read BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT now()
    );

    -- Enable RLS
    ALTER TABLE user_notifications ENABLE ROW LEVEL SECURITY;

    -- USER NOTIFICATIONS POLICY
    -- Users can only read their own notifications
    DROP POLICY IF EXISTS "Users can read their own notifications" ON user_notifications;
    CREATE POLICY "Users can read their own notifications" ON user_notifications
        FOR SELECT USING (auth.uid() = user_id);

    -- 16. APP SETTINGS (Global)
    CREATE TABLE IF NOT EXISTS app_settings (
        id TEXT PRIMARY KEY DEFAULT 'global',
        logo_url TEXT,
        app_name TEXT DEFAULT 'My App',
        updated_at TIMESTAMPTZ DEFAULT now()
    );

    -- Enable RLS
    ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

    -- APP SETTINGS POLICY
    -- 1. Anyone can read app settings (for login page)
    DROP POLICY IF EXISTS "Public read app settings" ON app_settings;
    CREATE POLICY "Public read app settings" ON app_settings
        FOR SELECT USING (true);

    -- 2. Only Super Admins can manage app settings
    DROP POLICY IF EXISTS "Super Admins manage app settings" ON app_settings;
    CREATE POLICY "Super Admins manage app settings" ON app_settings
        FOR ALL USING (public.is_super_admin());

    -- 17. GLOBAL LOGOS BUCKET
    INSERT INTO storage.buckets (id, name, public) 
    VALUES ('global-logos', 'global-logos', true)
    ON CONFLICT (id) DO NOTHING;

    -- Allow public to view global logos
    DROP POLICY IF EXISTS "Public Access Global Logos" ON storage.objects;
    CREATE POLICY "Public Access Global Logos" ON storage.objects 
    FOR SELECT USING (bucket_id = 'global-logos');

    -- Only Super Admins can upload global logos
    DROP POLICY IF EXISTS "Super Admin Upload Global Logos" ON storage.objects;
    CREATE POLICY "Super Admin Upload Global Logos" ON storage.objects 
    FOR ALL USING (
        bucket_id = 'global-logos' 
        AND public.is_super_admin()
    );

    -- 18. TRANSPORTERS
    CREATE TABLE IF NOT EXISTS transporters (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        business_id UUID REFERENCES business_profiles(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        transporter_id TEXT NOT NULL, -- GSTIN/ID
        phone TEXT,
        email TEXT,
        address TEXT,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
    );

    ALTER TABLE transporters ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "Users can manage their transporters" ON transporters
        FOR ALL USING (
            public.can_access_business(business_id)
        );

    -- 19. EWAY BILLS
    CREATE TABLE IF NOT EXISTS eway_bills (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
        business_id UUID REFERENCES business_profiles(id) ON DELETE CASCADE,
        eway_bill_no TEXT,
        transporter_id TEXT, -- GSTIN or ID
        transporter_name TEXT,
        trans_mode TEXT, -- 1: Road, 2: Rail, 3: Air, 4: Ship
        trans_distance INTEGER,
        trans_doc_no TEXT,
        trans_doc_date DATE,
        vehicle_no TEXT,
        vehicle_type TEXT, -- R: Regular, O: Over Dimensional Cargo
        supply_type TEXT,
        sub_supply_type TEXT,
        transaction_type INTEGER DEFAULT 1, -- 1: Regular, 2: Bill To - Ship To, 3: Bill From - Dispatch From, 4: Combination of 2 and 3
        total_value DECIMAL(12,2) DEFAULT 0,
        cgst_value DECIMAL(12,2) DEFAULT 0,
        sgst_value DECIMAL(12,2) DEFAULT 0,
        igst_amount DECIMAL(12,2) DEFAULT 0,
        cess_value DECIMAL(12,2) DEFAULT 0,
        tot_non_advol_val DECIMAL(12,2) DEFAULT 0,
        oth_value DECIMAL(12,2) DEFAULT 0,
        tot_inv_value DECIMAL(12,2) DEFAULT 0,
        to_addr1 TEXT,
        to_addr2 TEXT,
        to_place TEXT,
        to_pincode INTEGER,
        to_state_code INTEGER,
        from_state_code INTEGER,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
    );

    ALTER TABLE eway_bills ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "Users can manage their eway bills" ON eway_bills
        FOR ALL USING (
            public.can_access_business(business_id)
        );
