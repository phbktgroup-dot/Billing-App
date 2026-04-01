import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import nodemailer from "nodemailer";
import cors from "cors";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";

console.log("SERVER STARTING...");
dotenv.config();

// Helper to get __dirname in ESM
const getDirname = () => {
  try {
    return path.dirname(fileURLToPath(import.meta.url));
  } catch (e) {
    return process.cwd();
  }
};

const __dirname = getDirname();

const app = express();
const PORT = 3000;

// Initialize transporter lazily to avoid startup crashes
let transporter: any = null;
const getTransporter = () => {
  if (!transporter && process.env.SMTP_HOST) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
};

// Supabase Admin Client
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

let supabaseAdmin: any = null;

if (supabaseUrl && supabaseServiceKey) {
  try {
    supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    console.log("Supabase Admin client initialized.");
  } catch (err: any) {
    console.error("Supabase Admin initialization failed:", err.message);
  }
} else {
  console.warn("Supabase environment variables missing. Admin routes will fail.");
}

// Basic Middleware (Synchronous)
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Force JSON for all /api routes
app.use("/api", (req, res, next) => {
  res.setHeader('Content-Type', 'application/json');
  next();
});

// Request logging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// Helper to verify admin token
async function verifyAdmin(req: express.Request) {
  if (!supabaseAdmin) {
    throw new Error("Supabase Admin client not initialized. Check environment variables.");
  }
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    throw new Error("Missing authorization header");
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) {
    throw new Error("Invalid token: " + (authError?.message || "User not found"));
  }

  const { data: profile, error: profileError } = await supabaseAdmin.from('users').select('*').eq('id', user.id).single();
  
  if (profileError) {
    if (user.email === 'phbktgroup@gmail.com') {
      return { user, profile: { role: 'Super Admin' }, isSuperAdmin: true, isAdmin: false };
    }
    throw new Error("Profile not found: " + profileError.message);
  }

  if (!profile) throw new Error("Profile not found");

  const isSuperAdmin = profile.role === 'Super Admin' || user.email === 'phbktgroup@gmail.com';
  const isAdmin = profile.role === 'Admin';

  if (!isSuperAdmin && !isAdmin) {
    throw new Error("Forbidden: Admins only");
  }

  return { user, profile, isSuperAdmin, isAdmin };
}

