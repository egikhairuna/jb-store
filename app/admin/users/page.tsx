"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { UserPlus, Pencil, Ban, CheckCircle, Trash2, Loader2, ShieldCheck, ShoppingCart } from "lucide-react";

type User = {
  id: string;
  name: string | null;
  username: string | null;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
};

type FormState = {
  name: string;
  username: string;
  email: string;
  password: string;
  role: "ADMIN" | "CASHIER";
};

const EMPTY_FORM: FormState = { name: "", username: "", email: "", password: "", role: "CASHIER" };

export default function UsersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create dialog
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<FormState>(EMPTY_FORM);
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Edit dialog
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState<Partial<FormState>>({});
  const [editError, setEditError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Guard: admin only
  useEffect(() => {
    if (status === "authenticated" && session?.user?.role !== "ADMIN") {
      router.replace("/pos");
    }
  }, [status, session, router]);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error("Failed to load users");
      const data = await res.json();
      setUsers(data.users);
    } catch {
      setError("Could not load users. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated" && session?.user?.role === "ADMIN") {
      fetchUsers();
    }
  }, [status, session, fetchUsers]);

  // ─── Create ───────────────────────────────────────────────────────────────

  const handleCreate = async () => {
    setCreateError(null);
    setIsCreating(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });
      const data = await res.json();
      if (!res.ok) { setCreateError(data.error); return; }
      setIsCreateOpen(false);
      setCreateForm(EMPTY_FORM);
      fetchUsers();
    } catch {
      setCreateError("Network error. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  // ─── Edit / Save ──────────────────────────────────────────────────────────

  const openEdit = (user: User) => {
    setEditUser(user);
    setEditForm({ name: user.name ?? "", username: user.username ?? "", role: user.role as "ADMIN" | "CASHIER", password: "" });
    setEditError(null);
  };

  const handleSave = async () => {
    if (!editUser) return;
    setEditError(null);
    setIsSaving(true);
    try {
      const payload: Record<string, unknown> = { id: editUser.id };
      if (editForm.name !== undefined) payload.name = editForm.name;
      if (editForm.username !== undefined) payload.username = editForm.username;
      if (editForm.role) payload.role = editForm.role;
      if (editForm.password) payload.password = editForm.password;

      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) { setEditError(data.error); return; }
      setEditUser(null);
      fetchUsers();
    } catch {
      setEditError("Network error. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Toggle Active ────────────────────────────────────────────────────────

  const handleToggleActive = async (user: User) => {
    if (user.id === session?.user?.id) {
      alert("You cannot deactivate your own account.");
      return;
    }
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: user.id, isActive: !user.isActive }),
    });
    if (res.ok) fetchUsers();
  };

  // ─── Delete ───────────────────────────────────────────────────────────────

  const handleDelete = async (user: User) => {
    if (!confirm(`Permanently delete ${user.email}? This cannot be undone.`)) return;
    const res = await fetch(`/api/admin/users?id=${user.id}`, { method: "DELETE" });
    if (res.ok) fetchUsers();
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  if (status === "loading" || (status === "authenticated" && session?.user?.role !== "ADMIN")) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const admins = users.filter((u) => u.role === "ADMIN");
  const cashiers = users.filter((u) => u.role === "CASHIER");

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">User Management</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage staff accounts — Admins and Cashiers
          </p>
        </div>
        <Button onClick={() => { setCreateForm(EMPTY_FORM); setCreateError(null); setIsCreateOpen(true); }}>
          <UserPlus className="mr-2 h-4 w-4" />
          Add User
        </Button>
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-8">
          {/* Admins */}
          <UserTable
            title="Admins"
            icon={<ShieldCheck className="h-4 w-4 text-primary" />}
            users={admins}
            currentUserId={session?.user?.id}
            onEdit={openEdit}
            onToggleActive={handleToggleActive}
            onDelete={handleDelete}
          />

          {/* Cashiers */}
          <UserTable
            title="Cashiers"
            icon={<ShoppingCart className="h-4 w-4 text-muted-foreground" />}
            users={cashiers}
            currentUserId={session?.user?.id}
            onEdit={openEdit}
            onToggleActive={handleToggleActive}
            onDelete={handleDelete}
          />
        </div>
      )}

      {/* ── Create Dialog ── */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {createError && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{createError}</p>
            )}
            <div className="space-y-2">
              <Label>Name</Label>
              <Input placeholder="Full name" value={createForm.name}
                onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Username <span className="text-muted-foreground text-xs">(optional, for quick login)</span></Label>
              <Input placeholder="insert username" value={createForm.username}
                onChange={(e) => setCreateForm((f) => ({ ...f, username: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Email <span className="text-destructive">*</span></Label>
              <Input type="email" placeholder="insert email" value={createForm.email}
                onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Password <span className="text-destructive">*</span></Label>
              <Input type="password" placeholder="Min. 8 characters" value={createForm.password}
                onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Role <span className="text-destructive">*</span></Label>
              <Select value={createForm.role} onValueChange={(v) => setCreateForm((f) => ({ ...f, role: v as "ADMIN" | "CASHIER" }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASHIER">Cashier</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>  
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={isCreating}>
              {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Dialog ── */}
      <Dialog open={!!editUser} onOpenChange={(open) => { if (!open) setEditUser(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit User — {editUser?.email}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {editError && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{editError}</p>
            )}
            <div className="space-y-2">
              <Label>Name</Label>
              <Input placeholder="Full name" value={editForm.name ?? ""}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Username <span className="text-muted-foreground text-xs">(leave blank to remove)</span></Label>
              <Input placeholder="e.g. cashier1" value={editForm.username ?? ""}
                onChange={(e) => setEditForm((f) => ({ ...f, username: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={editForm.role} onValueChange={(v) => setEditForm((f) => ({ ...f, role: v as "ADMIN" | "CASHIER" }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASHIER">Cashier</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>New Password <span className="text-muted-foreground text-xs">(leave blank to keep current)</span></Label>
              <Input type="password" placeholder="Min. 8 characters" value={editForm.password ?? ""}
                onChange={(e) => setEditForm((f) => ({ ...f, password: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Sub-component ────────────────────────────────────────────────────────────

function UserTable({
  title, icon, users, currentUserId, onEdit, onToggleActive, onDelete,
}: {
  title: string;
  icon: React.ReactNode;
  users: User[];
  currentUserId?: string;
  onEdit: (u: User) => void;
  onToggleActive: (u: User) => void;
  onDelete: (u: User) => void;
}) {
  return (
    <div className="rounded-lg border">
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/30">
        {icon}
        <span className="font-semibold text-sm">{title}</span>
        <Badge variant="secondary" className="ml-1">{users.length}</Badge>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email / Username</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Joined</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                No {title.toLowerCase()} yet
              </TableCell>
            </TableRow>
          ) : (
            users.map((user) => (
              <TableRow key={user.id} className={!user.isActive ? "opacity-50" : ""}>
                <TableCell className="font-medium">
                  {user.name ?? <span className="text-muted-foreground italic">No name</span>}
                  {user.id === currentUserId && (
                    <Badge variant="outline" className="ml-2 text-xs">You</Badge>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  <div>{user.email}</div>
                  {user.username && (
                    <div className="text-xs text-primary font-mono mt-0.5">@{user.username}</div>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={user.isActive ? "default" : "secondary"}>
                    {user.isActive ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {new Date(user.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" title="Edit"
                      onClick={() => onEdit(user)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost" size="icon"
                      className={`h-8 w-8 ${user.isActive ? "text-amber-500 hover:text-amber-600" : "text-green-600 hover:text-green-700"}`}
                      title={user.isActive ? "Deactivate" : "Activate"}
                      onClick={() => onToggleActive(user)}
                      disabled={user.id === currentUserId}
                    >
                      {user.isActive ? <Ban className="h-3.5 w-3.5" /> : <CheckCircle className="h-3.5 w-3.5" />}
                    </Button>
                    <Button
                      variant="ghost" size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      title="Delete"
                      onClick={() => onDelete(user)}
                      disabled={user.id === currentUserId}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
