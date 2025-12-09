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
    CheckCircle, XCircle, Key, UserPlus, Activity,
    FileSpreadsheet, Filter, CheckCircle2, History,
    LayoutDashboard, Settings, LogOut, ChevronLeft, ChevronRight,
    AlertCircle, Clock, Calendar, Edit, ShieldCheck,
    Minimize2, Maximize2, ChevronDown, CheckSquare, AlignJustify
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { widgetRegistry, getWidgetDefinition } from './widgets/WidgetRegistry';
import { AddWidgetModal } from './widgets/AddWidgetModal';

interface AdminDashboardProps {
    viewMode: 'analytics' | 'users' | 'database' | 'audit' | 'approvals';
    onViewSheet: (sheet: SheetData) => void;
    onNavigate?: (page: string) => void;
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

// Forced HMR Rebuild v2
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
            // Auto-migrate: If saved config exists but doesn't have incident-list, add it (for this update)
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

    const stats = useMemo(() => {
        const total = sheets.length;
        const completed = sheets.filter(s => s.status === SheetStatus.COMPLETED).length;
        const locked = sheets.filter(s => s.status === SheetStatus.LOCKED).length;
        const draft = sheets.filter(s => s.status === SheetStatus.DRAFT).length;

        // Daily Volume for Line Chart
        const volumeByDate: Record<string, number> = {};
        sheets.forEach(s => {
            const date = s.date || 'Unknown';
            volumeByDate[date] = (volumeByDate[date] || 0) + 1;
        });

        const lineData = Object.keys(volumeByDate).sort().map(date => ({
            date,
            count: volumeByDate[date]
        })).slice(-7);

        const barData = [
            { name: 'Completed', count: completed },
            { name: 'Locked', count: locked },
            { name: 'Drafts', count: draft }
        ];

        const pieData = [
            { name: 'Draft', value: draft, color: '#94a3b8' },
            { name: 'Locked', value: locked, color: '#f97316' },
            { name: 'Completed', value: completed, color: '#22c55e' }
        ];

        const isToday = (dateStr: string) => {
            if (!dateStr) return false;
            const today = new Date();
            const d = new Date(dateStr);
            if (dateStr === today.toISOString().split('T')[0]) return true;
            if (dateStr === today.toLocaleDateString()) return true;
            return !isNaN(d.getTime()) && d.toDateString() === today.toDateString();
        };

        const createdToday = sheets.filter(s => isToday(s.date)).length;
        const completedToday = sheets.filter(s => s.status === SheetStatus.COMPLETED && isToday(s.date)).length;

        const stagingStaff = users.filter(u => u.role === Role.STAGING_SUPERVISOR && u.isApproved).length;
        const loadingStaff = users.filter(u => u.role === Role.LOADING_SUPERVISOR && u.isApproved).length;
        const shiftLeads = users.filter(u => u.role === Role.SHIFT_LEAD && u.isApproved).length;

        const pendingStaging = sheets.filter(s => s.status === SheetStatus.STAGING_VERIFICATION_PENDING).length;
        const pendingLoading = sheets.filter(s => s.status === SheetStatus.LOADING_VERIFICATION_PENDING).length;

        return { total, completed, locked, draft, lineData, barData, pieData, createdToday, completedToday, stagingStaff, loadingStaff, shiftLeads, pendingStaging, pendingLoading };
    }, [sheets, users]);

    // --- EXCEL EXPORT ---
    const handleExportExcel = () => {
        const dataToExport = sheets.map(s => ({
            ID: s.id,
            Date: s.date,
            Status: s.status,
            Shift: s.shift,
            Supervisor: s.supervisorName,
            'Supervisor (Loading)': s.loadingSvName,
            Destination: s.destination,
            'Loading Dock': s.loadingDockNo,
            Transporter: s.transporter,
            'Vehicle No': s.vehicleNo,
            'Driver Name': s.driverName,
            'Start Time': s.loadingStartTime,
            'End Time': s.loadingEndTime,
            'Created By': s.createdBy,
            'Created At': s.createdAt ? new Date(s.createdAt).toLocaleString() : '',
            'Staging Approved By': s.stagingApprovedBy,
            'Staging Approved At': s.stagingApprovedAt ? new Date(s.stagingApprovedAt).toLocaleString() : '',
            'Loading Approved By': s.loadingApprovedBy,
            'Loading Approved At': s.loadingApprovedAt ? new Date(s.loadingApprovedAt).toLocaleString() : ''
        }));

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Operations_Data");
        XLSX.writeFile(wb, "Unicharm_Operations_Report.xlsx");
        alert("Excel Report Downloaded Successfully!");
    };

