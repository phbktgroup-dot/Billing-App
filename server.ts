import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // Supabase Admin Client
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("\x1b[31m%s\x1b[0m", "CRITICAL ERROR: Supabase environment variables are missing!");
    console.error("\x1b[33m%s\x1b[0m", "Please ensure you have a .env file with:");
    console.error("VITE_SUPABASE_URL=your_url");
    console.error("SUPABASE_SERVICE_ROLE_KEY=your_service_role_key");
    console.error("\x1b[36m%s\x1b[0m", "Check .env.example for the required format.");
    process.exit(1);
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  // Helper to verify admin token
  async function verifyAdmin(req: express.Request) {
    const authHeader = req.headers.authorization;
    if (!authHeader) throw new Error("Missing authorization header");

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) throw new Error("Invalid token");

    const { data: profile } = await supabaseAdmin.from('users').select('*').eq('id', user.id).single();
    if (!profile) throw new Error("Profile not found");

    const isSuperAdmin = profile.role === 'Super Admin' || user.email === 'phbktgroup@gmail.com';
    const isAdmin = profile.role === 'Admin';

    if (!isSuperAdmin && !isAdmin) throw new Error("Forbidden: Admins only");

    return { user, profile, isSuperAdmin, isAdmin };
  }

  // API Routes
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
      console.error("Error fetching users:", error);
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/admin/create-user", async (req, res) => {
    try {
      await verifyAdmin(req);
      const { email, password, name, role, business_id, created_by } = req.body;

      // 1. Create user in Supabase Auth
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name }
      });

      if (authError) throw authError;

      // 2. Create/Update profile in public.users table
      const profileData: any = {
        id: authData.user.id,
        email,
        name,
        role,
        created_by
      };

      if (business_id) {
        profileData.business_id = business_id;
      }

      const { error: profileError } = await supabaseAdmin
        .from('users')
        .upsert(profileData);

      if (profileError) throw profileError;

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
      const { isSuperAdmin } = await verifyAdmin(req);
      if (!isSuperAdmin) throw new Error("Forbidden: Only Super Admins can delete users");

      const { userId } = req.body;

      // 1. Try to delete user from Supabase Auth
      if (supabaseServiceKey) {
        const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
        if (authError) {
          console.warn(`Auth delete warning for ${userId}:`, authError.message);
        }
      } else {
        console.warn("SUPABASE_SERVICE_ROLE_KEY is missing. Cannot delete from auth.users.");
      }

      // 2. Delete profile from public.users table
      const { error: profileError } = await supabaseAdmin
        .from('users')
        .delete()
        .eq('id', userId);

      if (profileError) {
        console.error("Profile delete error:", profileError.message);
        throw profileError;
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting user:", error);
      res.status(400).json({ error: error.message });
    }
  });

  // AI Scanning Endpoint
  app.post("/api/scan", async (req, res) => {
    try {
      const { base64Data, mimeType, prompt, apiKey: clientApiKey } = req.body;
      
      // Use client-provided API key or fallback to server-side key
      const apiKey = clientApiKey || process.env.GEMINI_API_KEY;
      
      if (!apiKey) {
        return res.status(400).json({ error: "Gemini API key is missing." });
      }

      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [
          {
            parts: [
              { text: prompt },
              { inlineData: { mimeType: mimeType, data: base64Data } }
            ]
          }
        ]
      });

      if (!response.text) {
        throw new Error("AI returned an empty response.");
      }

      res.json({ text: response.text });
    } catch (error: any) {
      console.error("AI Scan failed:", error);
      res.status(500).json({ error: error.message || "An error occurred while scanning." });
    }
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
