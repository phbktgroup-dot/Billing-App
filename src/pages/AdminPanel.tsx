import React, { useState, useEffect } from 'react';
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
  X
} from 'lucide-react';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ConfirmModal } from '../components/ConfirmModal';
import { getApiUrl } from '../lib/api';

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

const UserNode = ({ user, depth = 0, onEdit, onDelete, onToggleStatus, isSuperAdmin }: { 
  user: any, 
  depth?: number, 
  onEdit: (user: any) => void, 
  onDelete: (id: string) => void,
  onToggleStatus: (user: any) => void,
  isSuperAdmin?: boolean,
  key?: any
}) => {
  const hasChildren = user.children && user.children.length > 0;
  
  const isActive = user.is_active !== false;
  
  return (
    <div className={cn("space-y-3", depth > 0 && "pl-6 md:pl-10 border-l-2 border-slate-200 ml-4 md:ml-6 mt-3")}>
      <div className={cn(
        "glass-card p-4 flex items-center justify-between transition-all hover:shadow-md",
        !isActive && "opacity-60 grayscale",
        user.role === 'Super Admin' ? "bg-slate-900 text-white" : 
        user.role === 'Admin' ? "border-l-4 border-primary bg-white" : "bg-slate-50/80"
      )}>
        <div className="flex items-center">
          <div className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center font-bold mr-3",
            user.role === 'Super Admin' ? "bg-white/10" : 
            user.role === 'Admin' ? "bg-primary/10 text-primary" : "bg-slate-200 text-slate-600"
          )}>
            {user.name?.charAt(0) || user.email.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className={cn("text-sm font-bold", user.role === 'Super Admin' ? "text-white" : "text-slate-900")}>
                {user.name || 'N/A'}
              </p>
              {!isActive && (
                <span className="text-[9px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold uppercase">Disabled</span>
              )}
            </div>
            <p className={cn("text-xs", user.role === 'Super Admin' ? "text-slate-400" : "text-slate-500")}>
              {user.email}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <span className={cn(
            "text-[10px] font-bold uppercase px-2 py-1 rounded",
            user.role === 'Super Admin' ? "bg-white/10 text-white" : 
            user.role === 'Admin' ? "bg-primary/10 text-primary" : "bg-slate-200 text-slate-600"
          )}>
            {user.role}
          </span>
          <div className="flex items-center space-x-1">
            <button 
              onClick={() => onToggleStatus(user)}
              title={isActive ? "Disable User" : "Enable User"}
              className={cn(
                "p-1.5 rounded-lg transition-all", 
                user.role === 'Super Admin' ? "text-slate-400 hover:text-white hover:bg-white/10" : 
                isActive ? "text-slate-400 hover:text-amber-500 hover:bg-amber-50" : "text-slate-400 hover:text-emerald-500 hover:bg-emerald-50"
              )}
            >
              {isActive ? <XCircle size={16} /> : <CheckCircle2 size={16} />}
            </button>
            <button 
              onClick={() => onEdit(user)}
              className={cn("p-1.5 rounded-lg transition-all", user.role === 'Super Admin' ? "text-slate-400 hover:text-white hover:bg-white/10" : "text-slate-400 hover:text-primary hover:bg-primary/5")}
            >
              <Edit2 size={16} />
            </button>
            {isSuperAdmin && (
              <button 
                onClick={() => onDelete(user.id)}
                className={cn("p-1.5 rounded-lg transition-all", user.role === 'Super Admin' ? "text-slate-400 hover:text-red-400 hover:bg-red-400/10" : "text-slate-400 hover:text-red-500 hover:bg-red-50")}
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
      {hasChildren && (
        <div className="space-y-3">
          {user.children.map((child: any) => (
            <UserNode key={child.id} user={child} depth={depth + 1} onEdit={onEdit} onDelete={onDelete} onToggleStatus={onToggleStatus} isSuperAdmin={isSuperAdmin} />
          ))}
        </div>
      )}
    </div>
  );
};

export default function AdminPanel() {
  const { user: currentUser, profile: currentProfile } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddUser, setShowAddUser] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    password: '',
    role: 'Business User'
  });

  const businessId = currentProfile?.business_id;

  const isSuperAdmin = currentProfile?.role === 'Super Admin' || currentProfile?.is_super_admin;
  const isAdmin = currentProfile?.role === 'Admin';

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
      fetchUsers();
    }
  }, [currentUser?.id, businessId, isSuperAdmin]);

  const fetchUsers = async () => {
    if (!currentUser?.id) return;
    setLoading(true);
    setError(null);
    
    try {
      let query = supabase.from('users').select('*, business_profiles(name)');

      if (!isSuperAdmin) {
        if (businessId) {
          query = query.or(`id.eq.${currentUser.id},created_by.eq.${currentUser.id},business_id.eq.${businessId}`);
        } else {
          query = query.or(`id.eq.${currentUser.id},created_by.eq.${currentUser.id}`);
        }
      }

      const { data, error: fetchError } = await query.order('created_at', { ascending: false });

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
    if (!isSuperAdmin) {
      alert("Only Super Admins can delete users.");
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

    try {
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
      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete user');
      }

      fetchUsers();
      alert('User deleted successfully!');
    } catch (err: any) {
      alert(err.message || 'Failed to delete user');
    } finally {
      setUserToDelete(null);
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
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Admin Control Panel</h1>
          <p className="text-slate-500">Manage users, roles, and system-wide configurations.</p>
        </div>
        <button 
          onClick={() => setShowAddUser(true)}
          className="btn-primary flex items-center"
        >
          <UserPlus size={18} className="mr-2" />
          Create New User
        </button>
      </div>

      {/* User Management Hierarchy */}
      <div className="space-y-6">
        {loading ? (
          <div className="glass-card p-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary mb-2" />
            <p className="text-slate-500 text-sm">Loading hierarchy...</p>
          </div>
        ) : error ? (
          <div className="glass-card p-12 text-center text-red-500">
            <p className="font-bold mb-2">Error loading users</p>
            <p className="text-sm">{error}</p>
            <button 
              onClick={() => fetchUsers()}
              className="mt-4 text-primary hover:underline text-sm font-bold"
            >
              Try Again
            </button>
          </div>
        ) : hierarchy.length === 0 ? (
          <div className="glass-card p-12 text-center text-slate-500">
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
              isSuperAdmin={isSuperAdmin}
            />
          ))
        )}
      </div>

      {/* Add User Modal */}
      {showAddUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Create New User</h2>
                <p className="text-xs text-slate-500 mt-1">User will be required to set up their business profile on first login.</p>
              </div>
              <button onClick={() => setShowAddUser(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
                <X size={20} className="text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Full Name</label>
                <input 
                  type="text" 
                  required
                  className="input-field" 
                  placeholder="Jane Smith"
                  value={newUser.name}
                  onChange={e => setNewUser({...newUser, name: e.target.value})}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Email Address</label>
                <input 
                  type="email" 
                  required
                  className="input-field" 
                  placeholder="jane@phbkt.com"
                  value={newUser.email}
                  onChange={e => setNewUser({...newUser, email: e.target.value})}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Password</label>
                <input 
                  type="password" 
                  required
                  minLength={6}
                  className="input-field" 
                  placeholder="••••••••"
                  value={newUser.password}
                  onChange={e => setNewUser({...newUser, password: e.target.value})}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Role</label>
                <select 
                  className="input-field"
                  value={newUser.role}
                  onChange={e => setNewUser({...newUser, role: e.target.value})}
                >
                  {getRoleOptions().map(role => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
              </div>
              <button 
                type="submit" 
                disabled={isSubmitting}
                className="btn-primary w-full py-3 mt-4 flex items-center justify-center"
              >
                {isSubmitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  'Create User'
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Edit User</h2>
                <p className="text-xs text-slate-500 mt-1">Update user details and permissions.</p>
              </div>
              <button onClick={() => setEditingUser(null)} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
                <X size={20} className="text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleUpdateUser} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Full Name</label>
                <input 
                  type="text" 
                  required
                  className="input-field" 
                  value={editingUser.name}
                  onChange={e => setEditingUser({...editingUser, name: e.target.value})}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Email Address</label>
                <input 
                  type="email" 
                  disabled
                  className="input-field bg-slate-50 text-slate-500 cursor-not-allowed" 
                  value={editingUser.email}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Role</label>
                <select 
                  className="input-field"
                  value={editingUser.role}
                  onChange={e => setEditingUser({...editingUser, role: e.target.value})}
                >
                  {getRoleOptions().map(role => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
              </div>
              <button 
                type="submit" 
                disabled={isSubmitting}
                className="btn-primary w-full py-3 mt-4 flex items-center justify-center"
              >
                {isSubmitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  'Save Changes'
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteModalOpen}
        title="Delete User"
        message="Are you sure you want to delete this user? This action will permanently remove them from the system."
        onConfirm={handleDeleteUser}
        onCancel={() => {
          setDeleteModalOpen(false);
          setUserToDelete(null);
        }}
      />
    </div>
  );
}