// API Routes (Synchronous Registration)
app.get("/api/health", async (req, res) => {
  if (!supabaseAdmin) {
    return res.status(500).json({ 
      status: "error", 
      message: "Supabase Admin client not initialized.",
      details: {
        url: !!process.env.VITE_SUPABASE_URL,
        key: !!process.env.SUPABASE_SERVICE_ROLE_KEY
      }
    });
  }
  try {
    const { count, error } = await supabaseAdmin.from('users').select('*', { count: 'exact', head: true });
    if (error) throw error;
    res.json({ 
      status: "ok", 
      supabase: "connected", 
      userCount: count,
      adminConfigured: !!process.env.SUPABASE_SERVICE_ROLE_KEY
    });
  } catch (error: any) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

app.get("/api/admin/users", async (req, res) => {
  try {
    const { user, profile, isSuperAdmin } = await verifyAdmin(req);
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
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/admin/create-user", async (req, res) => {
  try {
    const { user: adminUser, profile: adminProfile, isSuperAdmin } = await verifyAdmin(req);
    const { email, password, name, role, created_by } = req.body;
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name }
    });
    if (authError) throw authError;
    const profileData: any = {
      id: authData.user.id,
      email,
      name,
      role,
      created_by: created_by || adminUser.id,
      business_id: null
    };
    const { error: profileError } = await supabaseAdmin.from('users').upsert(profileData);
    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      throw profileError;
    }
    res.json({ success: true, user: authData.user });
  } catch (error: any) {
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
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/admin/delete-user", async (req, res) => {
  try {
    const { isSuperAdmin, isAdmin, user: adminUser, profile: adminProfile } = await verifyAdmin(req);
    if (!isSuperAdmin && !isAdmin) throw new Error("Forbidden: Only Admins can delete users");
    const { userId } = req.body;
    if (userId === adminUser.id) throw new Error("You cannot delete your own account.");
    const { data: targetUser, error: targetError } = await supabaseAdmin.from('users').select('*').eq('id', userId).single();
    if (targetError || !targetUser) throw new Error("User profile not found");
    
    if (!isSuperAdmin) {
      if (targetUser.role === 'Super Admin' || targetUser.role === 'Admin') {
        throw new Error("Forbidden: Admins cannot delete other Admins or Super Admins");
      }
      if (targetUser.created_by !== adminUser.id && targetUser.business_id !== adminProfile.business_id) {
        throw new Error("Forbidden: You do not have permission to delete this user");
      }
    }

    if (targetUser.role === 'Admin' || targetUser.role === 'Super Admin') {
      // Reassign users created by the deleted user to the current admin
      // But avoid self-reference (don't set a user's creator to themselves)
      await supabaseAdmin.from('users')
        .update({ created_by: adminUser.id })
        .eq('created_by', userId)
        .neq('id', adminUser.id);
      
      // If the current admin was created by the deleted user, set their creator to null (they are now a root)
      await supabaseAdmin.from('users')
        .update({ created_by: null })
        .eq('id', adminUser.id)
        .eq('created_by', userId);
    }
    
    // Storage cleanup
    try {
      const { data: objects } = await supabaseAdmin.schema('storage').from('objects').select('name, bucket_id').eq('owner', userId);
      if (objects && objects.length > 0) {
        const buckets = [...new Set(objects.map((o: any) => o.bucket_id))];
        for (const bucket of buckets) {
          const filesToRemove = objects.filter((o: any) => o.bucket_id === bucket).map((o: any) => o.name);
          await supabaseAdmin.storage.from(bucket).remove(filesToRemove);
        }
      }
    } catch (e) {}

    await Promise.all([
      supabaseAdmin.from('products').update({ created_by: null }).eq('created_by', userId),
      supabaseAdmin.from('customers').update({ created_by: null }).eq('created_by', userId),
      supabaseAdmin.from('invoices').update({ created_by: null }).eq('created_by', userId),
      supabaseAdmin.from('suppliers').update({ created_by: null }).eq('created_by', userId),
      supabaseAdmin.from('purchases').update({ created_by: null }).eq('created_by', userId),
      supabaseAdmin.from('expenses').update({ created_by: null }).eq('created_by', userId),
      supabaseAdmin.from('notifications').update({ created_by: null }).eq('created_by', userId),
    ]);

    const { error: profileError } = await supabaseAdmin.from('users').delete().eq('id', userId);
    if (profileError) throw profileError;
    await supabaseAdmin.auth.admin.deleteUser(userId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/admin/send-notification", async (req, res) => {
  try {
    const { isSuperAdmin, user } = await verifyAdmin(req);
    if (!isSuperAdmin) throw new Error("Forbidden: Only Super Admins can send notifications");
    const { title, message } = req.body;
    const { data, error } = await supabaseAdmin.from('notifications').insert({ title, message, created_by: user.id, type: 'global' }).select().single();
    if (error) throw error;
    res.json({ success: true, notification: data });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/admin/send-user-notification", async (req, res) => {
  try {
    const { user, profile, isSuperAdmin } = await verifyAdmin(req);
    const { title, message, userId } = req.body;
    let targetUsers = [];
    if (userId === 'all') {
      let query = supabaseAdmin.from('users').select('id');
      if (!isSuperAdmin) {
        // Admin sends to all users they created or are in their business
        if (profile.business_id) {
          query = query.or(`created_by.eq.${user.id},business_id.eq.${profile.business_id}`);
        } else {
          query = query.eq('created_by', user.id);
        }
      }
      const { data, error } = await query;
      if (error) throw error;
      targetUsers = data || [];
    } else {
      const { data: targetUser, error: userError } = await supabaseAdmin.from('users').select('id, created_by, business_id').eq('id', userId).single();
      if (userError || !targetUser) throw new Error("User not found");
      
      if (!isSuperAdmin) {
        const isDescendant = targetUser.created_by === user.id;
        const isColleague = profile.business_id && targetUser.business_id === profile.business_id;
        if (!isDescendant && !isColleague) throw new Error("Forbidden: You can only send notifications to users under your management.");
      }
      targetUsers = [targetUser];
    }
    if (targetUsers.length === 0) return res.json({ success: true });
    const { data: newNotif, error: notifError } = await supabaseAdmin.from('notifications').insert({ title, message, created_by: user.id, type: 'user' }).select('id').single();
    if (notifError) throw notifError;
    const userNotifs = targetUsers.map(u => ({ notification_id: newNotif.id, user_id: u.id }));
    await supabaseAdmin.from('user_notifications').insert(userNotifs);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/admin/delete-notification", async (req, res) => {
  try {
    const { isSuperAdmin, user } = await verifyAdmin(req);
    const { id } = req.body;
    
    const { data: notification, error: fetchError } = await supabaseAdmin
      .from('notifications')
      .select('*')
      .eq('id', id)
      .single();
      
    if (fetchError || !notification) throw new Error("Notification not found");
    
    if (!isSuperAdmin && notification.created_by !== user.id) {
      throw new Error("Forbidden: You can only delete notifications you created");
    }
    
    const { error } = await supabaseAdmin.from('notifications').delete().eq('id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/auth/request-otp", async (req, res) => {
  try {
    const email = req.body.email.toLowerCase();
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60000);
    await supabaseAdmin.from('otps').insert({ email, otp, expires_at: expiresAt.toISOString() });
    const mailTransporter = getTransporter();
    if (!mailTransporter) throw new Error("Email service not configured.");
    await mailTransporter.sendMail({
      from: process.env.SMTP_USER,
      to: email,
      subject: "Password Reset OTP",
      text: `Your OTP for password reset is: ${otp}. It expires in 10 minutes.`,
    });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/auth/verify-otp", async (req, res) => {
  try {
    const email = req.body.email.toLowerCase();
    const otp = req.body.otp.trim();
    const { data, error } = await supabaseAdmin.from('otps').select('*').eq('email', email).eq('otp', otp).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("Invalid OTP.");
    if (new Date(data.expires_at) < new Date()) throw new Error("OTP has expired.");
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/auth/reset-password-otp", async (req, res) => {
  try {
    const email = req.body.email.toLowerCase();
    const otp = req.body.otp.trim();
    const { password } = req.body;
    const { data, error } = await supabaseAdmin.from('otps').select('*').eq('email', email).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    if (!data || data.otp !== otp) throw new Error("Invalid OTP.");
    if (new Date(data.expires_at) < new Date()) throw new Error("OTP has expired.");
    const { data: userData, error: userError } = await supabaseAdmin.from('users').select('id').eq('email', email).single();
    if (userError) throw userError;
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userData.id, { password });
    if (updateError) throw updateError;
    await supabaseAdmin.from('otps').delete().eq('id', data.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/auth/check-email", async (req, res) => {
  try {
    const { email } = req.body;
    const { data, error } = await supabaseAdmin.from('users').select('id').ilike('email', email).maybeSingle();
    if (error) throw error;
    res.json({ exists: !!data });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/scan", async (req, res) => {
  try {
    const { base64Data, mimeType, prompt, apiKey, config = {} } = req.body;
    
    // Use the provided API key or fallback to the server's environment variable
    const effectiveApiKey = apiKey || process.env.GEMINI_API_KEY;
    
    if (!effectiveApiKey) {
      throw new Error("Gemini API key is missing. Please provide one in the request or set GEMINI_API_KEY on the server.");
    }

    const ai = new GoogleGenAI({ apiKey: effectiveApiKey });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            { inlineData: { mimeType, data: base64Data } }
          ]
        }
      ],
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
        ...config
      }
    });

    res.json({ text: response.text });
  } catch (error: any) {
    let errorMessage = error.message || "An error occurred during scanning";
    
    // Try to parse the error message if it's a JSON string
    try {
      if (errorMessage.startsWith('{')) {
        const parsed = JSON.parse(errorMessage);
        if (parsed.error && parsed.error.message) {
          errorMessage = parsed.error.message;
        }
      }
    } catch (e) {
      // Ignore parsing errors
    }

    console.error("Scan API Error:", errorMessage);
    res.status(error.status || 500).json({ 
      error: errorMessage,
      details: error.details || []
    });
  }
});

// API 404 handler
app.all("/api/*", (req, res) => {
  res.status(404).json({ error: "API Route Not Found" });
});

// Global error handler for API
app.use("/api/*", (err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  res.status(500).json({ error: "Internal Server Error", message: err.message });
});

// Static/Vite Middleware (Async Init)
async function initStatic() {
  if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
    try {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } catch (e) {
      console.warn("Vite failed to load.");
    }
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"), (err) => {
        if (err) res.status(200).send("App is running. Frontend assets may still be deploying.");
      });
    });
  }

  if (!process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}

initStatic();

export default app;