    if (isLoading) {
        return <div className="p-8 text-center text-gray-500 animate-pulse">Loading dashboard elements...</div>;
    }

    const handleDelete = (e: React.MouseEvent, id: string) => {
        e.preventDefault();
        e.stopPropagation();
        if (confirm("Are you sure you want to delete this sheet?")) {
            const reason = prompt("Enter reason for deletion:");
            if (reason) {
                deleteSheet(id, reason);
            }
        }
    };

    const handleUserDelete = (e: React.MouseEvent, id: string, username: string) => {
        e.preventDefault();
        e.stopPropagation();
        if (confirm(`Are you sure you want to permanently delete user "${username}"?`)) {
            deleteUser(id);
        }
    };

    const handleApprove = (e: React.MouseEvent, id: string) => {
        e.preventDefault();
        e.stopPropagation();
        approveUser(id, true);
    };

    const handleReject = (e: React.MouseEvent, id: string) => {
        e.preventDefault();
        e.stopPropagation();
        approveUser(id, false);
    };

    const handleCreateUserSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newUser.username || !newUser.password || !newUser.fullName || !newUser.empCode) {
            alert("All fields are required");
            return;
        }

        await register({
            id: Date.now().toString(),
            username: newUser.username,
            fullName: newUser.fullName,
            empCode: newUser.empCode,
            email: newUser.email,
            password: newUser.password,
            role: newUser.role,
            isApproved: true
        });

        setCreateUserOpen(false);
        setNewUser({ username: '', fullName: '', empCode: '', email: '', password: '', role: Role.STAGING_SUPERVISOR });
        alert('User created successfully.');
    };

    const openResetPassword = (e: React.MouseEvent, user: any) => {
        e.preventDefault();
        e.stopPropagation();
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

    const isAdmin = currentUser?.role === Role.ADMIN;
    const isShiftLead = currentUser?.role === Role.SHIFT_LEAD;
    const showStaging = isAdmin || isShiftLead || currentUser?.role === Role.STAGING_SUPERVISOR;
    const showLoading = isAdmin || isShiftLead || currentUser?.role === Role.LOADING_SUPERVISOR;
    const showApprovals = isAdmin || isShiftLead;

    // --- VIEW 1: ANALYTICS DASHBOARD ---
    if (viewMode === 'analytics') {
        const sortedWidgets = userWidgets
            .map(id => getWidgetDefinition(id))
            .filter(w => w !== undefined);

        return (
            <div className="space-y-6 pb-20">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <Activity className="text-blue-600" /> Operational Overview
                        </h2>
                        <p className="text-sm text-slate-500">ServiceNow-style customizable workspace</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleExportExcel}
                            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold shadow-lg shadow-green-200 transition-all hover:scale-105"
                        >
                            <FileSpreadsheet size={16} /> Export
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* COL 1: STAGING */}
                    {showStaging && (
                        <div
                            onClick={() => onNavigate?.('staging')}
                            className="bg-slate-50 p-5 rounded-xl border border-slate-200 cursor-pointer hover:bg-blue-50/50 transition-colors group relative overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
                            <div className="flex items-center gap-2 mb-4">
                                <div className="p-2 bg-blue-100 text-blue-600 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-colors"><Clipboard size={18} /></div>
                                <h3 className="font-bold text-slate-700">Staging Overview</h3>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-white p-3 rounded-lg shadow-sm border border-slate-100">
                                    <p className="text-[10px] uppercase font-bold text-slate-400">Drafts</p>
                                    <p className="text-xl font-bold text-slate-800">{stats.draft}</p>
                                </div>
                                <div className="bg-white p-3 rounded-lg shadow-sm border border-slate-100">
                                    <p className="text-[10px] uppercase font-bold text-slate-400">New Today</p>
                                    <p className="text-xl font-bold text-slate-800">{stats.createdToday}</p>
                                </div>
                                {!isShiftLead && (
                                    <div className="bg-white p-3 rounded-lg shadow-sm border border-slate-100 col-span-2">
                                        <p className="text-[10px] uppercase font-bold text-slate-400">Active Staff</p>
                                        <p className="text-xl font-bold text-slate-800 cursor-pointer hover:text-blue-600 hover:underline" onClick={(e) => { e.stopPropagation(); onNavigate?.('admin_STAGING_SUPERVISOR'); }}>
                                            {stats.stagingStaff}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* COL 2: LOADING */}
                    {showLoading && (
                        <div
                            onClick={() => onNavigate?.('loading')}
                            className="bg-slate-50 p-5 rounded-xl border border-slate-200 cursor-pointer hover:bg-orange-50/50 transition-colors group relative overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/5 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
                            <div className="flex items-center gap-2 mb-4">
                                <div className="p-2 bg-orange-100 text-orange-600 rounded-lg group-hover:bg-orange-600 group-hover:text-white transition-colors"><Truck size={18} /></div>
                                <h3 className="font-bold text-slate-700">Loading Overview</h3>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-white p-3 rounded-lg shadow-sm border border-slate-100">
                                    <p className="text-[10px] uppercase font-bold text-slate-400">Active</p>
                                    <p className="text-xl font-bold text-slate-800">{stats.locked}</p>
                                </div>
                                <div className="bg-white p-3 rounded-lg shadow-sm border border-slate-100">
                                    <p className="text-[10px] uppercase font-bold text-slate-400">Done Today</p>
                                    <p className="text-xl font-bold text-slate-800">{stats.completedToday}</p>
                                </div>
                                {!isShiftLead && (
                                    <div className="bg-white p-3 rounded-lg shadow-sm border border-slate-100 col-span-2">
                                        <p className="text-[10px] uppercase font-bold text-slate-400">Active Staff</p>
                                        <p className="text-xl font-bold text-slate-800 cursor-pointer hover:text-orange-600 hover:underline" onClick={(e) => { e.stopPropagation(); onNavigate?.('admin_LOADING_SUPERVISOR'); }}>
                                            {stats.loadingStaff}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* COL 2.5: APPROVALS */}
                    {showApprovals && (
                        <div
                            onClick={() => onNavigate?.('approvals')}
                            className="bg-slate-50 p-5 rounded-xl border border-slate-200 cursor-pointer hover:bg-purple-50/50 transition-colors group relative overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
                            <div className="flex items-center gap-2 mb-4">
                                <div className="p-2 bg-purple-100 text-purple-600 rounded-lg group-hover:bg-purple-600 group-hover:text-white transition-colors"><ShieldCheck size={18} /></div>
                                <h3 className="font-bold text-slate-700">Approvals Pending</h3>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-white p-3 rounded-lg shadow-sm border border-slate-100">
                                    <p className="text-[10px] uppercase font-bold text-slate-400">Staging</p>
                                    <p className="text-xl font-bold text-slate-800 text-orange-600">{stats.pendingStaging}</p>
                                </div>
                                <div className="bg-white p-3 rounded-lg shadow-sm border border-slate-100">
                                    <p className="text-[10px] uppercase font-bold text-slate-400">Loading</p>
                                    <p className="text-xl font-bold text-slate-800 text-blue-600">{stats.pendingLoading}</p>
                                </div>
                                {!isShiftLead && (
                                    <div className="bg-white p-3 rounded-lg shadow-sm border border-slate-100 col-span-2">
                                        <p className="text-[10px] uppercase font-bold text-slate-400">Shift Leads</p>
                                        <p className="text-xl font-bold text-slate-800 cursor-pointer hover:text-purple-600 hover:underline" onClick={(e) => { e.stopPropagation(); onNavigate?.('admin_SHIFT_LEAD'); }}>
                                            {stats.shiftLeads}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* COL 3: GLOBAL SUMMARY */}
                    <div className="space-y-4">
                        <div
                            onClick={() => (isAdmin || isShiftLead) && onNavigate?.('database')}
                            className={`bg-white p-4 rounded-xl shadow-sm border border-slate-200 transition-colors group ${(isAdmin || isShiftLead) ? 'cursor-pointer hover:border-blue-300 hover:shadow-md' : 'cursor-default'} flex items-center justify-between`}
                        >
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider group-hover:text-blue-500 transition-colors">Total Sheets</p>
                                <h3 className="text-2xl font-bold text-slate-800 mt-1">{stats.total}</h3>
                            </div>
                            <div className="p-3 bg-slate-50 rounded-lg text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors"><FileSpreadsheet size={20} /></div>
                        </div>

                        <div
                            onClick={() => (isAdmin || isShiftLead) && onNavigate?.('database?status=COMPLETED')}
                            className={`bg-white p-4 rounded-xl shadow-sm border border-slate-200 transition-colors group ${(isAdmin || isShiftLead) ? 'cursor-pointer hover:border-green-300 hover:shadow-md' : 'cursor-default'} flex items-center justify-between`}
                        >
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider group-hover:text-green-500 transition-colors">Completed</p>
                                <h3 className="text-2xl font-bold text-slate-800 mt-1">{stats.completed}</h3>
                            </div>
                            <div className="p-3 bg-slate-50 rounded-lg text-slate-400 group-hover:bg-green-50 group-hover:text-green-600 transition-colors"><CheckCircle2 size={20} /></div>
                        </div>
                    </div>
                </div>

                {/* WIDGET GRID (ADMIN ONLY) */}
                {currentUser?.role === Role.ADMIN && sortedWidgets.length > 0 && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {sortedWidgets.map((def, idx) => {
                            if (!def) return null;
                            const WidgetComponent = def.component;
                            const colSpan = def.defaultSize === 'large' || def.defaultSize === 'full' ? 'lg:col-span-2' : '';

                            return (
                                <div key={def.id} className={`bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative group hover:shadow-md transition-shadow ${colSpan}`}>
                                    <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3">
                                        <div>
                                            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide flex items-center gap-2">
                                                {def.title}
                                            </h3>
                                            <p className="text-[10px] text-slate-400">{def.description}</p>
                                        </div>
                                        <div className="relative">
                                            <button className="text-slate-300 hover:text-slate-600 transition-colors p-1" onClick={() => handleRemoveWidget(def.id)}>
                                                <X size={16} />
                                            </button>
                                        </div>
                                    </div>
                                    <WidgetComponent onNavigate={onNavigate} />
                                </div>
                            );
                        })}
                    </div>
                )}

                <AddWidgetModal
                    isOpen={isAddWidgetOpen}
                    onClose={() => setAddWidgetOpen(false)}
                    onAdd={handleAddWidget}
                    activeWidgets={userWidgets}
                />
            </div>
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
                    <button onClick={() => onNavigate?.('dashboard')} className="mt-6 text-blue-600 hover:text-blue-800 font-medium">Return to Dashboard</button>
                </div>
            );
        }

        const filteredUsers = users
            .filter(u => {
                const searchMatch = u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    (u.fullName && u.fullName.toLowerCase().includes(searchTerm.toLowerCase()));
                const roleMatch = filterRole === 'ALL' || u.role === filterRole;

                if (currentUser?.role === Role.ADMIN) return searchMatch && roleMatch;
                if (currentUser?.role === Role.STAGING_SUPERVISOR) return searchMatch && u.role === Role.STAGING_SUPERVISOR;
                if (currentUser?.role === Role.LOADING_SUPERVISOR) return searchMatch && u.role === Role.LOADING_SUPERVISOR;
                if (currentUser?.role === Role.SHIFT_LEAD) return searchMatch;
                return false;
            })
            .sort((a, b) => {
                if (sortConfig) {
                    const { key, direction } = sortConfig;
                    const valA = a[key as keyof typeof a];
                    const valB = b[key as keyof typeof b];
                    if (typeof valA === 'boolean' && typeof valB === 'boolean') {
                        return direction === 'asc' ? (valA === valB ? 0 : valA ? 1 : -1) : (valA === valB ? 0 : valA ? -1 : 1);
                    }
                    const strA = String(valA || '').toLowerCase();
                    const strB = String(valB || '').toLowerCase();
                    const comparison = strA.localeCompare(strB, undefined, { numeric: true });
                    return direction === 'asc' ? comparison : -comparison;
                }
                return (a.isApproved === b.isApproved) ? 0 : !a.isApproved ? -1 : 1;
            });

        return (
            <div className="space-y-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                    <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
                        <div>
                            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2"><UserIcon className="text-blue-600" /> User Administration</h2>
                            <p className="text-sm text-gray-500">Manage staff and permissions.</p>
                        </div>
                        {currentUser?.role === Role.ADMIN && (
                            <div className="flex flex-wrap bg-slate-100 p-1 rounded-lg">
                                {[
                                    { r: 'ALL', l: 'All', i: null, c: 'text-slate-800', bg: 'bg-white' },
                                    { r: Role.STAGING_SUPERVISOR, l: 'Staging', i: Clipboard, c: 'text-blue-700', bg: 'bg-white' },
                                    { r: Role.LOADING_SUPERVISOR, l: 'Loading', i: Truck, c: 'text-orange-700', bg: 'bg-white' },
                                    { r: Role.ADMIN, l: 'Admin', i: ShieldAlert, c: 'text-purple-700', bg: 'bg-white' },
                                    { r: Role.SHIFT_LEAD, l: 'Shift Lead', i: ShieldCheck, c: 'text-emerald-700', bg: 'bg-white' }
                                ].map((tab) => (
                                    <button
                                        key={tab.r}
                                        onClick={() => setFilterRole(tab.r as any)}
                                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${filterRole === tab.r ? `${tab.bg} ${tab.c} shadow-sm` : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        {tab.i && <tab.i size={14} />} {tab.l}
                                    </button>
                                ))}
                            </div>
                        )}
                        <div className="flex items-center gap-3">
                            {currentUser?.role === Role.ADMIN && (
                                <button onClick={() => setCreateUserOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors shadow-lg shadow-blue-200">
                                    <UserPlus size={16} /> Add User
                                </button>
                            )}
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                                <input
                                    type="text"
                                    placeholder="Search users..."
                                    className="pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50 transition-all w-full sm:w-64"
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="overflow-hidden rounded-lg border border-slate-200 shadow-sm bg-white">
                        <div className="grid grid-cols-[1.5fr_1.5fr_1fr_1.5fr_1fr_120px] bg-slate-800 text-white font-bold text-xs uppercase divide-x divide-slate-700">
                            {['username', 'fullName', 'role', 'email', 'isApproved'].map((k) => (
                                <div key={k} className="p-4 flex items-center gap-2 cursor-pointer hover:bg-slate-700 transition-colors" onClick={() => handleSort(k)}>
                                    {k.charAt(0).toUpperCase() + k.slice(1)} <ArrowUpDown size={14} className={sortConfig?.key === k ? 'text-blue-400 opacity-100' : 'text-white opacity-30'} />
                                </div>
                            ))}
                            <div className="p-4 flex items-center justify-center text-gray-300">Actions</div>
                        </div>
                        <div className="divide-y divide-slate-100">
                            {filteredUsers.map((user) => (
                                <div key={user.id} className="grid grid-cols-[1.5fr_1.5fr_1fr_1.5fr_1fr_120px] hover:bg-slate-50 transition-colors items-center text-sm text-slate-700">
                                    <div className="p-4 font-bold text-slate-800">{user.username}</div>
                                    <div className="p-4">
                                        <div className="font-medium">{user.fullName}</div>
                                        <div className="text-xs text-slate-400">{user.empCode || 'N/A'}</div>
                                    </div>
                                    <div className="p-4">
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold
                                            ${user.role === Role.ADMIN ? 'bg-purple-100 text-purple-700' :
                                                user.role === Role.STAGING_SUPERVISOR ? 'bg-blue-100 text-blue-700' :
                                                    user.role === Role.LOADING_SUPERVISOR ? 'bg-orange-100 text-orange-700' :
                                                        'bg-slate-100 text-slate-600'}`}>
                                            {user.role}
                                        </span>
                                    </div>
                                    <div className="p-4 text-slate-500 truncate" title={user.email}>{user.email || '-'}</div>
                                    <div className="p-4 flex justify-center">
                                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${user.isApproved ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                            {user.isApproved ? 'Active' : 'Pending'}
                                        </span>
                                    </div>
                                    <div className="p-4 flex justify-center gap-2">
                                        {!user.isApproved ? (
                                            <>
                                                <button onClick={(e) => handleApprove(e, user.id)} className="text-green-600 hover:bg-green-100 p-1.5 rounded"><CheckCircle size={16} /></button>
                                                <button onClick={(e) => handleReject(e, user.id)} className="text-red-600 hover:bg-red-100 p-1.5 rounded"><XCircle size={16} /></button>
                                            </>
                                        ) : (
                                            <>
                                                {(user.id === currentUser?.id || currentUser?.role === Role.ADMIN) && (
                                                    <button onClick={(e) => openResetPassword(e, user)} className="text-blue-600 hover:bg-blue-100 p-1.5 rounded"><Key size={16} /></button>
                                                )}
                                                {currentUser?.role === Role.ADMIN && (
                                                    <button onClick={(e) => handleUserDelete(e, user.id, user.username)} className="text-red-600 hover:bg-red-100 p-1.5 rounded"><Trash2 size={16} /></button>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {filteredUsers.length === 0 && <div className="p-12 text-center text-slate-400 italic">No users found.</div>}
                        </div>
                    </div>
                </div>

                {/* Modals for Create User and Reset Password would go here (simplified for space) */}
                {isCreateUserOpen && (
                    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all scale-100">
                            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                <h3 className="font-bold text-slate-800 flex items-center gap-2"><UserPlus size={20} className="text-blue-600" /> Create New User</h3>
                                <button onClick={() => setCreateUserOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors bg-white rounded-full p-1 hover:bg-slate-200"><X size={20} /></button>
                            </div>
                            <form onSubmit={handleCreateUserSubmit} className="p-6 space-y-5">
                                <input type="text" required className="w-full px-4 py-2.5 border rounded-lg text-sm" placeholder="Username" value={newUser.username} onChange={e => setNewUser({ ...newUser, username: e.target.value })} />
                                <input type="text" required className="w-full px-4 py-2.5 border rounded-lg text-sm" placeholder="Full Name" value={newUser.fullName} onChange={e => setNewUser({ ...newUser, fullName: e.target.value })} />
                                <input type="email" className="w-full px-4 py-2.5 border rounded-lg text-sm" placeholder="Email (Optional)" value={newUser.email || ''} onChange={e => setNewUser({ ...newUser, email: e.target.value })} />
                                <div className="grid grid-cols-2 gap-4">
                                    <input type="text" required className="w-full px-4 py-2.5 border rounded-lg text-sm" placeholder="Emp Code" value={newUser.empCode} onChange={e => setNewUser({ ...newUser, empCode: e.target.value })} />
                                    <input type="password" required className="w-full px-4 py-2.5 border rounded-lg text-sm" placeholder="Password" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} />
                                </div>
                                <select className="w-full px-4 py-2.5 border rounded-lg text-sm" value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value as Role })}>
                                    <option value={Role.STAGING_SUPERVISOR}>Staging Supervisor</option>
                                    <option value={Role.LOADING_SUPERVISOR}>Loading Supervisor</option>
                                    <option value={Role.SHIFT_LEAD}>Shift Lead</option>
                                    <option value={Role.ADMIN}>Administrator</option>
                                </select>
                                <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-lg">Create User</button>
                            </form>
                        </div>
                    </div>
                )}
                {isResetPasswordOpen && resetData && (
                    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
                            <div className="p-5 border-b flex justify-between items-center"><h3 className="font-bold flex gap-2"><Key size={20} /> Reset Password</h3><button onClick={() => setResetPasswordOpen(false)}><X size={20} /></button></div>
                            <form onSubmit={handleResetPasswordSubmit} className="p-6 space-y-5">
                                <div className="bg-orange-50 p-3 rounded-lg"><p className="text-sm text-orange-800">For: <span className="font-bold">{resetData.username}</span></p></div>
                                <input type="text" required className="w-full px-4 py-2.5 border rounded-lg font-mono" placeholder="New Password" value={resetData.newPass} onChange={e => setResetData({ ...resetData, newPass: e.target.value })} />
                                <button type="submit" className="w-full bg-orange-600 text-white font-bold py-3 rounded-xl shadow-lg">Update Password</button>
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

    // --- VIEW 4: DATABASE PANEL ---
    if (viewMode === 'database') {
        const isAdmin = currentUser?.role === Role.ADMIN;
        const isShiftLead = currentUser?.role === Role.SHIFT_LEAD;

        const urlParams = new URLSearchParams(window.location.search);
        const statusFilter = urlParams.get('status');

        if (!isAdmin && !isShiftLead) {
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

            const matchesStatus = !statusFilter || statusFilter === 'ALL' || s.status === statusFilter;
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

        // Simplified columns logic for "Created By/At" and "Approved By/At"
        return (
            <div className="space-y-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                    <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
                        <div>
                            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2"><Database className="text-blue-600" /> Database Management</h2>
                            <p className="text-sm text-gray-500">View and manage all system data.</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                            <button onClick={handleExportExcel} className="flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-lg shadow-sm transition-all text-sm font-medium">
                                <Download size={16} /> Export All
                            </button>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                                <input type="text" placeholder="Search sheets..." className="pl-10 pr-10 py-2.5 border rounded-lg text-sm w-full sm:min-w-[240px]" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                                {searchTerm && <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"><X size={14} /></button>}
                            </div>
                        </div>
                    </div>

                    {(searchTerm || statusFilter) && (
                        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6 rounded-r-lg flex items-center justify-between animate-fade-in">
                            <div className="flex items-center gap-2">
                                <Search size={16} className="text-blue-600" />
                                <span className="text-sm text-blue-900 font-medium">Filtering by Status: <span className="font-bold">{statusFilter || 'ALL'}</span> {searchTerm && <>and Search: <span className="font-bold">"{searchTerm}"</span></>}</span>
                            </div>
                            <button onClick={() => setSearchTerm('')} className="text-xs text-blue-600 hover:text-blue-800 font-bold underline px-2">Clear</button>
                        </div>
                    )}

                    <div className="overflow-hidden rounded-lg border border-slate-200 shadow-sm bg-white overflow-x-auto">
                        <div className="min-w-[1600px]">
                            <div className="grid grid-cols-[100px_100px_120px_120px_120px_180px_180px_180px_180px_100px_80px] bg-slate-800 text-white font-bold text-xs uppercase divide-x divide-slate-700 border-b border-slate-600">
                                <div className="p-4" onClick={() => handleSort('id')}>ID</div>
                                <div className="p-4" onClick={() => handleSort('date')}>Date</div>
                                <div className="p-4" onClick={() => handleSort('supervisorName')}>Staging SV</div>
                                <div className="p-4" onClick={() => handleSort('loadingSvName')}>Loading SV</div>
                                <div className="p-4" onClick={() => handleSort('createdBy')}>Created By</div>
                                <div className="p-4" onClick={() => handleSort('createdAt')}>Created At</div>
                                <div className="p-4" onClick={() => handleSort('stagingApprovedBy')}>Stg Appr By</div>
                                <div className="p-4" onClick={() => handleSort('stagingApprovedAt')}>Stg Appr At</div>
                                <div className="p-4" onClick={() => handleSort('loadingApprovedBy')}>Ldg Appr By</div>
                                <div className="p-4" onClick={() => handleSort('status')}>Status</div>
                                <div className="p-4 text-center">Actions</div>
                            </div>

                            <div className="divide-y divide-slate-100">
                                {filteredSheets.length > 0 ? filteredSheets.map((s) => (
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
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${s.status === 'COMPLETED' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                                                {s.status}
                                            </span>
                                        </div>
                                        <div className="p-4 flex justify-center gap-2">
                                            <button onClick={() => onViewSheet(s)} className="text-blue-600 hover:bg-blue-50 p-1 rounded"><Eye size={16} /></button>
                                            {currentUser?.role === 'ADMIN' && <button onClick={(e) => handleDelete(e, s.id)} className="text-red-600 hover:bg-red-50 p-1 rounded"><Trash2 size={16} /></button>}
                                        </div>
                                    </div>
                                )) : <div className="p-12 text-center text-slate-400 italic">No records found.</div>}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // --- VIEW 5: APPROVALS PANEL ---
    if (viewMode === 'approvals') {
        const pendingStaging = sheets.filter(s => s.status === SheetStatus.STAGING_VERIFICATION_PENDING);
        const pendingLoading = sheets.filter(s => s.status === SheetStatus.LOADING_VERIFICATION_PENDING);

        return (
            <div className="space-y-8 pb-20">
                <div className="flex items-center gap-4 bg-white p-6 rounded-xl border border-purple-100 shadow-sm">
                    <div className="p-3 bg-purple-100 text-purple-600 rounded-lg"><ShieldCheck size={24} /></div>
                    <div><h2 className="text-2xl font-bold text-slate-800">Approvals Pending</h2><p className="text-slate-500">Review and verify operational sheets.</p></div>
                </div>

                <div>
                    <h3 className="text-lg font-bold text-slate-700 mb-4 flex items-center gap-2"><Clipboard className="text-blue-500" /> Staging Sheets ({pendingStaging.length})</h3>
                    {pendingStaging.length > 0 ? (
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {pendingStaging.map(sheet => (
                                <div key={sheet.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
                                    <div className="flex justify-between items-start mb-3"><span className="font-mono text-xs font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded">{sheet.id}</span><span className="text-xs font-semibold text-slate-500">{sheet.date}</span></div>
                                    <p className="text-sm font-medium text-slate-700 mb-4">Supervisor: <span className="font-bold">{sheet.supervisorName}</span></p>
                                    <button onClick={() => onViewSheet(sheet)} className="w-full bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white py-2 rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-2">Review Sheet <ChevronRight size={16} /></button>
                                </div>
                            ))}
                        </div>
                    ) : <div className="p-8 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-center text-slate-400">No staging sheets pending approval.</div>}
                </div>

                <div>
                    <h3 className="text-lg font-bold text-slate-700 mb-4 flex items-center gap-2"><Truck className="text-orange-500" /> Loading Sheets ({pendingLoading.length})</h3>
                    {pendingLoading.length > 0 ? (
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {pendingLoading.map(sheet => (
                                <div key={sheet.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
                                    <div className="flex justify-between items-start mb-3"><span className="font-mono text-xs font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded">{sheet.id}</span><span className="text-xs font-semibold text-slate-500">{sheet.date}</span></div>
                                    <p className="text-sm font-medium text-slate-700 mb-4">Loading Sv: <span className="font-bold">{sheet.loadingSvName}</span></p>
                                    <button onClick={() => onViewSheet(sheet)} className="w-full bg-orange-50 text-orange-600 hover:bg-orange-600 hover:text-white py-2 rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-2">Review Sheet <ChevronRight size={16} /></button>
                                </div>
                            ))}
                        </div>
                    ) : <div className="p-8 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-center text-slate-400">No loading sheets pending approval.</div>}
                </div>
            </div>
        );
    }

    return <div>Unknown View Mode</div>;
};
