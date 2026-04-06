import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Drawer from '../components/Drawer';
import { 
  Users, 
  UserPlus, 
  Search, 
  Shield, 
  Mail, 
  Settings, 
  MoreVertical, 
  CheckCircle2, 
  XCircle,
  Trash2,
  Edit2,
  Loader2,
  Bell,
  Send,
  X,
  LogIn,
  Key,
  Save,
  RefreshCw,
  Download,
  Upload
} from 'lucide-react';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ConfirmModal } from '../components/ConfirmModal';
import PageHeader from '../components/PageHeader';
import { getApiUrl } from '../lib/api';
import toast from 'react-hot-toast';
import { APP_VERSION } from '../constants/app';

interface AppUser {
  id: string;
  email: string;
  name: string;
  role: string;
  is_active: boolean;
  created_by: string;
  created_at: string;
  business_profiles?: { name: string };
}

const UserNode = ({ user, depth = 0, onEdit, onDelete, onToggleStatus, onImpersonate, onEditApiKey, isSuperAdmin, isAdmin }: { 
  user: any, 
  depth?: number, 
  onEdit: (user: any) => void, 
  onDelete: (id: string) => void,
  onToggleStatus: (user: any) => void,
  onImpersonate: (user: any) => void,
  onEditApiKey?: (user: any) => void,
  isSuperAdmin?: boolean,
  isAdmin?: boolean,
  key?: any
}) => {
  const hasChildren = user.children && user.children.length > 0;
  
  const isActive = user.is_active !== false;
  
  return (
    <div className={cn("space-y-2", depth > 0 && "pl-4 md:pl-6 border-l-2 border-slate-200 ml-3 md:ml-4 mt-2")}>
      <div className={cn(
        "glass-card p-2.5 flex flex-wrap items-center justify-between transition-all hover:shadow-md gap-2",
        !isActive && "opacity-60 grayscale",
        user.role === 'Super Admin' ? "bg-slate-900 text-white" : 
        user.role === 'Admin' ? "border-l-4 border-primary bg-white" : "bg-slate-50/80"
      )}>
        <div className="flex items-center">
          <div className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center font-bold mr-2.5 text-xs",
            user.role === 'Super Admin' ? "bg-white/10" : 
            user.role === 'Admin' ? "bg-primary/10 text-primary" : "bg-slate-200 text-slate-600"
          )}>
            {user.name?.charAt(0) || user.email.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <p className={cn("text-xs font-bold", user.role === 'Super Admin' ? "text-white" : "text-slate-900")}>
                {user.name || 'N/A'}
              </p>
              {!isActive && (
                <span className="text-[8px] bg-red-100 text-red-600 px-1 py-0.5 rounded font-bold uppercase">Disabled</span>
              )}
            </div>
            <p className={cn("text-[10px]", user.role === 'Super Admin' ? "text-slate-400" : "text-slate-500")}>
              {user.email}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <span className={cn(
            "text-[9px] font-bold uppercase px-1.5 py-0.5 rounded",
            user.role === 'Super Admin' ? "bg-white/10 text-white" : 
            user.role === 'Admin' ? "bg-primary/10 text-primary" : "bg-slate-200 text-slate-600"
          )}>
            {user.role}
          </span>
          <div className="flex items-center space-x-0.5">
            {(isSuperAdmin || isAdmin) && (
              <button 
                onClick={() => onImpersonate(user)}
                title="Load User Profile"
                className={cn("p-1 rounded-lg transition-all", user.role === 'Super Admin' ? "text-slate-400 hover:text-white hover:bg-white/10" : "text-slate-400 hover:text-emerald-500 hover:bg-emerald-50")}
              >
                <LogIn size={14} />
              </button>
            )}
            <button 
              onClick={() => onToggleStatus(user)}
              title={isActive ? "Disable User" : "Enable User"}
              className={cn(
                "p-1 rounded-lg transition-all", 
                user.role === 'Super Admin' ? "text-slate-400 hover:text-white hover:bg-white/10" : 
                isActive ? "text-slate-400 hover:text-amber-500 hover:bg-amber-50" : "text-slate-400 hover:text-emerald-500 hover:bg-emerald-50"
              )}
            >
              {isActive ? <XCircle size={14} /> : <CheckCircle2 size={14} />}
            </button>
            <button 
              onClick={() => onEdit(user)}
              className={cn("p-1 rounded-lg transition-all", user.role === 'Super Admin' ? "text-slate-400 hover:text-white hover:bg-white/10" : "text-slate-400 hover:text-primary hover:bg-primary/5")}
              title="Edit User"
            >
              <Edit2 size={14} />
            </button>
            {(isSuperAdmin || isAdmin) && onEditApiKey && (
              <button 
                onClick={() => onEditApiKey(user)}
                className={cn("p-1 rounded-lg transition-all", user.role === 'Super Admin' ? "text-slate-400 hover:text-white hover:bg-white/10" : "text-slate-400 hover:text-amber-500 hover:bg-amber-50")}
                title="Edit API Key"
              >
                <Key size={14} />
              </button>
            )}
            {(isSuperAdmin || isAdmin) && (
              <button 
                onClick={() => onDelete(user.id)}
                disabled={!isSuperAdmin && (user.role === 'Admin' || user.role === 'Super Admin')}
                className={cn("p-1 rounded-lg transition-all", 
                  (user.role === 'Super Admin' || (!isSuperAdmin && user.role === 'Admin')) 
                    ? "text-slate-200 cursor-not-allowed" 
                    : "text-slate-400 hover:text-red-500 hover:bg-red-50"
                )}
                title={(!isSuperAdmin && (user.role === 'Admin' || user.role === 'Super Admin')) ? "Cannot delete this user" : "Delete User"}
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
      {hasChildren && (
        <div className="space-y-2">
          {user.children.map((child: any) => (
            <UserNode 
              key={child.id} 
              user={child} 
              depth={depth + 1} 
              onEdit={onEdit} 
              onDelete={onDelete} 
              onToggleStatus={onToggleStatus} 
              onImpersonate={onImpersonate}
              onEditApiKey={onEditApiKey}
              isSuperAdmin={isSuperAdmin} 
              isAdmin={isAdmin}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default function AdminPanel() {
  const navigate = useNavigate();
  const { user: currentUser, profile: currentProfile, impersonate, originalProfile, appSettings, refreshAppSettings } = useAuth();
  const [activeTab, setActiveTab] = useState<'users' | 'notifications' | 'settings' | 'updates'>('users');
  const [users, setUsers] = useState<AppUser[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddUser, setShowAddUser] = useState(false);
  const [showAddNotification, setShowAddNotification] = useState(false);
  const [selectedUserForNotification, setSelectedUserForNotification] = useState('all');
  const [notificationTitle, setNotificationTitle] = useState('');
  const [notificationMessage, setNotificationMessage] = useState('');
  const [editingUser, setEditingUser] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState(0);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [deleteNotificationModalOpen, setDeleteNotificationModalOpen] = useState(false);
  const [notificationToDelete, setNotificationToDelete] = useState<string | null>(null);
  const [impersonateModalOpen, setImpersonateModalOpen] = useState(false);
  const [userToImpersonate, setUserToImpersonate] = useState<any | null>(null);
  const [editingApiKeyUser, setEditingApiKeyUser] = useState<any>(null);
  const [newApiKey, setNewApiKey] = useState('');
  const [isSavingApiKey, setIsSavingApiKey] = useState(false);
  const [isLoadingApiKey, setIsLoadingApiKey] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [newAppName, setNewAppName] = useState('');
  const [latestVersion, setLatestVersion] = useState('');
  const [apkUrl, setApkUrl] = useState('');
  const [exeUrl, setExeUrl] = useState('');
  const [isUploadingApk, setIsUploadingApk] = useState(false);
  const [isUploadingExe, setIsUploadingExe] = useState(false);
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    password: '',
    role: 'Business User'
  });
  const [notificationStatus, setNotificationStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  const [apiHealth, setApiHealth] = useState<{ status: string, message?: string } | null>(null);

  const checkApiHealth = async () => {
    try {
      const response = await fetch(getApiUrl('/api/health'));
      const data = await response.json();
      setApiHealth(data);
    } catch (err: any) {
      console.error('API Health Check failed:', err);
      setApiHealth({ status: 'error', message: err.message || 'Failed to fetch health check' });
    }
  };

  const businessId = currentProfile?.business_id;

  const effectiveProfile = originalProfile || currentProfile;
  const isSuperAdmin = effectiveProfile?.role === 'Super Admin' || effectiveProfile?.is_super_admin;
  const isAdmin = effectiveProfile?.role === 'Admin';

  // Role options based on current user's role
  const getRoleOptions = () => {
    if (isSuperAdmin) {
      return ['Super Admin', 'Admin', 'Business User'];
    }
    if (isAdmin) {
      return ['Business User'];
    }
    return [];
  };

  useEffect(() => {
    if (currentUser) {
      if (activeTab === 'users') {
        fetchUsers();
      } else if (activeTab === 'notifications') {
        fetchNotifications();
      }
    }
  }, [currentUser?.id, businessId, isSuperAdmin, activeTab]);

  useEffect(() => {
    if (activeTab === 'updates') {
      fetchUpdateConfig();
    }
  }, [activeTab]);

  const fetchUpdateConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('latest_version, apk_url, exe_url')
        .eq('id', 'global')
        .maybeSingle();
      
      if (error) throw error;
      
      if (data) {
        setLatestVersion(data.latest_version || '');
        setApkUrl(data.apk_url || '');
        setExeUrl(data.exe_url || '');
      } else {
        // Create the global settings row if it doesn't exist
        await supabase.from('app_settings').upsert({ id: 'global', app_name: 'PHBKT Group Suite' });
      }
    } catch (err) {
      console.error('Error fetching update config:', err);
    }
  };

  const handleUpdateVersion = async () => {
    if (!latestVersion) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('app_settings')
        .update({ 
          latest_version: latestVersion,
          updated_at: new Date().toISOString()
        })
        .eq('id', 'global');
      
      if (error) throw error;
      toast.success('Latest version updated');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteOldFile = async (url: string) => {
    if (!url) return;
    try {
      const urlParts = url.split('/global-logos/');
      if (urlParts.length > 1) {
        let filePath = urlParts[1];
        // Strip query parameters if any (e.g. ?token=...)
        filePath = filePath.split('?')[0];
        // Decode URL encoded characters (e.g. %20 to space)
        filePath = decodeURIComponent(filePath);
        
        const { error } = await supabase.storage
          .from('global-logos')
          .remove([filePath]);
        if (error) console.error('Error deleting old file:', error);
      }
    } catch (err) {
      console.error('Error in deleteOldFile:', err);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'apk' | 'exe') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isApk = type === 'apk';
    if (isApk) setIsUploadingApk(true);
    else setIsUploadingExe(true);

    try {
      const oldUrl = isApk ? apkUrl : exeUrl;
      if (oldUrl) {
        await deleteOldFile(oldUrl);
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${type}_${Date.now()}.${fileExt}`;
      const filePath = `updates/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('global-logos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('global-logos')
        .getPublicUrl(filePath);

      if (isApk) {
        setApkUrl(publicUrl);
        const { error: updateError } = await supabase.from('app_settings').update({ apk_url: publicUrl }).eq('id', 'global');
        if (updateError) throw updateError;
      } else {
        setExeUrl(publicUrl);
        const { error: updateError } = await supabase.from('app_settings').update({ exe_url: publicUrl }).eq('id', 'global');
        if (updateError) throw updateError;
      }
      
      toast.success(`${type.toUpperCase()} uploaded successfully`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      if (isApk) setIsUploadingApk(false);
      else setIsUploadingExe(false);
    }
  };

  const handleDeleteFile = async (type: 'apk' | 'exe') => {
    const isApk = type === 'apk';
    const url = isApk ? apkUrl : exeUrl;
    if (!url) return;

    try {
      await deleteOldFile(url);
      
      if (isApk) {
        setApkUrl('');
        const { error: updateError } = await supabase.from('app_settings').update({ apk_url: null }).eq('id', 'global');
        if (updateError) throw updateError;
      } else {
        setExeUrl('');
        const { error: updateError } = await supabase.from('app_settings').update({ exe_url: null }).eq('id', 'global');
        if (updateError) throw updateError;
      }
      
      toast.success(`${type.toUpperCase()} file deleted`);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      let query = supabase.from('notifications').select('*, sender:users(name)');
      if (!isSuperAdmin) {
        query = query.eq('created_by', currentUser?.id);
      }
      const { data, error } = await query.order('created_at', { ascending: false }).limit(100);
      if (error) throw error;
      setNotifications(data || []);
    } catch (error: any) {
      console.error('Error fetching notifications:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNotification = async () => {
    if (!notificationTitle || !notificationMessage) return;
    setIsSubmitting(true);
    setNotificationStatus(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No active session");

      const response = await fetch(getApiUrl('/api/admin/send-user-notification'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ 
          title: notificationTitle, 
          message: notificationMessage, 
          userId: selectedUserForNotification 
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to send notification');

      setNotificationTitle('');
      setNotificationMessage('');
      setShowAddNotification(false);
      setNotificationStatus({ type: 'success', message: 'Notification sent successfully!' });
      fetchNotifications();
    } catch (err: any) {
      console.error('Error sending notification:', err);
      setNotificationStatus({ 
        type: 'error', 
        message: err.message || 'Failed to send notification.' 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteNotification = async () => {
    if (!notificationToDelete) return;

    setIsDeleting(true);
    setDeleteProgress(10);
    
    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setDeleteProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 150);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No active session");

      const response = await fetch(getApiUrl('/api/admin/delete-notification'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ id: notificationToDelete }),
      });

      const result = await response.json();
      
      clearInterval(progressInterval);
      setDeleteProgress(100);

      if (!response.ok) throw new Error(result.error || 'Failed to delete notification');

      // Small delay to show 100% progress
      await new Promise(resolve => setTimeout(resolve, 400));

      setDeleteNotificationModalOpen(false);
      setNotificationToDelete(null);
      fetchNotifications();
    } catch (err: any) {
      console.error("Error in handleDeleteNotification:", err);
      alert(err.message || 'Failed to delete notification');
    } finally {
      setIsDeleting(false);
      setDeleteProgress(0);
    }
  };

  const confirmDeleteNotification = (id: string) => {
    setNotificationToDelete(id);
    setDeleteNotificationModalOpen(true);
  };

  const fetchUsers = async () => {
    if (!currentUser?.id) return;
    setLoading(true);
    setError(null);
    
    try {
      let query = supabase.from('users').select('*, business_profiles(name)');

      const { data, error: fetchError } = await query.order('created_at', { ascending: false }).limit(500);

      if (fetchError) {
        throw fetchError;
      }

      setUsers(data || []);
    } catch (error: any) {
      console.error('Error fetching users:', error);
      setError(error.message || 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const handleEditApiKey = async (user: any) => {
    setEditingApiKeyUser(user);
    setNewApiKey('');
    setIsLoadingApiKey(true);
    // Fetch current API key
    try {
      const { data, error } = await supabase
        .from('business_profiles')
        .select('gemini_api_key')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (data && data.gemini_api_key) {
        setNewApiKey(data.gemini_api_key);
      }
    } catch (err) {
      console.error('Error fetching API key:', err);
    } finally {
      setIsLoadingApiKey(false);
    }
  };

  const handleSaveApiKey = async () => {
    if (!editingApiKeyUser) return;
    setIsSavingApiKey(true);
    try {
      // Check if business profile exists
      const { data: existingProfile } = await supabase
        .from('business_profiles')
        .select('id')
        .eq('user_id', editingApiKeyUser.id)
        .maybeSingle();

      if (existingProfile) {
        const { error } = await supabase
          .from('business_profiles')
          .update({ gemini_api_key: newApiKey })
          .eq('user_id', editingApiKeyUser.id);
        if (error) throw error;
      } else {
        // Create a basic business profile if it doesn't exist
        const { error } = await supabase
          .from('business_profiles')
          .insert({
            user_id: editingApiKeyUser.id,
            name: `${editingApiKeyUser.name || 'User'}'s Business`,
            gemini_api_key: newApiKey
          });
        if (error) throw error;
      }
      
      alert('API Key updated successfully!');
      setEditingApiKeyUser(null);
    } catch (err: any) {
      alert(err.message || 'Failed to update API key');
    } finally {
      setIsSavingApiKey(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessId && !isSuperAdmin) return;
    setIsSubmitting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No active session");
      
      const response = await fetch(getApiUrl('/api/admin/create-user'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          ...newUser,
          email: newUser.email.trim().toLowerCase(),
          created_by: currentUser?.id
          // We intentionally do not pass business_id here so that the new user 
          // is forced to complete the Business Setup page upon their first login.
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create user');
      }

      setShowAddUser(false);
      setNewUser({ name: '', email: '', password: '', role: 'Business User' });
      fetchUsers();
      alert('User created successfully!');
    } catch (err: any) {
      alert(err.message || 'Failed to create user');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setIsSubmitting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No active session");
      
      const response = await fetch(getApiUrl('/api/admin/update-user'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          userId: editingUser.id,
          name: editingUser.name,
          role: editingUser.role
        })
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to update user');

      setEditingUser(null);
      fetchUsers();
      alert('User updated successfully!');
    } catch (err: any) {
      alert(err.message || 'Failed to update user');
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = (id: string) => {
    if (!isSuperAdmin && !isAdmin) {
      alert("Only Admins can delete users.");
      return;
    }

    if (id === currentUser?.id) {
      alert("You cannot delete your own account.");
      return;
    }

    setUserToDelete(id);
    setDeleteModalOpen(true);
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    setIsDeleting(true);
    setDeleteProgress(10);

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setDeleteProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No active session");

      const response = await fetch(getApiUrl('/api/admin/delete-user'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ userId: userToDelete }),
      });

      const result = await response.json();
      
      clearInterval(progressInterval);
      setDeleteProgress(100);

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete user');
      }

      // Small delay to show 100% progress
      await new Promise(resolve => setTimeout(resolve, 500));

      fetchUsers();
      setDeleteModalOpen(false);
      setUserToDelete(null);
      // alert('User deleted successfully!'); // Removing alert as we have visual feedback now
    } catch (err: any) {
      alert(err.message || 'Failed to delete user');
    } finally {
      setIsDeleting(false);
      setDeleteProgress(0);
    }
  };

  const handleToggleUserStatus = async (user: any) => {
    if (user.id === currentUser?.id) {
      alert("You cannot disable your own account.");
      return;
    }

    const isActive = user.is_active !== false;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No active session");

      const response = await fetch(getApiUrl('/api/admin/toggle-status'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          userId: user.id,
          isActive: !isActive
        })
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to update user status');

      fetchUsers();
      alert(`User ${isActive ? 'disabled' : 'enabled'} successfully!`);
    } catch (err: any) {
      alert(err.message || 'Failed to update user status');
    }
  };

  const handleImpersonate = async (user: any) => {
    setUserToImpersonate(user);
    setImpersonateModalOpen(true);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isSuperAdmin) {
      alert("Only Super Admins can update the global logo.");
      return;
    }

    setIsUploadingLogo(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `app-logo-${Date.now()}.${fileExt}`;
      const filePath = fileName;

      const { error: uploadError } = await supabase.storage
        .from('global-logos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('global-logos')
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('app_settings')
        .upsert({ 
          id: 'global', 
          logo_url: publicUrl,
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' });

      if (updateError) throw updateError;

      await refreshAppSettings();
      alert('Global logo updated successfully!');
    } catch (err: any) {
      console.error('Error uploading logo:', err);
      alert(err.message || 'Failed to upload logo');
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuperAdmin) return;
    
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('app_settings')
        .upsert({ 
          id: 'global', 
          app_name: newAppName,
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' });

      if (error) throw error;

      await refreshAppSettings();
      alert('App settings updated successfully!');
    } catch (err: any) {
      console.error('Error updating settings:', err);
      alert(err.message || 'Failed to update settings');
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmImpersonate = async () => {
    if (!userToImpersonate) return;
    await impersonate(userToImpersonate);
    navigate('/');
  };

  // Group users by hierarchy
  const getHierarchy = () => {
    const buildTree = (parentId: string | null): any[] => {
      return users
        .filter(u => u.created_by === parentId)
        .map(u => ({
          ...u,
          children: buildTree(u.id)
        }));
    };

    // Roots are users whose creator is not in our current list of fetched users
    const roots = users.filter(u => {
      if (!u.created_by) return true;
      return !users.some(creator => creator.id === u.created_by);
    });

    return roots.map(u => ({
      ...u,
      children: buildTree(u.id)
    }));
  };

  const hierarchy = getHierarchy();

  return (
    <div className="space-y-4">
      <PageHeader 
        title="Admin Control Panel" 
        description="Manage user access, monitor system activity, and configure global application settings."
      >
        <div className="flex items-center space-x-2">
          {isSuperAdmin && activeTab === 'notifications' && (
            <button 
              onClick={() => setShowAddNotification(true)}
              className="px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-bold flex items-center hover:bg-primary/90 transition-all"
            >
              <Bell size={14} className="mr-1.5" />
              Send Notification
            </button>
          )}
          {activeTab === 'users' && (
            <button 
              onClick={() => setShowAddUser(true)}
              className="btn-primary"
            >
              <UserPlus size={14} className="mr-1.5" />
              Create New User
            </button>
          )}
        </div>
      </PageHeader>

      {/* API Health Check (Debug) */}
      {isSuperAdmin && (
        <div className="glass-card p-4 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center space-x-2">
            <Shield size={16} className="text-slate-400" />
            <span className="text-xs font-bold text-slate-700">Backend API Status:</span>
            {apiHealth ? (
              <span className={cn(
                "text-[10px] px-1.5 py-0.5 rounded font-bold uppercase",
                apiHealth.status === 'ok' ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600"
              )}>
                {apiHealth.status === 'ok' ? 'Connected' : 'Error'}
              </span>
            ) : (
              <span className="text-[10px] text-slate-400 italic">Not checked</span>
            )}
          </div>
          <button 
            onClick={checkApiHealth}
            className="text-[10px] font-bold text-primary hover:underline"
          >
            Check Connection
          </button>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl w-full md:w-fit overflow-x-auto no-scrollbar">
        <button 
          onClick={() => setActiveTab('users')}
          className={cn(
            "px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-2 whitespace-nowrap",
            activeTab === 'users' ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700"
          )}
        >
          <Users size={14} />
          <span>Users</span>
        </button>
        <button 
          onClick={() => setActiveTab('notifications')}
          className={cn(
            "px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-2 whitespace-nowrap",
            activeTab === 'notifications' ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700"
          )}
        >
          <Bell size={14} />
          <span>Notifications</span>
        </button>
        {isSuperAdmin && (
          <button 
            onClick={() => setActiveTab('updates')}
            className={cn(
              "px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-2 whitespace-nowrap",
              activeTab === 'updates' ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            <RefreshCw size={14} />
            <span>App Updates</span>
          </button>
        )}
        {isSuperAdmin && (
          <button 
            onClick={() => setActiveTab('settings')}
            className={cn(
              "px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-2 whitespace-nowrap",
              activeTab === 'settings' ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            <Settings size={14} />
            <span>Settings</span>
          </button>
        )}
      </div>

      {/* User Management Hierarchy */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          {loading ? (
            <div className="glass-card p-8 text-center">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary mb-2" />
              <p className="text-slate-500 text-xs">Loading hierarchy...</p>
            </div>
          ) : error ? (
            <div className="glass-card p-8 text-center text-red-500">
              <p className="font-bold text-sm mb-1">Error loading users</p>
              <p className="text-xs">{error}</p>
              <button 
                onClick={() => fetchUsers()}
                className="mt-3 text-primary hover:underline text-xs font-bold"
              >
                Try Again
              </button>
            </div>
          ) : hierarchy.length === 0 ? (
            <div className="glass-card p-8 text-center text-slate-500 text-xs">
              No users found.
            </div>
          ) : (
            hierarchy.map((node: any) => (
              <UserNode 
                key={node.id} 
                user={node} 
                onEdit={(u) => setEditingUser(u)}
                onDelete={(id) => confirmDelete(id)}
                onToggleStatus={(u) => handleToggleUserStatus(u)}
                onImpersonate={(u) => handleImpersonate(u)}
                onEditApiKey={handleEditApiKey}
                isSuperAdmin={isSuperAdmin}
                isAdmin={isAdmin}
              />
            ))
          )}
        </div>
      )}

      {/* App Updates Management */}
      {activeTab === 'updates' && isSuperAdmin && (
        <div className="space-y-6">
          <div className="glass-card p-6">
            <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center">
              <RefreshCw size={16} className="mr-2 text-primary" />
              Manage Application Updates
            </h3>
            
            <div className="space-y-8">
              {/* Version Management */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Latest Version Number</label>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={latestVersion}
                        onChange={(e) => setLatestVersion(e.target.value)}
                        placeholder="e.g., 1.0.1"
                        className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-primary outline-none text-xs transition-all"
                      />
                      <button 
                        onClick={handleUpdateVersion}
                        disabled={isSubmitting}
                        className="btn-primary px-4 py-2 text-[10px] flex items-center whitespace-nowrap"
                      >
                        {isSubmitting ? <Loader2 size={12} className="animate-spin mr-1.5" /> : <CheckCircle2 size={12} className="mr-1.5" />}
                        Set Version
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-400">Current version in app: <span className="font-bold text-slate-600">{APP_VERSION}</span></p>
                  </div>
                </div>

                <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
                  <h4 className="text-[11px] font-bold text-blue-900 mb-1 flex items-center">
                    <Shield size={12} className="mr-1.5" />
                    How Updates Work
                  </h4>
                  <p className="text-[10px] text-blue-700 leading-relaxed">
                    When you set a <span className="font-bold">Latest Version</span> that is different from the version in the user's app, they will see a small popup to update. 
                    Android users will download the APK, and Desktop users will download the EXE.
                  </p>
                </div>
              </div>

              <hr className="border-slate-100" />

              {/* File Uploads */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* APK Upload */}
                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center">
                    <Download size={12} className="mr-1.5" />
                    Android Update (APK)
                  </label>
                  <div className="p-4 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50 text-center space-y-3">
                    {apkUrl ? (
                      <div className="space-y-2">
                        <div className="p-2 bg-green-50 text-green-700 rounded-lg text-[10px] font-medium break-all border border-green-100">
                          {apkUrl}
                        </div>
                        <button 
                          onClick={() => handleDeleteFile('apk')}
                          className="text-[10px] text-red-500 font-bold hover:underline flex items-center justify-center mx-auto"
                        >
                          <Trash2 size={12} className="mr-1.5" />
                          Delete APK File
                        </button>
                      </div>
                    ) : (
                      <div className="py-4">
                        <Upload size={24} className="mx-auto text-slate-300 mb-2" />
                        <p className="text-[10px] text-slate-500 mb-3">Upload new APK file</p>
                        <label className="inline-flex items-center px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-bold text-slate-700 hover:bg-slate-50 cursor-pointer transition-all shadow-sm">
                          {isUploadingApk ? <Loader2 size={12} className="animate-spin mr-2" /> : <Upload size={12} className="mr-2" />}
                          Choose APK
                          <input 
                            type="file" 
                            className="hidden" 
                            accept=".apk"
                            onChange={(e) => handleFileUpload(e, 'apk')}
                            disabled={isUploadingApk}
                          />
                        </label>
                      </div>
                    )}
                  </div>
                </div>

                {/* EXE Upload */}
                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center">
                    <Download size={12} className="mr-1.5" />
                    Desktop Update (EXE)
                  </label>
                  <div className="p-4 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50 text-center space-y-3">
                    {exeUrl ? (
                      <div className="space-y-2">
                        <div className="p-2 bg-blue-50 text-blue-700 rounded-lg text-[10px] font-medium break-all border border-blue-100">
                          {exeUrl}
                        </div>
                        <button 
                          onClick={() => handleDeleteFile('exe')}
                          className="text-[10px] text-red-500 font-bold hover:underline flex items-center justify-center mx-auto"
                        >
                          <Trash2 size={12} className="mr-1.5" />
                          Delete EXE File
                        </button>
                      </div>
                    ) : (
                      <div className="py-4">
                        <Upload size={24} className="mx-auto text-slate-300 mb-2" />
                        <p className="text-[10px] text-slate-500 mb-3">Upload new EXE file</p>
                        <label className="inline-flex items-center px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-bold text-slate-700 hover:bg-slate-50 cursor-pointer transition-all shadow-sm">
                          {isUploadingExe ? <Loader2 size={12} className="animate-spin mr-2" /> : <Upload size={12} className="mr-2" />}
                          Choose EXE
                          <input 
                            type="file" 
                            className="hidden" 
                            accept=".exe"
                            onChange={(e) => handleFileUpload(e, 'exe')}
                            disabled={isUploadingExe}
                          />
                        </label>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                {/* Auto-saved on upload */}
              </div>
            </div>
          </div>
        </div>
      )}
      {activeTab === 'settings' && isSuperAdmin && (
        <div className="space-y-6">
          <div className="glass-card p-6">
            <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center">
              <Settings size={16} className="mr-2 text-primary" />
              Global Application Settings
            </h3>
            
            <div className="space-y-6">
              {/* Logo Management */}
              <div className="space-y-3">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Global Logo</label>
                <div className="flex items-start space-x-4">
                  <div className="w-24 h-24 bg-slate-100 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden shrink-0 relative group">
                    {appSettings?.logo_url ? (
                      <img 
                        src={appSettings.logo_url} 
                        alt="App Logo" 
                        className="w-full h-full object-contain p-2"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <Shield size={32} className="text-slate-300" />
                    )}
                    {isUploadingLogo && (
                      <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                        <Loader2 size={20} className="animate-spin text-primary" />
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <p className="text-[11px] text-slate-500">
                      This logo will be displayed on the login page and in the sidebar.
                      Recommended size: 200x200px. Max size: 2MB.
                    </p>
                    <label className="inline-flex items-center px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700 hover:bg-slate-50 cursor-pointer transition-all">
                      <Edit2 size={12} className="mr-1.5" />
                      {appSettings?.logo_url ? 'Change Logo' : 'Upload Logo'}
                      <input 
                        type="file" 
                        className="hidden" 
                        accept="image/*"
                        onChange={handleLogoUpload}
                        disabled={isUploadingLogo}
                      />
                    </label>
                  </div>
                </div>
              </div>

              <hr className="border-slate-100" />

              {/* App Name Management */}
              <form onSubmit={handleUpdateSettings} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Application Name</label>
                  <input 
                    type="text" 
                    value={newAppName}
                    onChange={(e) => setNewAppName(e.target.value)}
                    placeholder="Enter application name"
                    className="w-full max-w-md px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-primary outline-none text-xs transition-all"
                  />
                </div>
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-primary px-6 py-2 text-xs flex items-center"
                >
                  {isSubmitting ? (
                    <Loader2 size={14} className="animate-spin mr-2" />
                  ) : (
                    <CheckCircle2 size={14} className="mr-2" />
                  )}
                  Save Settings
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Notifications Management */}
      {activeTab === 'notifications' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Sent Notifications</h3>
            <button 
              onClick={() => setShowAddNotification(true)}
              className="btn-primary px-4 py-2 text-xs"
            >
              Send New Notification
            </button>
          </div>
          {loading ? (
            <div className="glass-card p-8 text-center">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary mb-2" />
              <p className="text-slate-500 text-xs">Loading notifications...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="glass-card p-8 text-center text-slate-500 text-xs">
              No notifications sent yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {notifications.map((notif) => (
                <div key={notif.id} className="glass-card p-4 flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 bg-primary/10 text-primary rounded-lg flex items-center justify-center shrink-0">
                      <Bell size={16} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-slate-900">{notif.title}</h4>
                        <span className={cn(
                          "text-[8px] px-1.5 py-0.5 rounded font-bold uppercase",
                          notif.type === 'global' ? "bg-purple-100 text-purple-600" : "bg-blue-100 text-blue-600"
                        )}>
                          {notif.type}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-0.5 break-words">
                        {notif.message.split(/(https?:\/\/[^\s]+)/g).map((part: string, i: number) => {
                          if (part.match(/https?:\/\/[^\s]+/)) {
                            return (
                              <a 
                                key={i} 
                                href={part} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="text-primary hover:underline font-medium"
                              >
                                {part}
                              </a>
                            );
                          }
                          return part;
                        })}
                      </p>
                      <div className="flex items-center space-x-2 mt-2">
                        <p className="text-[9px] text-slate-400">
                          {new Date(notif.created_at).toLocaleString()}
                        </p>
                        {notif.sender?.name && (
                          <>
                            <span className="text-[9px] text-slate-300">•</span>
                            <p className="text-[9px] font-medium text-primary/70">
                              By {notif.sender.name}
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={() => confirmDeleteNotification(notif.id)}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <Drawer
        isOpen={showAddUser}
        onClose={() => setShowAddUser(false)}
        title="Create New User"
        maxWidth="max-w-2xl"
        icon={<UserPlus size={18} />}
        footer={
          <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-100 bg-slate-50/50">
            <button 
              onClick={() => setShowAddUser(false)} 
              className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg font-bold hover:bg-slate-50 transition-all text-[10px]"
            >
              Cancel
            </button>
            <button 
              onClick={handleCreateUser}
              disabled={isSubmitting}
              className="px-6 py-2 bg-primary text-white rounded-lg font-bold hover:bg-primary-dark transition-all flex items-center disabled:opacity-50 text-[10px]"
            >
              {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <UserPlus className="w-3.5 h-3.5 mr-1.5" />}
              Create User
            </button>
          </div>
        }
      >
        <div className="p-6">
          <form onSubmit={handleCreateUser} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">Full Name</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Users size={14} />
                  </div>
                  <input 
                    type="text" 
                    required
                    className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 outline-none text-xs transition-all placeholder:text-slate-400" 
                    placeholder="Jane Smith"
                    value={newUser.name}
                    onChange={e => setNewUser({...newUser, name: e.target.value})}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">Email Address</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Mail size={14} />
                  </div>
                  <input 
                    type="email" 
                    required
                    className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 outline-none text-xs transition-all placeholder:text-slate-400" 
                    placeholder="jane@phbkt.com"
                    value={newUser.email}
                    onChange={e => setNewUser({...newUser, email: e.target.value})}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Key size={14} />
                  </div>
                  <input 
                    type="password" 
                    required
                    minLength={6}
                    className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 outline-none text-xs transition-all placeholder:text-slate-400" 
                    placeholder="••••••••"
                    value={newUser.password}
                    onChange={e => setNewUser({...newUser, password: e.target.value})}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">Role</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Shield size={14} />
                  </div>
                  <select 
                    className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 outline-none text-xs transition-all appearance-none"
                    value={newUser.role}
                    onChange={e => setNewUser({...newUser, role: e.target.value})}
                  >
                    {getRoleOptions().map(role => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                    <MoreVertical size={14} className="rotate-90" />
                  </div>
                </div>
              </div>
            </div>
          </form>
        </div>
      </Drawer>

      <Drawer
        isOpen={!!editingUser}
        onClose={() => setEditingUser(null)}
        title="Edit User"
        maxWidth="max-w-2xl"
        icon={<Edit2 size={18} />}
        footer={
          <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-100 bg-slate-50/50">
            <button 
              onClick={() => setEditingUser(null)} 
              className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg font-bold hover:bg-slate-50 transition-all text-[10px]"
            >
              Cancel
            </button>
            <button 
              onClick={handleUpdateUser}
              disabled={isSubmitting}
              className="px-6 py-2 bg-primary text-white rounded-lg font-bold hover:bg-primary-dark transition-all flex items-center disabled:opacity-50 text-[10px]"
            >
              {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
              Save Changes
            </button>
          </div>
        }
      >
        {editingUser && (
          <div className="p-6">
            <form onSubmit={handleUpdateUser} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">Full Name</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Users size={14} />
                    </div>
                    <input 
                      type="text" 
                      required
                      className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 outline-none text-xs transition-all placeholder:text-slate-400" 
                      value={editingUser.name}
                      onChange={e => setEditingUser({...editingUser, name: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">Email Address</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Mail size={14} />
                    </div>
                    <input 
                      type="email" 
                      disabled
                      className="w-full pl-10 pr-3 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-500 cursor-not-allowed" 
                      value={editingUser.email}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">Role</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Shield size={14} />
                    </div>
                    <select 
                      className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 outline-none text-xs transition-all appearance-none"
                      value={editingUser.role}
                      onChange={e => setEditingUser({...editingUser, role: e.target.value})}
                    >
                      {getRoleOptions().map(role => (
                        <option key={role} value={role}>{role}</option>
                      ))}
                    </select>
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                      <MoreVertical size={14} className="rotate-90" />
                    </div>
                  </div>
                </div>
              </div>
            </form>
          </div>
        )}
      </Drawer>

      {/* Add Notification Modal */}
      <Drawer
        isOpen={showAddNotification}
        onClose={() => {
          setShowAddNotification(false);
          setNotificationStatus(null);
        }}
        title="Send Notification"
        maxWidth="max-w-lg"
        icon={<Bell size={18} />}
        footer={
          <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-100 bg-slate-50/50">
            <button 
              onClick={() => {
                setShowAddNotification(false);
                setNotificationStatus(null);
              }} 
              className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg font-bold hover:bg-slate-50 transition-all text-[10px]"
            >
              Cancel
            </button>
            <button 
              onClick={handleCreateNotification}
              disabled={isSubmitting}
              className="px-6 py-2 bg-primary text-white rounded-lg font-bold hover:bg-primary-dark transition-all flex items-center disabled:opacity-50 text-[10px]"
            >
              {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Send className="w-3.5 h-3.5 mr-1.5" />}
              Send Notification
            </button>
          </div>
        }
      >
        <div className="p-6">
          <div className="space-y-6">
            {notificationStatus && (
              <div className={cn(
                "p-3 rounded-lg flex items-center space-x-2 text-[11px] font-medium",
                notificationStatus.type === 'success' ? "bg-green-50 text-green-700 border border-green-100" : "bg-red-50 text-red-700 border border-red-100"
              )}>
                {notificationStatus.type === 'success' ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                <span>{notificationStatus.message}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">Select Recipient</label>
                <div className="relative">
                  <select 
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 outline-none text-xs transition-all appearance-none"
                    onChange={(e) => setSelectedUserForNotification(e.target.value)}
                    value={selectedUserForNotification}
                  >
                    <option value="all">{isSuperAdmin ? "All System Users" : "All My Users"}</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.name || u.email} ({u.role})</option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                    <MoreVertical size={14} className="rotate-90" />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">Notification Title</label>
                <input 
                  type="text" 
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 outline-none text-xs transition-all placeholder:text-slate-400"
                  value={notificationTitle}
                  onChange={e => setNotificationTitle(e.target.value)}
                  placeholder="e.g., System Update"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">Message Content</label>
              <textarea 
                rows={6}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 outline-none text-xs transition-all placeholder:text-slate-400 resize-none"
                value={notificationMessage}
                onChange={e => setNotificationMessage(e.target.value)}
                placeholder="Type your notification message here..."
              />
            </div>
          </div>
        </div>
      </Drawer>

      {/* Edit API Key Modal */}
      <Drawer
        isOpen={!!editingApiKeyUser}
        onClose={() => setEditingApiKeyUser(null)}
        title="Edit API Key"
        icon={<Key size={18} />}
        footer={
          <>
            <button 
              onClick={() => setEditingApiKeyUser(null)} 
              className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg font-bold hover:bg-slate-50 transition-all text-[10px]"
            >
              Cancel
            </button>
            <button 
              onClick={handleSaveApiKey}
              disabled={isSavingApiKey || isLoadingApiKey}
              className="px-6 py-2 bg-primary text-white rounded-lg font-bold hover:bg-primary-dark transition-all flex items-center disabled:opacity-50 text-[10px]"
            >
              {isSavingApiKey ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
              Save API Key
            </button>
          </>
        }
      >
        {editingApiKeyUser && (
          <div className="space-y-4">
            <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg">
              <p className="text-[10px] text-amber-700 leading-relaxed">
                Updating API Integration Key for <strong>{editingApiKeyUser.name || editingApiKeyUser.email}</strong>. This key is used for AI-powered features.
              </p>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">API Integration Key</label>
              <div className="relative">
                <input 
                  type="password" 
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-primary outline-none text-[10px] transition-all pr-10" 
                  value={newApiKey}
                  onChange={e => setNewApiKey(e.target.value)}
                  placeholder={isLoadingApiKey ? "Loading..." : "Paste Gemini API Key here"}
                  disabled={isLoadingApiKey}
                />
                {isLoadingApiKey && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </Drawer>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteModalOpen}
        title="Delete User"
        message="Are you sure you want to delete this user? This action will permanently remove them from the system."
        onConfirm={handleDeleteUser}
        isLoading={isDeleting}
        progress={deleteProgress}
        onCancel={() => {
          if (isDeleting) return;
          setDeleteModalOpen(false);
          setUserToDelete(null);
        }}
      />

      {/* Delete Notification Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteNotificationModalOpen}
        title="Delete Notification"
        message="Are you sure you want to delete this notification? This will remove it from the history."
        onConfirm={handleDeleteNotification}
        isLoading={isDeleting}
        progress={deleteProgress}
        onCancel={() => {
          if (isDeleting) return;
          setDeleteNotificationModalOpen(false);
          setNotificationToDelete(null);
        }}
      />

      {/* Impersonation Confirmation Modal */}
      <ConfirmModal
        isOpen={impersonateModalOpen}
        title="Load User Profile"
        message={`Are you sure you want to load the profile of ${userToImpersonate?.name || userToImpersonate?.email}? You will see the app exactly as they do.`}
        confirmText="Load Profile"
        confirmVariant="success"
        onConfirm={confirmImpersonate}
        onCancel={() => {
          setImpersonateModalOpen(false);
          setUserToImpersonate(null);
        }}
      />
    </div>
  );
}
