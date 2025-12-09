import React, { useState, useMemo } from 'react';
import { useApp } from '../AppContext';
import { Role, SheetStatus, SheetData } from '../types';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell, LineChart, Line, CartesianGrid
} from 'recharts';
import {
    Check, X, Clipboard, Truck, Users as UserIcon, Trash2, Database,
    FileText, Search, Plus, ArrowUpDown, Download, Printer, Lock, Edit3, Eye, ShieldAlert,
    CheckCircle, XCircle, Key, UserPlus, Activity, ClipboardList,
    FileSpreadsheet, Filter, CheckCircle2, History,
    LayoutDashboard, Settings, LogOut, ChevronLeft, ChevronRight,
    AlertCircle, Clock, Calendar, Edit, ShieldCheck,
    Minimize2, Maximize2, ChevronDown, CheckSquare, AlignJustify,
    Timer, TableProperties
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { widgetRegistry, getWidgetDefinition } from './widgets/WidgetRegistry';
import { AddWidgetModal } from './widgets/AddWidgetModal';

interface AdminDashboardProps {
    viewMode: 'analytics' | 'users' | 'database' | 'audit' | 'approvals' | 'staging_workflow' | 'loading_workflow';
    onViewSheet: (sheet: SheetData) => void;
    onNavigate?: (page: string, filter?: string) => void;
    initialSearch?: string;
}

interface SortConfig {
    key: keyof SheetData | string;
    direction: 'asc' | 'desc';
}
interface ViewConfig {
    density: 'compact' | 'normal' | 'comfortable';
    wrapText: boolean;
}

// Forced HMR Rebuild v3
export const AdminDashboard: React.FC<AdminDashboardProps> = ({ viewMode, onViewSheet, onNavigate, initialSearch = '' }) => {
    const { users, approveUser, deleteUser, sheets, deleteSheet, register, resetPassword, currentUser, isLoading } = useApp();

    const [searchTerm, setSearchTerm] = useState(initialSearch);
    const [filterRole, setFilterRole] = useState<Role | 'ALL'>('ALL');

    // Create User State
    const [isCreateUserOpen, setCreateUserOpen] = useState(false);
    const [newUser, setNewUser] = useState({
        username: '',
        fullName: '',
        empCode: '',
        email: '',
        password: '',
        role: Role.STAGING_SUPERVISOR
    });
    // Reset Password State
    const [isResetPasswordOpen, setResetPasswordOpen] = useState(false);
    const [resetData, setResetData] = useState<{ id: string, username: string, newPass: string } | null>(null);

    // --- WIDGET SYSTEM STATE ---
    // Persist preferences to LocalStorage keyed by username
    const [userWidgets, setUserWidgets] = useState<string[]>(() => {
        if (!currentUser?.username) return ['staff-performance', 'sla-monitor', 'incident-list'];
        try {
            const saved = localStorage.getItem(`unicharm_widgets_restored_v2_${currentUser.username}`);
            const loaded = saved ? JSON.parse(saved) : ['staff-performance', 'sla-monitor', 'incident-list'];
            if (!loaded.includes('incident-list')) loaded.push('incident-list');
            return loaded;
        } catch (e) {
            console.error("Failed to parse widget preferences", e);
            return ['staff-performance', 'sla-monitor', 'incident-list'];
        }
    });
    const [isAddWidgetOpen, setAddWidgetOpen] = useState(false);

    // View Configuration for Database Table
    const [viewConfig, setViewConfig] = useState<ViewConfig>({
        density: 'normal',
        wrapText: false
    });
    // NEW: Database View Mode (Standard vs Duration)
    const [dbViewMode, setDbViewMode] = useState<'details' | 'duration'>('details');
    // NEW: Database Workflow Context
    const [dbWorkflow, setDbWorkflow] = useState<'ALL' | 'STAGING' | 'LOADING' | 'APPROVALS'>(() => {
        const params = new URLSearchParams(window.location.search);
        const wf = params.get('workflow');
        return (wf === 'STAGING' || wf === 'LOADING' || wf === 'APPROVALS') ? wf : 'ALL';
    });
    const [isViewMenuOpen, setIsViewMenuOpen] = useState(false);

    // Sort State
    const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    // Save to LocalStorage whenever widgets change
    React.useEffect(() => {
        if (currentUser?.username) {
            localStorage.setItem(`unicharm_widgets_restored_v2_${currentUser.username}`, JSON.stringify(userWidgets));
        }
    }, [userWidgets, currentUser]);

    const handleAddWidget = (widgetId: string) => {
        if (!userWidgets.includes(widgetId)) {
            setUserWidgets([...userWidgets, widgetId]);
        }
    };

    const handleRemoveWidget = (widgetId: string) => {
        setUserWidgets(userWidgets.filter(id => id !== widgetId));
    };

    // --- ANALYTICS DATA PREP ---
    const resolveUserName = (primaryName?: string, fallbackUsername?: string) => {
        if (primaryName) return primaryName;
        if (!fallbackUsername) return undefined;
        const user = users.find(u => u.username === fallbackUsername);
        return user ? (user.fullName || user.username) : fallbackUsername;
    };

    // Navigation Helper
    const navigateToDatabase = (statusFilter: string, workflow: 'ALL' | 'STAGING' | 'LOADING' | 'APPROVALS' = 'ALL') => {
        const newUrl = new URL(window.location.href);

        // Router Logic for Dedicated Views
        if (workflow === 'STAGING') {
            newUrl.searchParams.set('view', 'staging-db');
        } else if (workflow === 'LOADING') {
            newUrl.searchParams.set('view', 'loading-db');
        } else if (workflow === 'APPROVALS') {
            newUrl.searchParams.set('view', 'approvals');
        } else {
            newUrl.searchParams.set('view', 'database');
        }

        newUrl.searchParams.set('status', statusFilter);
        newUrl.searchParams.set('workflow', workflow); // Still helpful for internal state
        window.history.pushState({}, '', newUrl.toString());
        window.location.reload();
    };

    // --- HELPER FUNCTIONS ---
    const handleDelete = (e: React.MouseEvent, id: string) => {
        e.preventDefault(); e.stopPropagation();
        if (confirm("Are you sure you want to delete this sheet?")) {
            const reason = prompt("Enter reason for deletion:");
            if (reason) deleteSheet(id, reason);
        }
    };

    const handleUserDelete = (e: React.MouseEvent, id: string, username: string) => {
        e.preventDefault(); e.stopPropagation();
        if (confirm(`Are you sure you want to permanently delete user "${username}"?`)) deleteUser(id);
    };

    const handleApprove = (e: React.MouseEvent, id: string) => {
        e.preventDefault(); e.stopPropagation();
        approveUser(id, true);
    };

    const handleReject = (e: React.MouseEvent, id: string) => {
        e.preventDefault(); e.stopPropagation();
        approveUser(id, false);
    };

    const handleCreateUserSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newUser.username || !newUser.password || !newUser.fullName || !newUser.empCode) { alert("All fields are required"); return; }
        await register({ ...newUser, id: Date.now().toString(), role: newUser.role, isApproved: true });
        setCreateUserOpen(false);
        setNewUser({ username: '', fullName: '', empCode: '', email: '', password: '', role: Role.STAGING_SUPERVISOR });
        alert('User created successfully.');
    };

    const openResetPassword = (e: React.MouseEvent, user: any) => {
        e.preventDefault(); e.stopPropagation();
        setResetData({ id: user.id, username: user.username, newPass: '' });
        setResetPasswordOpen(true);
    };

    const handleResetPasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (resetData && resetData.newPass) {
            await resetPassword(resetData.id, resetData.newPass);
            setResetPasswordOpen(false);
            setResetData(null);
        }
    };

    // --- EXCEL EXPORT ---
    const handleExportExcel = () => {
        const dataToExport = sheets.map(s => ({
            ID: s.id, Date: s.date, Status: s.status, Shift: s.shift,
            Supervisor: s.supervisorName, 'Supervisor (Loading)': s.loadingSvName,
            Destination: s.destination, Transporter: s.transporter, 'Vehicle No': s.vehicleNo,
            'Created By': s.createdBy, 'Created At': s.createdAt ? new Date(s.createdAt).toLocaleString() : ''
        }));
        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Operations_Data");
        XLSX.writeFile(wb, "Unicharm_Operations_Report.xlsx");
        alert("Excel Report Downloaded Successfully!");
    };

    // --- STATS CALCULATION ---
    const stats = useMemo(() => {
        const total = sheets.length;
        const completed = sheets.filter(s => s.status === SheetStatus.COMPLETED).length;
        const completedToday = sheets.filter(s => s.status === SheetStatus.COMPLETED && new Date(s.date).toDateString() === new Date().toDateString()).length;

        // Staging
        const stagingTotal = sheets.length;
        const stagingDrafts = sheets.filter(s => s.status === SheetStatus.DRAFT).length;
        const stagingPending = sheets.filter(s => s.status === SheetStatus.STAGING_VERIFICATION_PENDING).length;
        const stagingLocked = sheets.filter(s => s.status === SheetStatus.LOCKED).length;
        const stagingStaff = users.filter(u => u.role === Role.STAGING_SUPERVISOR && u.isApproved).length;
        const createdToday = sheets.filter(s => new Date(s.date).toDateString() === new Date().toDateString()).length;

        // Loading
        const loadingTotal = sheets.length;
        // Correct calculation for Loading: 'Locked' belongs here as "Ready to Load" but conceptually flows from staging.
        const loadingLocked = sheets.filter(s => s.status === SheetStatus.LOCKED).length;
        const loadingPending = sheets.filter(s => s.status === SheetStatus.LOADING_VERIFICATION_PENDING).length;
        const loadingCompleted = completed;
        const loadingStaff = users.filter(u => u.role === Role.LOADING_SUPERVISOR && u.isApproved).length;

        // Approvals (Shift Lead)
        const shiftLeadStaff = users.filter(u => u.role === Role.SHIFT_LEAD && u.isApproved).length;

        const pendingStaging = stagingPending;
        const pendingLoading = loadingPending;

        return {
            total, completed, draft: stagingDrafts, locked: loadingLocked,
            createdToday, completedToday,
            staging: { total: stagingTotal, drafts: stagingDrafts, pending: stagingPending, locked: stagingLocked, staff: stagingStaff },
            loading: { total: loadingTotal, locked: loadingLocked, pending: loadingPending, completed: loadingCompleted, staff: loadingStaff },
            approvals: { staging: stagingPending, loading: pendingLoading, staff: shiftLeadStaff },
            pendingStaging, pendingLoading, shiftLeads: shiftLeadStaff, stagingStaff, loadingStaff
        };
    }, [sheets, users]);

    if (isLoading) return <div className="p-8 text-center animate-pulse">Loading dashboard...</div>;

    const isAdmin = currentUser?.role === Role.ADMIN;
    const isShiftLead = currentUser?.role === Role.SHIFT_LEAD;
    const showStaging = isAdmin || isShiftLead || currentUser?.role === Role.STAGING_SUPERVISOR;
    const showLoading = isAdmin || isShiftLead || currentUser?.role === Role.LOADING_SUPERVISOR;
    const showApprovals = isAdmin || isShiftLead;

    // --- VIEW 1: ANALYTICS DASHBOARD ---
    if (viewMode === 'analytics') {
        const sortedWidgets = userWidgets.map(id => getWidgetDefinition(id)).filter(w => w !== undefined);
        return (
            <div className="space-y-6 pb-20">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Activity className="text-blue-600" /> Operational Overview</h2>
                        <p className="text-sm text-slate-500">Real-time performance metrics</p>
                    </div>
                    <button onClick={handleExportExcel} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold shadow-lg transition-all"><FileSpreadsheet size={16} /> Export</button>
                </div>

                <div
                    onClick={() => navigateToDatabase('COMPLETED', 'ALL')}
                    className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 cursor-pointer hover:shadow-md hover:border-green-300 transition-all group relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><CheckCircle size={120} className="text-green-500" /></div>
                    <div className="flex items-center justify-between relative z-10">
                        <div><h3 className="text-lg font-bold text-slate-500 uppercase tracking-wide mb-1">Total Sheets Completed</h3><p className="text-xs text-slate-400">Click to filter view</p></div>
                        <div className="text-5xl font-extrabold text-green-600">{stats.completed}</div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Staging */}
                    <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
                        <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-100">
                            <div className="p-2 bg-blue-100 rounded-lg text-blue-600"><Clipboard size={20} /></div>
                            <div><h3 className="font-bold text-slate-700">Staging Overview</h3><div className="text-xs text-slate-400">{stats.staging.staff} Staff</div></div>
                        </div>
                        <div className="grid grid-cols-3 gap-2"> {/* Changed to 3 cols for Locked */}
                            <div onClick={() => navigateToDatabase('DRAFT', 'STAGING')} className="p-3 bg-blue-50/50 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors">
                                <span className="text-[10px] text-blue-500 uppercase font-bold block mb-1">Drafts</span>
                                <span className="text-xl font-bold text-blue-700">{stats.staging.drafts}</span>
                            </div>
                            <div onClick={() => navigateToDatabase('STAGING_VERIFICATION_PENDING', 'STAGING')} className="p-3 bg-yellow-50 rounded-lg cursor-pointer hover:bg-yellow-100 transition-colors">
                                <span className="text-[10px] text-yellow-600 uppercase font-bold block mb-1">Pending</span>
                                <span className="text-xl font-bold text-yellow-700">{stats.staging.pending}</span>
                            </div>
                            <div onClick={() => navigateToDatabase('LOCKED', 'STAGING')} className="p-3 bg-orange-50 rounded-lg cursor-pointer hover:bg-orange-100 transition-colors">
                                <span className="text-[10px] text-orange-600 uppercase font-bold block mb-1">Locked</span>
                                <span className="text-xl font-bold text-orange-700">{stats.staging.locked}</span>
                            </div>
                        </div>
                    </div>
                    {/* Loading */}
                    <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
                        <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-100">
                            <div className="p-2 bg-orange-100 rounded-lg text-orange-600"><Truck size={20} /></div>
                            <div><h3 className="font-bold text-slate-700">Loading Overview</h3><div className="text-xs text-slate-400">{stats.loading.staff} Staff</div></div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div onClick={() => navigateToDatabase('LOCKED', 'LOADING')} className="p-2 bg-orange-50 rounded-lg cursor-pointer hover:bg-orange-100 transition-colors flex items-center justify-between group">
                                <div>
                                    <span className="text-[10px] text-orange-600 uppercase font-bold block mb-1">Ready to Load</span>
                                    <span className="text-lg font-bold text-orange-700">{stats.loading.locked}</span>
                                </div>
                                <Lock className="text-orange-300 group-hover:text-orange-500 transition-colors" size={24} />
                            </div>
                            <div onClick={() => navigateToDatabase('LOADING_VERIFICATION_PENDING', 'LOADING')} className="p-2 bg-yellow-50 rounded-lg cursor-pointer hover:bg-yellow-100 transition-colors flex items-center justify-between group">
                                <div>
                                    <span className="text-[10px] text-yellow-600 uppercase font-bold block mb-1">Pending</span>
                                    <span className="text-lg font-bold text-yellow-700">{stats.loading.pending}</span>
                                </div>
                                <Clock className="text-yellow-300 group-hover:text-yellow-500 transition-colors" size={24} />
                            </div>
                        </div>
                    </div>
                    {/* Approvals */}
                    <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
                        <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-100">
                            <div className="p-2 bg-purple-100 rounded-lg text-purple-600"><CheckCircle2 size={20} /></div>
                            <div><h3 className="font-bold text-slate-700">Shift Lead</h3><div className="text-xs text-slate-400">{stats.approvals.staff} Leads</div></div>
                        </div>
                        <div className="space-y-3">
                            <div onClick={() => navigateToDatabase('STAGING_VERIFICATION_PENDING', 'STAGING')} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors">
                                <span className="text-sm font-bold text-slate-700">Staging</span>
                                <span className="text-sm text-slate-500">(Pending)</span>
                                <span className="text-lg font-bold text-blue-700">{stats.approvals.staging}</span>
                            </div>
                            <div onClick={() => navigateToDatabase('LOADING_VERIFICATION_PENDING', 'LOADING')} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg cursor-pointer hover:bg-orange-100 transition-colors">
                                <span className="text-sm font-bold text-slate-700">Loading</span>
                                <span className="text-sm text-slate-500">(Pending)</span>
                                <span className="text-lg font-bold text-orange-700">{stats.approvals.loading}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ROW 3 & 4: Widgets */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {userWidgets.includes('sla-monitor') && getWidgetDefinition('sla-monitor') && (
                        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm"><h3 className="font-bold mb-4">SLA Compliance</h3>{React.createElement(getWidgetDefinition('sla-monitor')!.component)}</div>
                    )}
                    {userWidgets.includes('incident-list') && getWidgetDefinition('incident-list') && (
                        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm"><h3 className="font-bold mb-4">Incidents</h3>{React.createElement(getWidgetDefinition('incident-list')!.component)}</div>
                    )}
                </div>
                {
                    userWidgets.includes('staff-performance') && getWidgetDefinition('staff-performance') && (
                        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm"><h3 className="font-bold mb-4">Staff Performance</h3>{React.createElement(getWidgetDefinition('staff-performance')!.component)}</div>
                    )
                }

                <AddWidgetModal isOpen={isAddWidgetOpen} onClose={() => setAddWidgetOpen(false)} onAdd={handleAddWidget} activeWidgets={userWidgets} />
            </div >
        );
    }

    // --- VIEW 2: USERS PANEL ---
    if (viewMode === 'users') {
        if (currentUser?.role === Role.SHIFT_LEAD) {
            return (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                    <ShieldAlert size={64} className="text-red-300 mb-4" />
                    <h2 className="text-xl font-bold text-slate-700">Access Denied</h2>
                    <p className="text-slate-500 max-w-sm mt-2">You do not have permission to view User Administration settings.</p>
                </div>
            );
        }

        const filteredUsers = users.filter(u => {
            const searchMatch = u.username.toLowerCase().includes(searchTerm.toLowerCase()) || (u.fullName && u.fullName.toLowerCase().includes(searchTerm.toLowerCase()));
            const roleMatch = filterRole === 'ALL' || u.role === filterRole;
            if (currentUser?.role === Role.ADMIN) return searchMatch && roleMatch;
            if (currentUser?.role === Role.STAGING_SUPERVISOR) return searchMatch && u.role === Role.STAGING_SUPERVISOR;
            if (currentUser?.role === Role.LOADING_SUPERVISOR) return searchMatch && u.role === Role.LOADING_SUPERVISOR;
            return false;
        }).sort((a, b) => (a.isApproved === b.isApproved) ? 0 : !a.isApproved ? -1 : 1);

        return (
            <div className="space-y-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold flex gap-2"><UserIcon className="text-blue-600" /> User Administration</h2>
                        {currentUser?.role === Role.ADMIN && <button onClick={() => setCreateUserOpen(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"><UserPlus size={16} /> Add User</button>}
                    </div>

                    {/* User Role Filters */}
                    <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2">
                        <button
                            onClick={() => setFilterRole('ALL')}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${filterRole === 'ALL' ? 'bg-slate-800 text-white shadow-md' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'}`}
                        >
                            All Users
                        </button>
                        <button
                            onClick={() => setFilterRole(Role.STAGING_SUPERVISOR)}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${filterRole === Role.STAGING_SUPERVISOR ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'}`}
                        >
                            Staging
                        </button>
                        <button
                            onClick={() => setFilterRole(Role.LOADING_SUPERVISOR)}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${filterRole === Role.LOADING_SUPERVISOR ? 'bg-orange-600 text-white shadow-md' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'}`}
                        >
                            Loading
                        </button>
                        <button
                            onClick={() => setFilterRole(Role.SHIFT_LEAD)}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${filterRole === Role.SHIFT_LEAD ? 'bg-purple-600 text-white shadow-md' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'}`}
                        >
                            Shift Leads
                        </button>
                    </div>
                    <div className="overflow-hidden rounded-lg border border-slate-200">
                        {filteredUsers.map((user) => (
                            <div key={user.id} className="grid grid-cols-[1.5fr_1.5fr_1fr_1.5fr_1fr_120px] p-4 border-b hover:bg-slate-50 items-center text-sm">
                                <div className="font-bold">{user.username}</div>
                                <div>{user.fullName}</div>
                                <div><span className="px-2 py-1 bg-slate-100 rounded-full text-xs font-bold">{user.role}</span></div>
                                <div className="truncate">{user.email || '-'}</div>
                                <div className="flex justify-center"><span className={`px-2 py-1 rounded text-xs font-bold ${user.isApproved ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{user.isApproved ? 'Active' : 'Pending'}</span></div>
                                <div className="flex justify-center gap-2">
                                    {!user.isApproved ? (
                                        <><button onClick={(e) => handleApprove(e, user.id)} className="text-green-600"><CheckCircle size={16} /></button><button onClick={(e) => handleReject(e, user.id)} className="text-red-600"><XCircle size={16} /></button></>
                                    ) : (
                                        currentUser?.role === Role.ADMIN && <button onClick={(e) => handleUserDelete(e, user.id, user.username)} className="text-red-600"><Trash2 size={16} /></button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                {isCreateUserOpen && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-xl p-6 w-full max-w-md">
                            <form onSubmit={handleCreateUserSubmit} className="space-y-4">
                                <h3 className="font-bold text-lg">Create User</h3>
                                <input className="w-full border p-2 rounded" placeholder="Username" value={newUser.username} onChange={e => setNewUser({ ...newUser, username: e.target.value })} required />
                                <input className="w-full border p-2 rounded" placeholder="Full Name" value={newUser.fullName} onChange={e => setNewUser({ ...newUser, fullName: e.target.value })} required />
                                <input className="w-full border p-2 rounded" placeholder="Emp Code" value={newUser.empCode} onChange={e => setNewUser({ ...newUser, empCode: e.target.value })} required />
                                <input className="w-full border p-2 rounded" placeholder="Email" type="email" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} required />
                                <input className="w-full border p-2 rounded" placeholder="Password" type="password" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} required />
                                <label className="block text-sm font-bold text-slate-700">Role</label>
                                <select className="w-full border p-2 rounded" value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value as Role })}>
                                    <option value={Role.STAGING_SUPERVISOR}>Staging Supervisor</option>
                                    <option value={Role.LOADING_SUPERVISOR}>Loading Supervisor</option>
                                    <option value={Role.SHIFT_LEAD}>Shift Lead</option>
                                    <option value={Role.ADMIN}>Admin</option>
                                </select>
                                <div className="flex gap-2 justify-end mt-4"><button type="button" onClick={() => setCreateUserOpen(false)} className="px-4 py-2 border rounded">Cancel</button><button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Create</button></div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        );
    }
    // --- VIEW 3: AUDIT LOGS ---
    if (viewMode === 'audit') {
        const { auditLogs } = useApp();
        const filteredLogs = auditLogs.filter(log =>
            log.user.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.details.toLowerCase().includes(searchTerm.toLowerCase())
        );

        return (
            <div className="space-y-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                    <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2"><History className="text-blue-600" /> System Audit Logs</h2>
                            <p className="text-sm text-gray-500">Track all system activities.</p>
                        </div>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                            <input type="text" placeholder="Search logs..." className="pl-10 pr-4 py-2.5 border rounded-lg text-sm w-64" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        </div>
                    </div>
                    <div className="overflow-hidden rounded-lg border border-slate-200 shadow-sm bg-white">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-800 text-white font-bold text-xs uppercase">
                                <tr><th className="p-4 w-48">Timestamp</th><th className="p-4 w-32">User</th><th className="p-4 w-32">Action</th><th className="p-4">Details</th></tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredLogs.length > 0 ? (
                                    filteredLogs.map((log: any) => (
                                        <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="p-4 text-slate-500 font-mono text-xs">{new Date(log.timestamp).toLocaleString()}</td>
                                            <td className="p-4 font-bold text-slate-700">{log.user}</td>
                                            <td className="p-4"><span className={`px-2 py-1 rounded text-xs font-bold ${log.action.includes('DELETE') ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>{log.action}</span></td>
                                            <td className="p-4 text-slate-600">{log.details}</td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr><td colSpan={4} className="p-8 text-center text-slate-400 italic">No logs found.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    }

    // --- VIEW 4: DATABASE PANEL (and SHIFT LEAD VIEW) ---
    // --- VIEW 3: DATABASE & APPROVALS & DEDICATED WORKFLOWS ---
    if (viewMode === 'database' || viewMode === 'approvals' || viewMode === 'staging_workflow' || viewMode === 'loading_workflow') {

        // Title & Context Logic
        let viewTitle = 'Database Management';
        let isLockedWorkflow = false;

        if (viewMode === 'staging_workflow') {
            viewTitle = 'Staging Workflow Database';
            isLockedWorkflow = true;
        } else if (viewMode === 'loading_workflow') {
            viewTitle = 'Loading Workflow Database';
            isLockedWorkflow = true;
        } else if (viewMode === 'approvals') {
            viewTitle = 'Pending Approvals';
        }

        const isAdmin = currentUser?.role === Role.ADMIN;
        const isShiftLead = currentUser?.role === Role.SHIFT_LEAD;

        const urlParams = new URLSearchParams(window.location.search);
        const statusFilter = urlParams.get('status');

        if (!isAdmin && !isShiftLead && viewMode !== 'staging_workflow' && viewMode !== 'loading_workflow') {
            return (
                <div className="flex flex-col items-center justify-center p-12 h-96 text-slate-400">
                    <ShieldAlert size={48} className="mb-4 text-slate-300" />
                    <h3 className="text-lg font-bold">Access Denied</h3>
                    <p className="text-sm">You do not have permission to view the database.</p>
                </div>
            );
        }

        const filteredSheets = sheets.filter(s => {
            const term = searchTerm.toLowerCase();
            const matchesSearch =
                (s.id.toLowerCase().includes(term)) ||
                (s.supervisorName?.toLowerCase().includes(term)) ||
                (s.loadingSvName?.toLowerCase().includes(term)) ||
                (s.completedBy && s.completedBy.toLowerCase().includes(term)) ||
                (s.driverName && s.driverName.toLowerCase().includes(term)) ||
                (s.vehicleNo && s.vehicleNo.toLowerCase().includes(term)) ||
                (s.destination && s.destination.toLowerCase().includes(term));

            let matchesStatus = !statusFilter || statusFilter === 'ALL' || s.status === statusFilter;

            // SPECIAL RULE: Shift Lead View only shows Pending Approvals by default
            if (viewMode === 'approvals' && (!statusFilter || statusFilter === 'ALL')) {
                matchesStatus = s.status === 'STAGING_VERIFICATION_PENDING' || s.status === 'LOADING_VERIFICATION_PENDING';
            }
            // SPECIAL RULE: Staging Workflow View only shows Staging-related statuses
            if (viewMode === 'staging_workflow') {
                matchesStatus = matchesStatus && (s.status === 'DRAFT' || s.status === 'STAGING_VERIFICATION_PENDING' || s.status === 'LOCKED');
            }
            // SPECIAL RULE: Loading Workflow View only shows Loading-related statuses
            if (viewMode === 'loading_workflow') {
                matchesStatus = matchesStatus && (s.status === 'LOCKED' || s.status === 'LOADING_VERIFICATION_PENDING' || s.status === 'COMPLETED');
            }


            return matchesSearch && matchesStatus;
        }).sort((a, b) => {
            if (!sortConfig) return 0;
            const { key, direction } = sortConfig;
            let valA: any = a[key as keyof SheetData];
            let valB: any = b[key as keyof SheetData];

            if (key === 'supervisorName') valA = resolveUserName(a.supervisorName, a.createdBy) || '';
            if (key === 'supervisorName') valB = resolveUserName(b.supervisorName, b.createdBy) || '';
            if (key === 'loadingSvName') valA = resolveUserName(a.loadingSvName, a.completedBy) || '';
            if (key === 'loadingSvName') valB = resolveUserName(b.loadingSvName, b.completedBy) || '';

            if (key === 'date' || key.includes('Time') || key.includes('At')) {
                const dA = new Date(valA).getTime();
                const dB = new Date(valB).getTime();
                return direction === 'asc' ? dA - dB : dB - dA;
            }

            if (typeof valA === 'string' && typeof valB === 'string') {
                return direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
            }
            if (valA < valB) return direction === 'asc' ? -1 : 1;
            if (valA > valB) return direction === 'asc' ? 1 : -1;
            return 0;
        });

        return (
            <div className="space-y-6">
                <div className={`p-6 rounded-xl shadow-sm border ${viewMode === 'approvals' ? 'bg-purple-50 border-purple-100' : 'bg-white border-slate-100'}`}>
                    <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-6">
                        <h2 className="text-xl font-bold flex gap-2">
                            {viewMode === 'approvals' ? <CheckCircle2 className="text-purple-600" /> : <Database className="text-blue-600" />}
                            {viewTitle} <span className="text-slate-400 font-medium text-lg">({filteredSheets.length})</span>
                        </h2>

                        <div className="flex gap-2">
                            {/* View Mode Toggle (Details vs Duration) */}
                            <div className="bg-slate-100 p-1 rounded-lg flex items-center">
                                <button
                                    onClick={() => setDbViewMode('details')}
                                    className={`p-2 rounded-md transition-all ${dbViewMode === 'details' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                                    title="Detailed List View"
                                >
                                    <LayoutDashboard size={18} />
                                </button>
                                <button
                                    onClick={() => setDbViewMode('duration')}
                                    className={`p-2 rounded-md transition-all ${dbViewMode === 'duration' ? 'bg-white shadow-sm text-green-600' : 'text-slate-400 hover:text-slate-600'}`}
                                    title="Duration Analysis View"
                                >
                                    <Clock size={18} />
                                </button>
                            </div>
                            <button onClick={handleExportExcel} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm text-sm font-bold"><Download size={16} /> Export View</button>
                        </div>
                    </div>



                    <div className="flex flex-col gap-4 mb-6">
                        {/* Workflow Context Tabs - Hidden in Shift Lead View */}
                        {viewMode !== 'approvals' && !isLockedWorkflow && (
                            <div className="flex p-1 bg-slate-100 rounded-lg w-fit">
                                <button
                                    onClick={() => { setDbWorkflow('ALL'); navigateToDatabase('ALL'); }}
                                    className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${dbWorkflow === 'ALL' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    All Sheets
                                </button>
                                {/* NEW: PENDING Filter for ALL */}
                                <button
                                    onClick={() => navigateToDatabase('PENDING', 'ALL')}
                                    className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${statusFilter === 'PENDING' ? 'bg-white text-yellow-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    Pending (All)
                                </button>
                                <button
                                    onClick={() => { setDbWorkflow('STAGING'); navigateToDatabase('ALL', 'STAGING'); }}
                                    className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${dbWorkflow === 'STAGING' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    Staging Workflow
                                </button>
                                <button
                                    onClick={() => { setDbWorkflow('LOADING'); navigateToDatabase('ALL', 'LOADING'); }}
                                    className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${dbWorkflow === 'LOADING' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    Loading Workflow
                                </button>
                                <button
                                    onClick={() => { setDbWorkflow('APPROVALS'); navigateToDatabase('ALL', 'APPROVALS'); }}
                                    className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${dbWorkflow === 'APPROVALS' ? 'bg-white text-purple-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    Shift Lead Workflow
                                </button>
                            </div>
                        )}

                        {/* Status Filters based on Workflow */}
                        <div className="flex items-center gap-2 overflow-x-auto">
                            <button onClick={() => navigateToDatabase('ALL')} className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${!statusFilter || statusFilter === 'ALL' ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-white text-slate-500 border-slate-200'}`}>All</button>
                            <button onClick={() => navigateToDatabase('DRAFT')} className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${statusFilter === 'DRAFT' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-500 border-slate-200 hover:border-blue-300'}`}>Drafts</button>
                            <button onClick={() => navigateToDatabase('STAGING_VERIFICATION_PENDING')} className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${statusFilter === 'STAGING_VERIFICATION_PENDING' ? 'bg-yellow-500 text-white border-yellow-500' : 'bg-white text-slate-500 border-slate-200 hover:border-yellow-300'}`}>Pending Verification</button>


                            {dbWorkflow === 'LOADING' && (
                                <div className="flex items-center gap-2 overflow-x-auto">
                                    <button onClick={() => navigateToDatabase('ALL')} className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${!statusFilter || statusFilter === 'ALL' ? 'bg-orange-100 text-orange-700 border-orange-200' : 'bg-white text-slate-500 border-slate-200'}`}>All</button>
                                    <button onClick={() => navigateToDatabase('LOCKED')} className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${statusFilter === 'LOCKED' ? 'bg-orange-600 text-white border-orange-600' : 'bg-white text-slate-500 border-slate-200 hover:border-orange-300'}`}>Ready to Load</button>
                                    <button onClick={() => navigateToDatabase('LOADING_VERIFICATION_PENDING')} className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${statusFilter === 'LOADING_VERIFICATION_PENDING' ? 'bg-yellow-500 text-white border-yellow-500' : 'bg-white text-slate-500 border-slate-200 hover:border-yellow-300'}`}>Pending Verification</button>
                                    <button onClick={() => navigateToDatabase('COMPLETED')} className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${statusFilter === 'COMPLETED' ? 'bg-green-600 text-white border-green-600' : 'bg-white text-slate-500 border-slate-200 hover:border-green-300'}`}>Completed</button>
                                </div>
                            )}

                            {dbWorkflow === 'APPROVALS' && (
                                <div className="flex items-center gap-2 overflow-x-auto">
                                    <button onClick={() => navigateToDatabase('STAGING_VERIFICATION_PENDING', 'APPROVALS')} className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${statusFilter === 'STAGING_VERIFICATION_PENDING' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-500 border-slate-200 hover:border-blue-300'}`}>Staging Approval</button>
                                    <button onClick={() => navigateToDatabase('LOADING_VERIFICATION_PENDING', 'APPROVALS')} className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${statusFilter === 'LOADING_VERIFICATION_PENDING' ? 'bg-orange-600 text-white border-orange-600' : 'bg-white text-slate-500 border-slate-200 hover:border-orange-300'}`}>Loading Approval</button>
                                </div>
                            )}
                        </div>

                        {(searchTerm || statusFilter) && (
                            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6 rounded-r-lg flex items-center justify-between animate-fade-in">
                                <div className="flex items-center gap-2">
                                    <Search size={16} className="text-blue-600" />
                                    <span className="text-sm text-blue-900 font-medium">Filtering by Status: <span className="font-bold">{statusFilter || 'ALL'}</span> {searchTerm && <>and Search: <span className="font-bold">"{searchTerm}"</span></>}</span>
                                </div>
                                <button onClick={() => {
                                    const newUrl = new URL(window.location.href);
                                    newUrl.searchParams.delete('status');
                                    window.history.pushState({}, '', newUrl.toString());
                                    window.location.reload();
                                }} className="text-xs text-blue-600 hover:text-blue-800 font-bold underline px-2">Clear</button>
                            </div>
                        )}

                        <div className="overflow-hidden rounded-lg border border-slate-200 shadow-sm bg-white overflow-x-auto">
                            <div className="min-w-[1600px]">
                                {dbViewMode === 'details' ? (
                                    <div className="grid grid-cols-[100px_100px_120px_120px_120px_180px_180px_180px_180px_100px_80px] bg-slate-800 text-white font-bold text-xs uppercase divide-x divide-slate-700 border-b border-slate-600">
                                        <div className="p-4 cursor-pointer" onClick={() => handleSort('id')}>ID</div>
                                        <div className="p-4 cursor-pointer" onClick={() => handleSort('date')}>Date</div>
                                        <div className="p-4 cursor-pointer" onClick={() => handleSort('supervisorName')}>Staging SV</div>
                                        <div className="p-4 cursor-pointer" onClick={() => handleSort('loadingSvName')}>Loading SV</div>
                                        <div className="p-4 cursor-pointer" onClick={() => handleSort('createdBy')}>Created By</div>
                                        <div className="p-4 cursor-pointer" onClick={() => handleSort('createdAt')}>Created At</div>
                                        <div className="p-4 cursor-pointer" onClick={() => handleSort('stagingApprovedBy')}>Stg Appr By</div>
                                        <div className="p-4 cursor-pointer" onClick={() => handleSort('stagingApprovedAt')}>Stg Appr At</div>
                                        <div className="p-4 cursor-pointer" onClick={() => handleSort('loadingApprovedBy')}>Ldg Appr By</div>
                                        <div className="p-4 cursor-pointer" onClick={() => handleSort('status')}>Status</div>
                                        <div className="p-4 text-center">Actions</div>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-[100px_120px_180px_180px_180px_180px_180px_100px_80px] bg-slate-900 text-blue-100 font-bold text-xs uppercase divide-x divide-slate-800 border-b border-slate-700">
                                        <div className="p-4 cursor-pointer" onClick={() => handleSort('id')}>ID</div>
                                        <div className="p-4 cursor-pointer" onClick={() => handleSort('date')}>Date</div>
                                        <div className="p-4 cursor-pointer" onClick={() => handleSort('createdAt')}>Created At</div>
                                        <div className="p-4 cursor-pointer" onClick={() => handleSort('stagingApprovedAt')}>Staging Verified</div>
                                        <div className="p-4 cursor-pointer" onClick={() => handleSort('loadingApprovedAt')}>Loading Verified</div>
                                        <div className="p-4 cursor-pointer" onClick={() => handleSort('completedAt')}>Completed At</div>
                                        <div className="p-4">Process Duration</div>
                                        <div className="p-4 cursor-pointer" onClick={() => handleSort('status')}>Status</div>
                                        <div className="p-4 text-center">Actions</div>
                                    </div>
                                )}

                                <div className="divide-y divide-slate-100">
                                    {filteredSheets.length > 0 ? filteredSheets.map((s) => (
                                        dbViewMode === 'details' ? (
                                            <div key={s.id} className="grid grid-cols-[100px_100px_120px_120px_120px_180px_180px_180px_180px_100px_80px] items-center text-sm text-slate-700 hover:bg-slate-50">
                                                <div className="p-4 font-mono font-bold text-blue-600">{s.id}</div>
                                                <div className="p-4">{s.date}</div>
                                                <div className="p-4 truncate">{resolveUserName(s.supervisorName, s.createdBy)}</div>
                                                <div className="p-4 truncate">{resolveUserName(s.loadingSvName, s.completedBy) || '-'}</div>
                                                <div className="p-4 truncate text-slate-500">{s.createdBy || '-'}</div>
                                                <div className="p-4 text-xs text-slate-500 font-mono">{s.createdAt ? new Date(s.createdAt).toLocaleString() : '-'}</div>
                                                <div className="p-4 truncate text-emerald-600">{s.stagingApprovedBy || '-'}</div>
                                                <div className="p-4 text-xs text-slate-500 font-mono">{s.stagingApprovedAt ? new Date(s.stagingApprovedAt).toLocaleString() : '-'}</div>
                                                <div className="p-4 truncate text-orange-600">{s.loadingApprovedBy || '-'}</div>
                                                <div className="p-4">
                                                    {/* Enhanced Station Pipeline Visualization */}
                                                    <div className="flex flex-col gap-1 w-[160px]">
                                                        <div className="flex items-center justify-between relative">
                                                            {/* Connecting Line */}
                                                            <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-200 -z-10"></div>
                                                            <div className={`absolute top-1/2 left-0 h-0.5 bg-blue-500 -z-10 transition-all duration-500`} style={{ width: s.status === 'COMPLETED' ? '100%' : s.status === 'LOADING_VERIFICATION_PENDING' ? '75%' : s.status === 'LOCKED' ? '50%' : s.status === 'STAGING_VERIFICATION_PENDING' ? '25%' : '0%' }}></div>

                                                            {/* Station 1: Draft/Start */}
                                                            <div className={`relative group`}>
                                                                <div className={`w-3 h-3 rounded-full border-2 ${s.status !== 'DRAFT' ? 'bg-blue-500 border-blue-500' : 'bg-white border-slate-400'}`}></div>
                                                                <span className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 text-[8px] font-bold text-slate-500 uppercase whitespace-nowrap">Start</span>
                                                            </div>

                                                            {/* Station 2: Staging Check (Shift Lead) */}
                                                            <div className={`relative group`}>
                                                                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${['LOCKED', 'LOADING_VERIFICATION_PENDING', 'COMPLETED'].includes(s.status) ? 'bg-green-500 border-green-500 text-white' : s.status === 'STAGING_VERIFICATION_PENDING' ? 'bg-white border-blue-500 text-blue-500 animate-pulse' : 'bg-white border-slate-300 text-slate-300'}`}>
                                                                    {['LOCKED', 'LOADING_VERIFICATION_PENDING', 'COMPLETED'].includes(s.status) ? <CheckCircle size={10} /> : <ClipboardList size={8} strokeWidth={3} />}
                                                                </div>
                                                                <span className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 text-[8px] font-bold text-slate-500 uppercase whitespace-nowrap">Check</span>
                                                            </div>

                                                            {/* Station 3: Ready/Load (Locked) */}
                                                            <div className={`relative group`}>
                                                                {/* "Present to save data" means active. "Locked" status = Ready to load. */}
                                                                <div className={`w-3 h-3 rounded text-[8px] flex items-center justify-center border ${['LOADING_VERIFICATION_PENDING', 'COMPLETED'].includes(s.status) ? 'bg-orange-500 border-orange-500 text-white' : s.status === 'LOCKED' ? 'bg-orange-600 border-orange-600 text-white shadow-sm' : 'bg-white border-slate-300 text-slate-300'}`}>
                                                                    <Plus size={8} strokeWidth={4} />
                                                                </div>
                                                                <span className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 text-[8px] font-bold text-slate-500 uppercase whitespace-nowrap">Ready</span>
                                                            </div>

                                                            {/* Station 4: Loading Check (Shift Lead) */}
                                                            <div className={`relative group`}>
                                                                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${s.status === 'COMPLETED' ? 'bg-green-600 border-green-600 text-white' : s.status === 'LOADING_VERIFICATION_PENDING' ? 'bg-white border-orange-500 text-orange-500 animate-pulse' : 'bg-white border-slate-300 text-slate-300'}`}>
                                                                    {s.status === 'COMPLETED' ? <CheckCircle size={10} /> : <Truck size={8} strokeWidth={3} />}
                                                                </div>
                                                                <span className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 text-[8px] font-bold text-slate-500 uppercase whitespace-nowrap">Verify</span>
                                                            </div>

                                                            {/* Station 5: End */}
                                                            <div className={`relative group`}>
                                                                <div className={`w-3 h-3 rounded-full border-2 ${s.status === 'COMPLETED' ? 'bg-green-600 border-green-600' : 'bg-white border-slate-300'}`}></div>
                                                                <span className="absolute -bottom-4 right-0 text-[8px] font-bold text-slate-500 uppercase whitespace-nowrap">Done</span>
                                                            </div>
                                                        </div>
                                                        <div className="h-2"></div>
                                                    </div>
                                                    <span className="text-[10px] font-bold text-slate-500 mt-1 block uppercase">{s.status.replace(/_/g, ' ').replace('VERIFICATION PENDING', 'VERIFY')}</span>
                                                </div>
                                                <div className="p-4 flex justify-center gap-2">
                                                    <button onClick={() => onViewSheet(s)} className="text-blue-600 hover:bg-blue-50 p-1 rounded"><Eye size={16} /></button>
                                                    {currentUser?.role === 'ADMIN' && <button onClick={(e) => handleDelete(e, s.id)} className="text-red-600 hover:bg-red-50 p-1 rounded"><Trash2 size={16} /></button>}
                                                </div>
                                            </div>
                                        ) : (
                                            // DURATION VIEW ROW
                                            <div key={s.id} className="grid grid-cols-[100px_120px_180px_180px_180px_180px_180px_100px_80px] items-center text-sm text-slate-700 hover:bg-slate-50">
                                                <div className="p-4 font-mono font-bold text-blue-600">{s.id}</div>
                                                <div className="p-4">{s.date}</div>
                                                <div className="p-4 text-xs font-mono">{s.createdAt ? new Date(s.createdAt).toLocaleString() : '-'}</div>
                                                <div className="p-4 text-xs font-mono text-emerald-700">{s.stagingApprovedAt ? new Date(s.stagingApprovedAt).toLocaleString() : '-'}</div>
                                                <div className="p-4 text-xs font-mono text-orange-700">{s.loadingApprovedAt ? new Date(s.loadingApprovedAt).toLocaleString() : '-'}</div>
                                                <div className="p-4 text-xs font-mono font-bold">{s.completedAt ? new Date(s.completedAt).toLocaleString() : '-'}</div>
                                                <div className="p-4 text-xs font-mono bg-slate-50 text-slate-500">
                                                    {s.createdAt && s.completedAt ?
                                                        (() => {
                                                            const diff = new Date(s.completedAt).getTime() - new Date(s.createdAt).getTime();
                                                            const hrs = Math.floor(diff / 3600000);
                                                            const mins = Math.floor((diff % 3600000) / 60000);
                                                            return `${hrs}h ${mins}m`;
                                                        })()
                                                        : '-'
                                                    }
                                                </div>
                                                <div className="p-4"><span className="px-2 py-1 bg-slate-100 rounded text-[10px] font-bold">{s.status}</span></div>
                                                <div className="p-4 flex justify-center gap-2">
                                                    <button onClick={() => onViewSheet(s)} className="text-blue-600 hover:bg-blue-50 p-1 rounded"><Eye size={16} /></button>
                                                </div>
                                            </div>
                                        )
                                    )) : <div className="p-12 text-center text-slate-400 italic">No records found.</div>}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return <div>Unknown View Mode</div>;
};
