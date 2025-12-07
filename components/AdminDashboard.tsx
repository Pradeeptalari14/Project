
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
    FileSpreadsheet, Filter, CheckCircle2, History
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { widgetRegistry, getWidgetDefinition } from './widgets/WidgetRegistry';
import { AddWidgetModal } from './widgets/AddWidgetModal';
import { PlusCircle, MoreHorizontal, Settings2 } from 'lucide-react';

interface AdminDashboardProps {
    viewMode: 'analytics' | 'users' | 'database' | 'audit';
    onViewSheet: (sheet: SheetData) => void;
    onNavigate?: (page: string) => void;
    initialSearch?: string;
}

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
        role: Role.VIEWER
    });

    // Reset Password State
    const [isResetPasswordOpen, setResetPasswordOpen] = useState(false);
    const [resetData, setResetData] = useState<{ id: string, username: string, newPass: string } | null>(null);

    // --- WIDGET SYSTEM STATE ---
    // Persist preferences to LocalStorage keyed by username
    const [userWidgets, setUserWidgets] = useState<string[]>(() => {
        if (!currentUser?.username) return ['staff-performance', 'sla-monitor'];
        try {
            const saved = localStorage.getItem(`unicharm_widgets_${currentUser.username}`);
            return saved ? JSON.parse(saved) : ['staff-performance', 'sla-monitor'];
        } catch (e) {
            console.error("Failed to parse widget preferences", e);
            return ['staff-performance', 'sla-monitor'];
        }
    });
    const [isAddWidgetOpen, setAddWidgetOpen] = useState(false);

    // Sort State
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

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
            localStorage.setItem(`unicharm_widgets_${currentUser.username}`, JSON.stringify(userWidgets));
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
        })).slice(-7); // Last 7 days/entries

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

        // Advanced Stats

        // Helper to check if a date string is today (handles ISO YYYY-MM-DD and Locale formats)
        const isToday = (dateStr: string) => {
            if (!dateStr) return false;
            const today = new Date();
            const d = new Date(dateStr);

            // Check exact string matches first for speed
            if (dateStr === today.toISOString().split('T')[0]) return true;
            if (dateStr === today.toLocaleDateString()) return true;

            // Check date components (robust fallback)
            return !isNaN(d.getTime()) && d.toDateString() === today.toDateString();
        };

        const createdToday = sheets.filter(s => isToday(s.date)).length;
        const completedToday = sheets.filter(s => s.status === SheetStatus.COMPLETED && isToday(s.date)).length;

        const stagingStaff = users.filter(u => u.role === Role.STAGING_SUPERVISOR && u.isApproved).length;
        const loadingStaff = users.filter(u => u.role === Role.LOADING_SUPERVISOR && u.isApproved).length;

        return { total, completed, locked, draft, lineData, barData, pieData, createdToday, completedToday, stagingStaff, loadingStaff };
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
            'Created At': s.createdAt ? new Date(s.createdAt).toLocaleString() : ''
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
            id: Date.now().toString(), // Will be superseded by Supabase ID
            username: newUser.username,
            fullName: newUser.fullName,
            empCode: newUser.empCode,
            email: newUser.email,
            password: newUser.password,
            role: newUser.role,
            isApproved: true // Auto-approve admin created users
        });

        setCreateUserOpen(false);
        setNewUser({ username: '', fullName: '', empCode: '', email: '', password: '', role: Role.VIEWER });
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
    const showStaging = isAdmin || currentUser?.role === Role.STAGING_SUPERVISOR;
    const showLoading = isAdmin || currentUser?.role === Role.LOADING_SUPERVISOR;

    // --- VIEW 1: ANALYTICS DASHBOARD (Monitoring) ---
    if (viewMode === 'analytics') {
        const sortedWidgets = userWidgets
            .map(id => getWidgetDefinition(id))
            .filter(w => w !== undefined);

        return (
            <div className="space-y-6 pb-20">
                {/* Dashboard Header / Toolbar */}
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

                {/* --- MAIN DASHBOARD GRID (3 Columns) --- */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* COL 1: STAGING OVERVIEW */}
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
                                <div className="bg-white p-3 rounded-lg shadow-sm border border-slate-100 col-span-2">
                                    <p className="text-[10px] uppercase font-bold text-slate-400">Active Staff</p>
                                    <p
                                        className="text-xl font-bold text-slate-800 cursor-pointer hover:text-blue-600 hover:underline"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onNavigate?.('admin_STAGING_SUPERVISOR');
                                        }}
                                    >
                                        {stats.stagingStaff}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* COL 2: LOADING OVERVIEW */}
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
                                <div className="bg-white p-3 rounded-lg shadow-sm border border-slate-100 col-span-2">
                                    <p className="text-[10px] uppercase font-bold text-slate-400">Active Staff</p>
                                    <p
                                        className="text-xl font-bold text-slate-800 cursor-pointer hover:text-orange-600 hover:underline"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onNavigate?.('admin_LOADING_SUPERVISOR');
                                        }}
                                    >
                                        {stats.loadingStaff}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* COL 3: GLOBAL SUMMARY (Merged KPIs) */}
                    <div className="space-y-4">
                        <div
                            onClick={() => isAdmin && onNavigate?.('database')}
                            className={`bg-white p-4 rounded-xl shadow-sm border border-slate-200 transition-colors group ${isAdmin ? 'cursor-pointer hover:border-blue-300 hover:shadow-md' : 'cursor-default'} flex items-center justify-between`}
                        >
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider group-hover:text-blue-500 transition-colors">Total Sheets</p>
                                <h3 className="text-2xl font-bold text-slate-800 mt-1">{stats.total}</h3>
                            </div>
                            <div className="p-3 bg-slate-50 rounded-lg text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors"><FileSpreadsheet size={20} /></div>
                        </div>

                        <div
                            onClick={() => isAdmin && onNavigate?.('database')}
                            className={`bg-white p-4 rounded-xl shadow-sm border border-slate-200 transition-colors group ${isAdmin ? 'cursor-pointer hover:border-green-300 hover:shadow-md' : 'cursor-default'} flex items-center justify-between`}
                        >
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider group-hover:text-green-500 transition-colors">Completed</p>
                                <h3 className="text-2xl font-bold text-slate-800 mt-1">{stats.completed}</h3>
                            </div>
                            <div className="p-3 bg-slate-50 rounded-lg text-slate-400 group-hover:bg-green-50 group-hover:text-green-600 transition-colors"><CheckCircle2 size={20} /></div>
                        </div>
                    </div>
                </div>

                {/* --- WIDGET GRID (ServiceNow Style) - ADMIN ONLY --- */}
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
                                            <button
                                                className="text-slate-300 hover:text-slate-600 transition-colors p-1"
                                                onClick={() => handleRemoveWidget(def.id)}
                                            >
                                                <X size={16} />
                                            </button>
                                        </div>
                                    </div>
                                    <WidgetComponent />
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Add Widget Modal */}
                <AddWidgetModal
                    isOpen={isAddWidgetOpen}
                    onClose={() => setAddWidgetOpen(false)}
                    onAdd={handleAddWidget}
                    activeWidgets={userWidgets}
                />
            </div>
        );
    }

    // Moved to top: const [filterRole, setFilterRole] = useState<Role | 'ALL'>('ALL');

    // --- VIEW 2: USERS PANEL ---
    if (viewMode === 'users') {
        const filteredUsers = users
            .filter(u => {
                const searchMatch = u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    (u.fullName && u.fullName.toLowerCase().includes(searchTerm.toLowerCase()));

                // Role Filter (Tabs)
                const roleMatch = filterRole === 'ALL' || u.role === filterRole;

                // STRICT ROLE SEGREGATION (Security)
                if (currentUser?.role === Role.ADMIN) return searchMatch && roleMatch; // Admin sees all (filtered by tabs)
                if (currentUser?.role === Role.STAGING_SUPERVISOR) {
                    return searchMatch && u.role === Role.STAGING_SUPERVISOR; // Staging sees Staging
                }
                if (currentUser?.role === Role.LOADING_SUPERVISOR) {
                    return searchMatch && u.role === Role.LOADING_SUPERVISOR; // Loading sees Loading
                }
                return false;
            })
            .sort((a, b) => {
                // 1. Dynamic Sort (User Clicked Header)
                if (sortConfig) {
                    const { key, direction } = sortConfig;
                    const valA = a[key as keyof typeof a];
                    const valB = b[key as keyof typeof b];

                    if (typeof valA === 'boolean' && typeof valB === 'boolean') {
                        // Boolean Sort (e.g. Status)
                        return direction === 'asc' ? (valA === valB ? 0 : valA ? 1 : -1) : (valA === valB ? 0 : valA ? -1 : 1);
                    }

                    const strA = String(valA || '').toLowerCase();
                    const strB = String(valB || '').toLowerCase();
                    const comparison = strA.localeCompare(strB, undefined, { numeric: true });
                    return direction === 'asc' ? comparison : -comparison;
                }

                // 2. Default Sort: Pending Users First
                return (a.isApproved === b.isApproved) ? 0 : !a.isApproved ? -1 : 1;
            });

        return (
            <div className="space-y-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                    <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
                        <div>
                            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                <UserIcon className="text-blue-600" /> User Administration
                            </h2>
                            <p className="text-sm text-gray-500">Manage staff and permissions.</p>
                        </div>

                        {/* Role Filter Tabs (Admin Only) */}
                        {currentUser?.role === Role.ADMIN && (
                            <div className="flex bg-slate-100 p-1 rounded-lg">
                                <button
                                    onClick={() => setFilterRole('ALL')}
                                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${filterRole === 'ALL' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    All
                                </button>
                                <button
                                    onClick={() => setFilterRole(Role.STAGING_SUPERVISOR)}
                                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${filterRole === Role.STAGING_SUPERVISOR ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-blue-600'}`}
                                >
                                    <Clipboard size={14} /> Staging
                                </button>
                                <button
                                    onClick={() => setFilterRole(Role.LOADING_SUPERVISOR)}
                                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${filterRole === Role.LOADING_SUPERVISOR ? 'bg-white text-orange-700 shadow-sm' : 'text-slate-500 hover:text-orange-600'}`}
                                >
                                    <Truck size={14} /> Loading
                                </button>
                                <button
                                    onClick={() => setFilterRole(Role.ADMIN)}
                                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${filterRole === Role.ADMIN ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-500 hover:text-purple-600'}`}
                                >
                                    <ShieldAlert size={14} /> Admin
                                </button>
                            </div>
                        )}

                        <div className="flex items-center gap-3">
                            {currentUser?.role === Role.ADMIN && (
                                <button
                                    onClick={() => setCreateUserOpen(true)}
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors shadow-lg shadow-blue-200"
                                >
                                    <UserPlus size={16} /> Add User
                                </button>
                            )}
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                                <input
                                    type="text"
                                    placeholder="Search users..."
                                    className="pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50 transition-all w-64"
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="overflow-hidden rounded-lg border border-slate-200 shadow-sm bg-white">
                        {/* Grid Header */}
                        <div className="grid grid-cols-[1.5fr_1.5fr_1fr_1.5fr_1fr_120px] bg-slate-800 text-white font-bold text-xs uppercase divide-x divide-slate-700">
                            <div
                                className="p-4 flex items-center gap-2 cursor-pointer hover:bg-slate-700 transition-colors"
                                onClick={() => handleSort('username')}
                            >
                                User <ArrowUpDown size={14} className={sortConfig?.key === 'username' ? 'text-blue-400 opacity-100' : 'text-white opacity-30'} />
                            </div>
                            <div
                                className="p-4 flex items-center gap-2 cursor-pointer hover:bg-slate-700 transition-colors"
                                onClick={() => handleSort('fullName')}
                            >
                                Full Name <ArrowUpDown size={14} className={sortConfig?.key === 'fullName' ? 'text-blue-400 opacity-100' : 'text-white opacity-30'} />
                            </div>
                            <div
                                className="p-4 flex items-center gap-2 cursor-pointer hover:bg-slate-700 transition-colors"
                                onClick={() => handleSort('role')}
                            >
                                Role <ArrowUpDown size={14} className={sortConfig?.key === 'role' ? 'text-blue-400 opacity-100' : 'text-white opacity-30'} />
                            </div>
                            <div className="p-4 flex items-center text-gray-300">
                                Email
                            </div>
                            <div
                                className="p-4 flex items-center justify-center gap-2 cursor-pointer hover:bg-slate-700 transition-colors"
                                onClick={() => handleSort('isApproved')}
                            >
                                Status <ArrowUpDown size={14} className={sortConfig?.key === 'isApproved' ? 'text-blue-400 opacity-100' : 'text-white opacity-30'} />
                            </div>
                            <div className="p-4 flex items-center justify-center text-gray-300">
                                Actions
                            </div>
                        </div>

                        {/* Grid Body */}
                        <div className="divide-y divide-slate-100">
                            {filteredUsers.length > 0 ? (
                                filteredUsers.map((user) => (
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
                                                {user.role === Role.STAGING_SUPERVISOR && <Clipboard size={12} />}
                                                {user.role === Role.LOADING_SUPERVISOR && <Truck size={12} />}
                                                {user.role === Role.ADMIN && <ShieldAlert size={12} />}
                                                {user.role}
                                            </span>
                                        </div>
                                        <div className="p-4 text-slate-500 truncate" title={user.email}>{user.email || '-'}</div>
                                        <div className="p-4 flex justify-center">
                                            <span className={`px-2 py-0.5 rounded text-xs font-bold
                                                ${user.isApproved ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                {user.isApproved ? 'Active' : 'Pending'}
                                            </span>
                                        </div>
                                        <div className="p-4 flex justify-center gap-2">
                                            {!user.isApproved ? (
                                                <>
                                                    <button onClick={(e) => handleApprove(e, user.id)} className="text-green-600 hover:bg-green-100 p-1.5 rounded" title="Approve">
                                                        <CheckCircle size={16} />
                                                    </button>
                                                    <button onClick={(e) => handleReject(e, user.id)} className="text-red-600 hover:bg-red-100 p-1.5 rounded" title="Reject">
                                                        <XCircle size={16} />
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    {(user.id === currentUser?.id || currentUser?.role === Role.ADMIN) && (
                                                        <button onClick={(e) => openResetPassword(e, user)} className="text-blue-600 hover:bg-blue-100 p-1.5 rounded" title="Change Password">
                                                            <Key size={16} />
                                                        </button>
                                                    )}
                                                    {currentUser?.role === Role.ADMIN && (
                                                        <button onClick={(e) => handleUserDelete(e, user.id, user.username)} className="text-red-600 hover:bg-red-100 p-1.5 rounded" title="Delete User">
                                                            <Trash2 size={16} />
                                                        </button>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="p-12 text-center text-slate-400 italic">No users found matching your search.</div>
                            )}
                        </div>
                    </div>

                    {/* Create User Modal */}
                    {isCreateUserOpen && (
                        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
                            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all scale-100">
                                <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                    <h3 className="font-bold text-slate-800 flex items-center gap-2"><UserPlus size={20} className="text-blue-600" /> Create New User</h3>
                                    <button onClick={() => setCreateUserOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors bg-white rounded-full p-1 hover:bg-slate-200"><X size={20} /></button>
                                </div>
                                <form onSubmit={handleCreateUserSubmit} className="p-6 space-y-5">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Username</label>
                                        <input
                                            type="text"
                                            required
                                            className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                                            placeholder="jdoe"
                                            value={newUser.username}
                                            onChange={e => setNewUser({ ...newUser, username: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Full Name</label>
                                        <input
                                            type="text"
                                            required
                                            className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                                            placeholder="John Doe"
                                            value={newUser.fullName}
                                            onChange={e => setNewUser({ ...newUser, fullName: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Email (Optional)</label>
                                        <input
                                            type="email"
                                            className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                                            placeholder="john@example.com"
                                            value={newUser.email || ''}
                                            onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Emp Code</label>
                                            <input
                                                type="text"
                                                required
                                                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                                                placeholder="E12345"
                                                value={newUser.empCode}
                                                onChange={e => setNewUser({ ...newUser, empCode: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Password</label>
                                            <input
                                                type="password"
                                                required
                                                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                                                placeholder="••••••••"
                                                value={newUser.password}
                                                onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Role Assignment</label>
                                        <select
                                            className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 bg-white transition-all cursor-pointer"
                                            value={newUser.role}
                                            onChange={e => setNewUser({ ...newUser, role: e.target.value as Role })}
                                        >
                                            <option value={Role.STAGING_SUPERVISOR}>Staging Supervisor</option>
                                            <option value={Role.LOADING_SUPERVISOR}>Loading Supervisor</option>
                                            <option value={Role.ADMIN}>Administrator</option>
                                            <option value={Role.VIEWER}>Viewer</option>
                                        </select>
                                    </div>
                                    <div className="pt-4">
                                        <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-200 transition-all active:scale-[0.98]">
                                            Create User
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}

                    {/* Reset Password Modal (Admin) */}
                    {isResetPasswordOpen && resetData && (
                        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
                            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all">
                                <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                    <h3 className="font-bold text-slate-800 flex items-center gap-2"><Key size={20} className="text-orange-600" /> Reset Password</h3>
                                    <button onClick={() => setResetPasswordOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors bg-white rounded-full p-1 hover:bg-slate-200"><X size={20} /></button>
                                </div>
                                <form onSubmit={handleResetPasswordSubmit} className="p-6 space-y-5">
                                    <div className="bg-orange-50 p-3 rounded-lg border border-orange-100">
                                        <p className="text-sm text-orange-800">Resetting password for: <span className="font-bold">{resetData.username}</span></p>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">New Password</label>
                                        <input
                                            type="text"
                                            required
                                            className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all font-mono"
                                            placeholder="Enter new password"
                                            value={resetData.newPass}
                                            onChange={e => setResetData({ ...resetData, newPass: e.target.value })}
                                        />
                                    </div>
                                    <div className="pt-2">
                                        <button type="submit" className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-orange-200 transition-all active:scale-[0.98]">
                                            Update Password
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // --- VIEW 4: AUDIT LOGS ---
    if (viewMode === 'audit') {
        const { auditLogs } = useApp();

        // Filter Logs
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
                            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                <History className="text-blue-600" /> System Audit Logs
                            </h2>
                            <p className="text-sm text-gray-500">Track all system activities and user actions.</p>
                        </div>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                            <input
                                type="text"
                                placeholder="Search logs..."
                                className="pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50 transition-all w-64"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="overflow-hidden rounded-lg border border-slate-200 shadow-sm bg-white">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-800 text-white font-bold text-xs uppercase">
                                <tr>
                                    <th className="p-4 w-48">Timestamp</th>
                                    <th className="p-4 w-32">User</th>
                                    <th className="p-4 w-32">Action</th>
                                    <th className="p-4">Details</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredLogs.length > 0 ? (
                                    filteredLogs.map((log: any) => (
                                        <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="p-4 text-slate-500 font-mono text-xs">
                                                {new Date(log.timestamp).toLocaleString()}
                                            </td>
                                            <td className="p-4 font-bold text-slate-700">
                                                {log.user}
                                            </td>
                                            <td className="p-4">
                                                <span className={`px-2 py-1 rounded text-xs font-bold ${log.action.includes('DELETE') ? 'bg-red-100 text-red-700' :
                                                    log.action.includes('CREATE') ? 'bg-green-100 text-green-700' :
                                                        log.action.includes('UPDATE') ? 'bg-blue-100 text-blue-700' :
                                                            'bg-slate-100 text-slate-600'
                                                    }`}>
                                                    {log.action}
                                                </span>
                                            </td>
                                            <td className="p-4 text-slate-600">
                                                {log.details}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={4} className="p-8 text-center text-slate-400 italic">
                                            No audit logs found matching "{searchTerm}".
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    }

    // --- VIEW 3: DATABASE PANEL ---
    if (viewMode === 'database') {
        if (currentUser?.role !== Role.ADMIN) {
            return (
                <div className="flex flex-col items-center justify-center h-96 text-slate-400">
                    <ShieldAlert size={48} className="mb-4 text-slate-300" />
                    <h3 className="text-lg font-bold">Access Denied</h3>
                    <p className="text-sm">You do not have permission to view the database.</p>
                </div>
            );
        }

        return (
            <div className="space-y-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                    <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
                        <div>
                            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                <Database className="text-blue-600" /> Database Management
                            </h2>
                            <p className="text-sm text-gray-500">View and manage all system data records.</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={handleExportExcel}
                                className="flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-lg shadow-sm transition-all text-sm font-medium"
                            >
                                <Download size={16} /> Export All
                            </button>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                                <input
                                    type="text"
                                    placeholder="Search sheets..."
                                    className="pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50 transition-all min-w-[240px]"
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                    <div className="overflow-hidden rounded-lg border border-slate-200 shadow-sm bg-white">
                        {/* Grid Header */}
                        <div className="grid grid-cols-[1.2fr_1.2fr_1fr_1fr_0.8fr_0.8fr_0.8fr_1fr_1.2fr_100px] bg-slate-800 text-white font-bold text-xs uppercase divide-x divide-slate-700">
                            <div
                                className="p-4 flex items-center gap-2 cursor-pointer hover:bg-slate-700 transition-colors"
                                onClick={() => handleSort('id')}
                            >
                                Sheet ID <ArrowUpDown size={14} className={sortConfig?.key === 'id' ? 'text-blue-400 opacity-100' : 'text-white opacity-30'} />
                            </div>
                            <div
                                className="p-4 flex items-center gap-2 cursor-pointer hover:bg-slate-700 transition-colors"
                                onClick={() => handleSort('date')}
                            >
                                Date <ArrowUpDown size={14} className={sortConfig?.key === 'date' ? 'text-blue-400 opacity-100' : 'text-white opacity-30'} />
                            </div>
                            <div className="p-4 flex items-center text-gray-300">Dock/Dest</div>
                            <div className="p-4 flex items-center text-gray-300">Transporter</div>
                            <div className="p-4 flex items-center text-gray-300">Start</div>
                            <div className="p-4 flex items-center text-gray-300">End</div>
                            <div className="p-4 flex items-center text-gray-300">Duration</div>
                            <div
                                className="p-4 flex items-center gap-2 cursor-pointer hover:bg-slate-700 transition-colors"
                                onClick={() => handleSort('status')}
                            >
                                Status <ArrowUpDown size={14} className={sortConfig?.key === 'status' ? 'text-blue-400 opacity-100' : 'text-white opacity-30'} />
                            </div>
                            <div
                                className="p-4 flex items-center gap-2 cursor-pointer hover:bg-slate-700 transition-colors"
                                onClick={() => handleSort('supervisorName')}
                            >
                                Supervisor <ArrowUpDown size={14} className={sortConfig?.key === 'supervisorName' ? 'text-blue-400 opacity-100' : 'text-white opacity-30'} />
                            </div>
                            <div className="p-4 flex items-center justify-center text-gray-300">Actions</div>
                        </div>

                        {/* Grid Body */}
                        <div className="divide-y divide-slate-100">
                            {sheets
                                .filter(s => s.id.includes(searchTerm) || s.supervisorName.toLowerCase().includes(searchTerm.toLowerCase()))
                                .sort((a, b) => {
                                    if (!sortConfig) return 0;
                                    const { key, direction } = sortConfig;
                                    const valA = a[key as keyof SheetData];
                                    const valB = b[key as keyof SheetData];

                                    if (key === 'date') {
                                        const parseDate = (d: any) => {
                                            if (!d) return 0;
                                            const str = String(d);
                                            if (str.includes('/')) {
                                                const parts = str.split('/');
                                                if (parts.length === 3) return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`).getTime();
                                            }
                                            return new Date(str).getTime();
                                        };
                                        const timeA = parseDate(valA);
                                        const timeB = parseDate(valB);
                                        return direction === 'asc' ? timeA - timeB : timeB - timeA;
                                    }

                                    const strA = String(valA || '').toLowerCase();
                                    const strB = String(valB || '').toLowerCase();
                                    const comparison = strA.localeCompare(strB, undefined, { numeric: true, sensitivity: 'base' });
                                    return direction === 'asc' ? comparison : -comparison;
                                })
                                .map((s) => {
                                    // Calculate Duration
                                    let duration = '-';
                                    if (s.loadingStartTime && s.loadingEndTime) {
                                        const start = new Date(`1970-01-01T${s.loadingStartTime}`);
                                        const end = new Date(`1970-01-01T${s.loadingEndTime}`);
                                        if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
                                            let diff = (end.getTime() - start.getTime()) / 60000;
                                            if (diff < 0) diff += 24 * 60;
                                            const hrs = Math.floor(diff / 60);
                                            const mins = Math.floor(diff % 60);
                                            duration = `${hrs}h ${mins}m`;
                                        }
                                    }

                                    return (
                                        <div key={s.id} onClick={() => onViewSheet(s)} className="grid grid-cols-[1.2fr_1.2fr_1fr_1fr_0.8fr_0.8fr_0.8fr_1fr_1.2fr_100px] hover:bg-slate-50 transition-colors items-center text-sm text-slate-700 group cursor-pointer">
                                            <div className="p-4 font-mono font-medium text-blue-600 group-hover:underline decoration-blue-200 underline-offset-4">{s.id}</div>
                                            <div className="p-4 text-slate-600">{s.date}</div>
                                            <div className="p-4 text-slate-600 truncate" title={s.loadingDockNo || s.destination}>{s.loadingDockNo || s.destination || '-'}</div>
                                            <div className="p-4 text-slate-600 truncate" title={s.transporter}>{s.transporter || '-'}</div>
                                            <div className="p-4 text-slate-500 font-mono text-xs">{s.loadingStartTime || '-'}</div>
                                            <div className="p-4 text-slate-500 font-mono text-xs">{s.loadingEndTime || '-'}</div>
                                            <div className="p-4 text-slate-800 font-medium">{duration}</div>
                                            <div className="p-4">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold
                                                        ${s.status === 'DRAFT' ? 'bg-slate-100 text-slate-600' :
                                                        s.status === 'LOCKED' ? 'bg-orange-100 text-orange-600' :
                                                            s.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                                                                'bg-slate-100 text-slate-600'}`}>
                                                    {s.status}
                                                </span>
                                            </div>
                                            <div className="p-4 text-slate-700 truncate" title={s.supervisorName}>{s.supervisorName}</div>
                                            <div className="p-4 flex justify-center">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleDelete(e, s.id); }}
                                                    className="text-slate-300 hover:text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                                    title="Delete Sheet"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })
                            }
                            {sheets.length === 0 && (
                                <div className="p-12 text-center text-slate-400 italic">No records found.</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return <div>Unknown View Mode</div>;
};
