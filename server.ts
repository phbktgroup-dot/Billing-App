import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import nodemailer from "nodemailer";
import cors from "cors";

console.log("SERVER STARTING...");
dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

  // Request logging
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
  });

  // Supabase Admin Client
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

  console.log("Supabase URL:", supabaseUrl ? "Present" : "Missing");
  console.log("Supabase Service Key:", supabaseServiceKey ? "Present" : "Missing");
  console.log("Supabase Anon Key:", supabaseAnonKey ? "Present" : "Missing");

  let supabaseAdmin: any = null;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("\x1b[31m%s\x1b[0m", "CRITICAL ERROR: Supabase environment variables are missing!");
    console.error("\x1b[33m%s\x1b[0m", "Please ensure you have added them to AI Studio Secrets:");
    console.error("VITE_SUPABASE_URL=your_url");
    console.error("SUPABASE_SERVICE_ROLE_KEY=your_service_role_key");
    console.error("\x1b[36m%s\x1b[0m", "The server will start, but API routes requiring Supabase will fail.");
  } else {
    try {
      supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

      // Test connection on startup
      const { data, error } = await supabaseAdmin.from('users').select('count').single();
      if (error) {
        console.error("Supabase Admin test query failed:", error.message);
      } else {
        console.log("Supabase Admin connected successfully. User count:", data.count);
      }
    } catch (err: any) {
      console.error("Supabase Admin initialization crashed:", err.message);
      supabaseAdmin = null;
    }
  }

  // Health check route
  app.get("/api/health", async (req, res) => {
    if (!supabaseAdmin) {
      return res.status(500).json({ status: "error", message: "Supabase Admin client not initialized. Check environment variables." });
    }
    try {
      const { data, error } = await supabaseAdmin.from('users').select('count').single();
      if (error) throw error;
      res.json({ status: "ok", supabase: "connected", userCount: data });
    } catch (error: any) {
      console.error("Health check failed:", error);
      res.status(500).json({ status: "error", message: error.message });
    }
  });

  // Helper to verify admin token
  async function verifyAdmin(req: express.Request) {
    if (!supabaseAdmin) {
      throw new Error("Supabase Admin client not initialized. Check environment variables.");
    }
    console.log("verifyAdmin - Verifying token");
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      console.error("verifyAdmin - Missing authorization header");
      throw new Error("Missing authorization header");
    }

    const token = authHeader.replace('Bearer ', '');
    console.log("verifyAdmin - Token:", token);
    console.log("verifyAdmin - Token length:", token.length);
    console.log("verifyAdmin - Token parts:", token.split('.').length);

    // Use admin client for user auth validation
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      console.error("verifyAdmin - Invalid token:", authError);
      throw new Error("Invalid token: " + (authError?.message || "User not found"));
    }

    console.log("verifyAdmin - User authenticated:", user.email, "ID:", user.id);
    const { data: profile, error: profileError } = await supabaseAdmin.from('users').select('*').eq('id', user.id).single();
    
    if (profileError) {
      console.error("verifyAdmin - Profile fetch error:", profileError.message);
      // If the user is phbktgroup@gmail.com, we might want to allow them even if profile is missing
      if (user.email === 'phbktgroup@gmail.com') {
        console.log("verifyAdmin - Super Admin email detected, bypassing profile check");
        return { user, profile: { role: 'Super Admin' }, isSuperAdmin: true, isAdmin: false };
      }
      throw new Error("Profile not found: " + profileError.message);
    }

    if (!profile) {
      console.error("verifyAdmin - Profile not found for user:", user.id);
      throw new Error("Profile not found");
    }

    console.log("verifyAdmin - Profile found:", profile.role);

    const isSuperAdmin = profile.role === 'Super Admin' || user.email === 'phbktgroup@gmail.com';
    const isAdmin = profile.role === 'Admin';

    if (!isSuperAdmin && !isAdmin) {
      console.error("verifyAdmin - Forbidden: User role is", profile.role);
      throw new Error("Forbidden: Admins only");
    }

    return { user, profile, isSuperAdmin, isAdmin };
  }

  // API Routes
  app.get("/api/admin/users", async (req, res) => {
    console.log("GET /api/admin/users - Request received");
    try {
      const { user, profile, isSuperAdmin } = await verifyAdmin(req);
      console.log(`GET /api/admin/users - Admin verified: ${user.email}, isSuperAdmin: ${isSuperAdmin}`);

      let query = supabaseAdmin.from('users').select('*, business_profiles(name)');

      if (!isSuperAdmin) {
        if (profile.business_id) {
          query = query.or(`id.eq.${user.id},created_by.eq.${user.id},business_id.eq.${profile.business_id}`);
        } else {
          query = query.or(`id.eq.${user.id},created_by.eq.${user.id}`);
        }
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;

      res.json({ users: data });
    } catch (error: any) {
      console.error("Error fetching users:", error);
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/admin/create-user", async (req, res) => {
    try {
      const { user: adminUser, profile: adminProfile, isSuperAdmin } = await verifyAdmin(req);
      const { email, password, name, role, created_by } = req.body;

      // 1. Create user in Supabase Auth
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name }
      });

      if (authError) throw authError;

      // 2. Create/Update profile in public.users table
      // We intentionally do NOT assign a business_id here.
      // Every user (even those created by an Admin) will be forced to 
      // complete the Business Setup page upon their first login to create 
      // their own separate business profile.
      const profileData: any = {
        id: authData.user.id,
        email,
        name,
        role,
        created_by: created_by || adminUser.id,
        business_id: null // Ensure it's null so they are forced to setup
      };

      const { error: profileError } = await supabaseAdmin
        .from('users')
        .upsert(profileData);

      if (profileError) {
        // If profile creation fails, we should ideally delete the auth user to maintain consistency
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        throw profileError;
      }

      res.json({ success: true, user: authData.user });
    } catch (error: any) {
      console.error("Error creating user:", error);
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/admin/update-user", async (req, res) => {
    try {
      const { user: adminUser, profile: adminProfile, isSuperAdmin } = await verifyAdmin(req);
      const { userId, name, role } = req.body;

      const { data: targetUser } = await supabaseAdmin.from('users').select('*').eq('id', userId).single();
      if (!targetUser) throw new Error("User not found");

      if (!isSuperAdmin) {
        if (targetUser.created_by !== adminUser.id && targetUser.business_id !== adminProfile.business_id) {
          throw new Error("Forbidden: Cannot edit this user");
        }
      }

      const { error } = await supabaseAdmin.from('users').update({ name, role }).eq('id', userId);
      if (error) throw error;

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error updating user:", error);
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/admin/toggle-status", async (req, res) => {
    try {
      const { user: adminUser, profile: adminProfile, isSuperAdmin } = await verifyAdmin(req);
      const { userId, isActive } = req.body;

      const { data: targetUser } = await supabaseAdmin.from('users').select('*').eq('id', userId).single();
      if (!targetUser) throw new Error("User not found");

      if (!isSuperAdmin) {
        if (targetUser.created_by !== adminUser.id && targetUser.business_id !== adminProfile.business_id) {
          throw new Error("Forbidden: Cannot edit this user");
        }
      }

      const { error } = await supabaseAdmin.from('users').update({ is_active: isActive }).eq('id', userId);
      if (error) throw error;

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error toggling user status:", error);
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/admin/delete-user", async (req, res) => {
    try {
      const { isSuperAdmin, user: superAdminUser } = await verifyAdmin(req);
      if (!isSuperAdmin) throw new Error("Forbidden: Only Super Admins can delete users");

      const { userId } = req.body;

      if (userId === superAdminUser.id) {
        throw new Error("You cannot delete your own account.");
      }

      // 1. Get target user profile to check role
      const { data: targetUser, error: targetError } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (targetError || !targetUser) {
        throw new Error("User profile not found");
      }

      // 2. If Admin, reassign their managed users to the Super Admin
      if (targetUser.role === 'Admin') {
        console.log(`Reassigning users created by Admin ${userId} to Super Admin ${superAdminUser.id}`);
        const { error: reassignError } = await supabaseAdmin
          .from('users')
          .update({ created_by: superAdminUser.id })
          .eq('created_by', userId);
        
        if (reassignError) {
          console.error("Error reassigning users:", reassignError.message);
          throw new Error("Failed to reassign managed users: " + reassignError.message);
        }
      }

      // 3. Handle file deletion (logos)
      // Try to query storage.objects directly to find ALL files owned by this user
      try {
        console.log(`Looking for storage objects owned by user ${userId}...`);
        const { data: objects, error: objectsError } = await supabaseAdmin
          .schema('storage')
          .from('objects')
          .select('name, bucket_id')
          .eq('owner', userId);
        
        if (objectsError) {
          console.warn("Could not query storage.objects directly:", objectsError.message);
        } else if (objects && objects.length > 0) {
          console.log(`Found ${objects.length} files owned by user ${userId}. Deleting...`);
          // Group by bucket
          const buckets = [...new Set(objects.map(o => o.bucket_id))];
          for (const bucket of buckets) {
            const filesToRemove = objects.filter(o => o.bucket_id === bucket).map(o => o.name);
            console.log(`Deleting from bucket ${bucket}:`, filesToRemove);
            const { error: removeError } = await supabaseAdmin.storage.from(bucket).remove(filesToRemove);
            if (removeError) {
              console.warn(`Failed to delete files from bucket ${bucket}:`, removeError.message);
            }
          }
        } else {
          console.log(`No storage objects found for user ${userId}.`);
        }
      } catch (storageErr) {
        console.warn("Exception querying storage.objects:", storageErr);
      }

      // Fallback: Also try to delete the business logo folder if they own a business
      const { data: business } = await supabaseAdmin
        .from('business_profiles')
        .select('id, logo_url')
        .eq('user_id', userId)
        .single();
      
      if (business) {
        try {
          // List all files in the business's logo folder
          const folderPath = `business-logos/${business.id}`;
          const { data: files, error: listError } = await supabaseAdmin.storage
            .from('logos')
            .list(folderPath);

          if (listError) {
            console.warn("Failed to list logos from storage:", listError);
          } else if (files && files.length > 0) {
            const filesToRemove = files.map(f => `${folderPath}/${f.name}`);
            console.log(`Deleting logo files (fallback):`, filesToRemove);
            const { error: removeError } = await supabaseAdmin.storage
              .from('logos')
              .remove(filesToRemove);
            
            if (removeError) {
              console.warn("Failed to delete logos from storage (fallback):", removeError);
            }
          }
        } catch (storageErr) {
          console.warn("Failed to delete logos from storage (fallback):", storageErr);
        }
      }

      // 3.5. Nullify created_by references to avoid foreign key constraint violations
      console.log(`Nullifying created_by references for user ${userId}`);
      await Promise.all([
        supabaseAdmin.from('products').update({ created_by: null }).eq('created_by', userId),
        supabaseAdmin.from('customers').update({ created_by: null }).eq('created_by', userId),
        supabaseAdmin.from('invoices').update({ created_by: null }).eq('created_by', userId),
        supabaseAdmin.from('suppliers').update({ created_by: null }).eq('created_by', userId),
        supabaseAdmin.from('purchases').update({ created_by: null }).eq('created_by', userId),
        supabaseAdmin.from('expenses').update({ created_by: null }).eq('created_by', userId),
        supabaseAdmin.from('notifications').update({ created_by: null }).eq('created_by', userId),
      ]);

      // 4. Delete profile from public.users table FIRST
      // This will cascade to business_profiles (ON DELETE CASCADE)
      // and then to all business data (customers, products, invoices, etc.)
      const { error: profileError } = await supabaseAdmin
        .from('users')
        .delete()
        .eq('id', userId);

      if (profileError) {
        console.error("Profile delete error:", profileError.message);
        throw profileError;
      }

      // 5. Delete user from Supabase Auth AFTER public.users is deleted
      // This avoids "Database error deleting user" if auth.users is referenced by public.users
      if (supabaseServiceKey) {
        const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
        if (authError) {
          console.warn(`Auth delete warning for ${userId}:`, authError.message);
        }
      } else {
        console.warn("SUPABASE_SERVICE_ROLE_KEY is missing. Cannot delete from auth.users.");
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting user:", error);
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/admin/send-notification", async (req, res) => {
    try {
      const { isSuperAdmin, user } = await verifyAdmin(req);
      if (!isSuperAdmin) throw new Error("Forbidden: Only Super Admins can send notifications");

      const { title, message } = req.body;
      if (!title || !message) throw new Error("Title and message are required");

      const { data, error } = await supabaseAdmin.from('notifications').insert({
        title,
        message,
        created_by: user.id,
        type: 'global'
      }).select().single();

      if (error) throw error;

      res.json({ success: true, notification: data });
    } catch (error: any) {
      console.error("Error sending notification:", error);
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/admin/send-user-notification", async (req, res) => {
    try {
      const { user, isSuperAdmin } = await verifyAdmin(req);
      const { title, message, userId } = req.body;
      if (!title || !message) throw new Error("Title and message are required");

      let targetUsers = [];

      if (userId === 'all') {
        let query = supabaseAdmin.from('users').select('id');
        if (!isSuperAdmin) {
          query = query.eq('created_by', user.id);
        }
        const { data, error } = await query;
        if (error) throw error;
        targetUsers = data || [];
      } else {
        const { data: targetUser, error: userError } = await supabaseAdmin
          .from('users')
          .select('id, created_by')
          .eq('id', userId)
          .single();
        
        if (userError || !targetUser) throw new Error("User not found");

        if (!isSuperAdmin && targetUser.created_by !== user.id) {
          throw new Error("Forbidden: You can only send notifications to users you created");
        }
        targetUsers = [targetUser];
      }

      console.log("DEBUG: targetUsers count:", targetUsers.length);
      console.log("DEBUG: targetUsers:", JSON.stringify(targetUsers));

      if (targetUsers.length === 0) {
        res.json({ success: true });
        return;
      }

      // 1. Insert notification content
      const { data: newNotification, error: notifError } = await supabaseAdmin
        .from('notifications')
        .insert({
          title,
          message,
          created_by: user.id,
          type: 'user'
        })
        .select('id')
        .single();
      
      if (notifError) throw notifError;

      // 2. Insert user_notifications links
      const userNotifications = targetUsers.map(u => ({
        notification_id: newNotification.id,
        user_id: u.id
      }));

      const { error: linkError } = await supabaseAdmin.from('user_notifications').insert(userNotifications);
      if (linkError) throw linkError;

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error sending user notification:", error);
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/admin/delete-notification", async (req, res) => {
    console.log("POST /api/admin/delete-notification - Request received");
    try {
      const { isSuperAdmin } = await verifyAdmin(req);
      if (!isSuperAdmin) throw new Error("Forbidden: Only Super Admins can delete notifications");

      const { id } = req.body;
      console.log("Deleting notification with id:", id);
      if (!id) throw new Error("Notification ID is required");

      const { error } = await supabaseAdmin.from('notifications').delete().eq('id', id);
      if (error) throw error;

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting notification:", error);
      res.status(400).json({ error: error.message });
    }
  });


  // OTP routes
  app.post("/api/auth/request-otp", async (req, res) => {
    try {
      const email = req.body.email.toLowerCase();
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60000); // 10 minutes

      console.log(`Requesting OTP for ${email}: ${otp}, expires at ${expiresAt.toISOString()}`);

      await supabaseAdmin.from('otps').insert({ email, otp, expires_at: expiresAt.toISOString() });

      await transporter.sendMail({
        from: process.env.SMTP_USER,
        to: email,
        subject: "Password Reset OTP",
        text: `Your OTP for password reset is: ${otp}. It expires in 10 minutes.`,
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error requesting OTP:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/auth/verify-otp", async (req, res) => {
    try {
      const email = req.body.email.toLowerCase();
      const otp = req.body.otp.trim();
      console.log(`Verifying OTP for ${email}: received ${otp}`);
      
      // 1. Find the most recent OTP for this email and otp
      const { data, error } = await supabaseAdmin
        .from('otps')
        .select('*')
        .eq('email', email)
        .eq('otp', otp)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error("Invalid OTP.");

      console.log(`Found OTP record:`, data);
      console.log(`Current server time:`, new Date().toISOString());
      console.log(`OTP expires at:`, new Date(data.expires_at).toISOString());

      // 3. Check if expired
      if (new Date(data.expires_at) < new Date()) throw new Error("OTP has expired.");

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error verifying OTP:", error);
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/auth/reset-password-otp", async (req, res) => {
    try {
      const email = req.body.email.toLowerCase();
      const otp = req.body.otp.trim();
      const { password } = req.body;
      
      // 1. Find the most recent OTP for this email
      const { data, error } = await supabaseAdmin
        .from('otps')
        .select('*')
        .eq('email', email)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error("No OTP found for this email.");

      // 2. Check if OTP matches
      if (data.otp !== otp) throw new Error("Invalid OTP.");

      // 3. Check if expired
      if (new Date(data.expires_at) < new Date()) throw new Error("OTP has expired.");

      // Get user ID
      const { data: userData, error: userError } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('email', email)
        .single();
      
      if (userError) throw userError;

      // Update password
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        userData.id,
        { password }
      );

      if (updateError) throw updateError;

      // Delete OTP
      await supabaseAdmin.from('otps').delete().eq('id', data.id);

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error resetting password:", error);
      res.status(400).json({ error: error.message });
    }
  });

  // Check email existence route
  app.post("/api/auth/check-email", async (req, res) => {
    try {
      const { email } = req.body;
      if (!supabaseAdmin) throw new Error("Supabase Admin client not initialized.");
      
      const { data, error } = await supabaseAdmin
        .from('users')
        .select('id')
        .ilike('email', email)
        .maybeSingle();
        
      if (error) throw error;
      res.json({ exists: !!data });
    } catch (error: any) {
      console.error("Error checking email:", error);
      res.status(400).json({ error: error.message });
    }
  });

  // API 404 handler
  app.all("/api/*", (req, res) => {
    res.status(404).json({ error: `API route not found: ${req.method} ${req.url}` });
  });

  // Global error handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("Unhandled error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
