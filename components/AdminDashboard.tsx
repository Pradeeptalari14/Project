import React, { useState, useMemo } from 'react';
import { useApp } from '../AppContext';
import { Role, SheetStatus, SheetData } from '../types';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell, LineChart, Line, CartesianGrid
} from 'recharts';
import {
    Check, X, Clipboard, Truck, Users as UserIcon, Trash2, Database,
    FileText, Search, Plus, ArrowUpDown, Download, Printer, Lock, LockOpen, Edit3, Eye, ShieldAlert,
    CheckCircle, XCircle, Key, UserPlus, Activity, ClipboardList,
    FileSpreadsheet, Filter, CheckCircle2, History,
    LayoutDashboard, Settings, LogOut, ChevronLeft, ChevronRight,
    AlertCircle, Clock, Calendar, Edit, ShieldCheck, AlertTriangle,
    Minimize2, Maximize2, ChevronDown, CheckSquare, AlignJustify,
    Timer, TableProperties, CalendarRange, MapPin, Users
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { widgetRegistry, getWidgetDefinition } from './widgets/WidgetRegistry';
import { AddWidgetModal } from './widgets/AddWidgetModal';

// --- CONFIGURATION: VIEW FILTERS ---
// Defines which statuses are visible in each workflow view.
const VIEW_SCOPES: Record<string, SheetStatus[]> = {
    'staging-db': [SheetStatus.DRAFT, SheetStatus.STAGING_VERIFICATION_PENDING, SheetStatus.LOCKED],
    'loading-db': [SheetStatus.LOCKED, SheetStatus.LOADING_VERIFICATION_PENDING, SheetStatus.COMPLETED],
    // 'approvals' & 'database' have dynamic/all scopes, handled in logic
};

interface AdminDashboardProps {
    viewMode: 'analytics' | 'users' | 'database' | 'audit' | 'approvals' | 'staging-db' | 'loading-db' | 'incidents';
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
    const { users, approveUser, deleteUser, sheets, deleteSheet, register, resetPassword, currentUser, isLoading, updateSheet, incidents, resetSystemData, updateIncident } = useApp();

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

    // --- INCIDENT FILTERS STATE ---
    const [incidentStatusFilter, setIncidentStatusFilter] = useState<'ALL' | 'OPEN' | 'IN_PROGRESS' | 'ON_HOLD' | 'RESOLVED'>('ALL');
    const [incidentDeptFilter, setIncidentDeptFilter] = useState<string>('ALL');

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
    // NEW: Database Workflow Context (Derived from View Mode now - Single Source of Truth)
    const [dbWorkflow, setDbWorkflow] = useState<'ALL' | 'STAGING' | 'LOADING' | 'APPROVALS'>('ALL');

    React.useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const wfParam = urlParams.get('workflow');

        if (viewMode === 'staging-db') setDbWorkflow('STAGING');
        else if (viewMode === 'loading-db') setDbWorkflow('LOADING');
        else if (viewMode === 'approvals') setDbWorkflow('APPROVALS');
        else if (viewMode === 'database' && wfParam === 'APPROVALS') setDbWorkflow('APPROVALS'); // Keep in Database View
        else setDbWorkflow('ALL');
    }, [viewMode]);
    const [isViewMenuOpen, setIsViewMenuOpen] = useState(false);

    // NEW: Global Filters State (Hoisted to fix Rules of Hooks)
    const [dateRange, setDateRange] = useState<{ start: string, end: string }>({ start: '', end: '' });
    const [supervisorFilter, setSupervisorFilter] = useState<string>('ALL');
    const [locationFilter, setLocationFilter] = useState<string>('ALL');
    const [durationFilter, setDurationFilter] = useState<string>('ALL'); // NEW: Duration Filter
    const [urlTick, setUrlTick] = useState(0); // Force re-render on URL change

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
    // Navigation Helper - REFACTORED: Removes redundant 'workflow' param
    const navigateToDatabase = (statusFilter: string, workflowContext: 'ALL' | 'STAGING' | 'LOADING' | 'APPROVALS' = 'ALL') => {
        const newUrl = new URL(window.location.href);

        // Map Context to View
        let targetView = 'database';
        if (workflowContext === 'STAGING') targetView = 'staging-db';
        else if (workflowContext === 'LOADING') targetView = 'loading-db';
        else if (workflowContext === 'APPROVALS' || viewMode === 'approvals') targetView = 'approvals'; // RESTORED: Keep in Approvals View

        // Update URL Params
        newUrl.searchParams.set('view', targetView);
        newUrl.searchParams.set('status', statusFilter);

        if (workflowContext === 'APPROVALS') {
            newUrl.searchParams.set('workflow', 'APPROVALS');
        } else {
            newUrl.searchParams.delete('workflow');
        }

        window.history.pushState({}, '', newUrl.toString());
        setUrlTick(prev => prev + 1); // FORCE UPDATE

        // Client-Side Navigation
        if (onNavigate) {
            onNavigate(targetView);
        } else {
            window.location.reload();
        }
    };



    // --- ADMIN ACTIONS ---
    const handleUnlockSheet = async (e: React.MouseEvent, sheet: SheetData) => {
        e.preventDefault(); e.stopPropagation();

        if (!isAdmin) return;

        let newStatus: SheetStatus | null = null;
        let confirmMsg = "";

        if (sheet.status === SheetStatus.COMPLETED) {
            newStatus = SheetStatus.LOADING_VERIFICATION_PENDING;
            confirmMsg = "Unlocking a COMPLETED sheet will revert it to 'LOADING PENDING'. Are you sure?";
        } else if (sheet.status === SheetStatus.LOCKED) {
            newStatus = SheetStatus.STAGING_VERIFICATION_PENDING;
            confirmMsg = "Unlocking a LOCKED sheet will revert it to 'STAGING PENDING'. Are you sure?";
        } else if (sheet.status === SheetStatus.LOADING_VERIFICATION_PENDING || sheet.status === SheetStatus.STAGING_VERIFICATION_PENDING) {
            newStatus = SheetStatus.DRAFT;
            confirmMsg = "Reverting this PENDING sheet will move it back to DRAFT. Are you sure?";
        }

        if (newStatus && confirm(confirmMsg)) {
            const reason = prompt("Enter reason for unlocking/reverting:");
            if (reason) {
                // We update just the status. The old data remains safely.
                const updatedSheet = { ...sheet, status: newStatus };
                await updateSheet(updatedSheet);
                // Log acts as the audit trail
                alert("Sheet unlocked successfully.");
            }
        }
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
            stagingCompleted: stagingLocked + pendingLoading + completed, // NEW: Custom metric for Staging SV
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
    const showIncidents = isAdmin || isShiftLead || currentUser?.role === Role.STAGING_SUPERVISOR || currentUser?.role === Role.LOADING_SUPERVISOR;

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
                    <button onClick={handleExportExcel} className="bg-green-600 hover:bg-green-700 active:scale-95 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold shadow-lg transition-all"><FileSpreadsheet size={16} /> Export</button>
                </div>

                <div
                    onClick={() => navigateToDatabase('COMPLETED', 'ALL')}
                    className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 cursor-pointer hover:shadow-md hover:border-green-300 hover:-translate-y-1 active:scale-95 transition-all duration-200 group relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><CheckCircle size={120} className="text-green-500" /></div>
                    <div className="flex items-center justify-between relative z-10">
                        <div>
                            <h3 className="text-lg font-bold text-slate-500 uppercase tracking-wide mb-1">
                                {currentUser?.role === Role.STAGING_SUPERVISOR ? 'Staging Sheets Completed' : 'Total Sheets Completed'}
                            </h3>
                            <p className="text-xs text-slate-400">Click to filter view</p>
                        </div>
                        <div className="text-5xl font-extrabold text-green-600">
                            {currentUser?.role === Role.STAGING_SUPERVISOR ? stats.stagingCompleted : stats.completed}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Staging */}
                    {showStaging && (
                        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
                            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-100">
                                <div className="p-2 bg-blue-100 rounded-lg text-blue-600"><Clipboard size={20} /></div>
                                <div><h3 className="font-bold text-slate-700">Staging Overview</h3><div className="text-xs text-slate-400">{stats.staging.staff} Staff</div></div>
                            </div>
                            <div className="grid grid-cols-3 gap-2"> {/* Changed to 3 cols for Locked */}
                                <div onClick={() => onNavigate && onNavigate('staging', 'DRAFT')} className="p-3 bg-blue-50/50 rounded-lg cursor-pointer hover:bg-blue-100 hover:-translate-y-1 active:scale-95 transition-all duration-200">
                                    <span className="text-[10px] text-blue-500 uppercase font-bold block mb-1">Drafts</span>
                                    <span className="text-xl font-bold text-blue-700">{stats.staging.drafts}</span>
                                </div>
                                <div onClick={() => onNavigate && onNavigate('staging', 'STAGING_VERIFICATION_PENDING')} className="p-3 bg-yellow-50 rounded-lg cursor-pointer hover:bg-yellow-100 hover:-translate-y-1 active:scale-95 transition-all duration-200">
                                    <span className="text-[10px] text-yellow-600 uppercase font-bold block mb-1">Pending</span>
                                    <span className="text-xl font-bold text-yellow-700">{stats.staging.pending}</span>
                                </div>
                                <div onClick={() => onNavigate && onNavigate('staging', 'LOCKED')} className="p-3 bg-orange-50 rounded-lg cursor-pointer hover:bg-orange-100 hover:-translate-y-1 active:scale-95 transition-all duration-200">
                                    <span className="text-[10px] text-orange-600 uppercase font-bold block mb-1">Locked</span>
                                    <span className="text-xl font-bold text-orange-700">{stats.staging.locked}</span>
                                </div>
                            </div>
                        </div>
                    )}
                    {/* Loading */}
                    {showLoading && (
                        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
                            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-100">
                                <div className="p-2 bg-orange-100 rounded-lg text-orange-600"><Truck size={20} /></div>
                                <div><h3 className="font-bold text-slate-700">Loading Overview</h3><div className="text-xs text-slate-400">{stats.loading.staff} Staff</div></div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div onClick={() => onNavigate && onNavigate('loading', 'LOCKED')} className="p-2 bg-orange-50 rounded-lg cursor-pointer hover:bg-orange-100 hover:-translate-y-1 active:scale-95 transition-all duration-200 flex items-center justify-between group">
                                    <div>
                                        <span className="text-[10px] text-orange-600 uppercase font-bold block mb-1">Ready to Load</span>
                                        <span className="text-lg font-bold text-orange-700">{stats.loading.locked}</span>
                                    </div>
                                    <Lock className="text-orange-300 group-hover:text-orange-500 transition-colors" size={24} />
                                </div>
                                <div onClick={() => onNavigate && onNavigate('loading', 'LOADING_VERIFICATION_PENDING')} className="p-2 bg-yellow-50 rounded-lg cursor-pointer hover:bg-yellow-100 hover:-translate-y-1 active:scale-95 transition-all duration-200 flex items-center justify-between group">
                                    <div>
                                        <span className="text-[10px] text-yellow-600 uppercase font-bold block mb-1">Pending</span>
                                        <span className="text-lg font-bold text-yellow-700">{stats.loading.pending}</span>
                                    </div>
                                    <Clock className="text-yellow-300 group-hover:text-yellow-500 transition-colors" size={24} />
                                </div>
                            </div>
                        </div>
                    )}
                    {/* Approvals */}
                    {showApprovals && (
                        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
                            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-100">
                                <div className="p-2 bg-purple-100 rounded-lg text-purple-600"><CheckCircle2 size={20} /></div>
                                <div><h3 className="font-bold text-slate-700">Shift Lead</h3><div className="text-xs text-slate-400">{stats.approvals.staff} Leads</div></div>
                            </div>
                            <div className="space-y-3">
                                <div onClick={() => onNavigate && onNavigate('approvals')} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg cursor-pointer hover:bg-blue-100 hover:-translate-y-1 active:scale-95 transition-all duration-200">
                                    <span className="text-sm font-bold text-slate-700">Staging</span>
                                    <span className="text-sm text-slate-500">(Pending)</span>
                                    <span className="text-lg font-bold text-blue-700">{stats.approvals.staging}</span>
                                </div>
                                <div onClick={() => onNavigate && onNavigate('approvals')} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg cursor-pointer hover:bg-orange-100 hover:-translate-y-1 active:scale-95 transition-all duration-200">
                                    <span className="text-sm font-bold text-slate-700">Loading</span>
                                    <span className="text-sm text-slate-500">(Pending)</span>
                                    <span className="text-lg font-bold text-orange-700">{stats.approvals.loading}</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* ROW 3 & 4: Widgets */}
                {/* ROW 3 & 4: Widgets */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Hide SLA for Supervisors, but Show Incidents */}

                    <>
                        {showApprovals && userWidgets.includes('sla-monitor') && getWidgetDefinition('sla-monitor') && (
                            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm"><h3 className="font-bold mb-4">SLA Compliance</h3>{React.createElement(getWidgetDefinition('sla-monitor')!.component)}</div>
                        )}
                        {showIncidents && userWidgets.includes('incident-list') && getWidgetDefinition('incident-list') && (
                            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm"><h3 className="font-bold mb-4">Incidents</h3>{React.createElement(getWidgetDefinition('incident-list')!.component)}</div>
                        )}
                    </>

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
                                        currentUser?.role === Role.ADMIN && (
                                            <>
                                                <button onClick={() => { setResetData({ id: user.id, username: user.username, newPass: '' }); setResetPasswordOpen(true); }} className="text-blue-600 hover:text-blue-800" title="Change Password"><Key size={16} /></button>
                                                <button onClick={(e) => handleUserDelete(e, user.id, user.username)} className="text-red-600 hover:text-red-800" title="Delete User"><Trash2 size={16} /></button>
                                            </>
                                        )
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

                {/* Reset Password Modal */}
                {isResetPasswordOpen && resetData && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-xl p-6 w-full max-w-sm">
                            <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Key size={20} className="text-blue-600" /> Reset Password</h3>
                            <p className="text-sm text-slate-500 mb-4">Set a new password for <strong>{resetData.username}</strong>.</p>
                            <form onSubmit={(e) => {
                                e.preventDefault();
                                if (!resetData.newPass) return;
                                resetPassword(resetData.id, resetData.newPass);
                                setResetPasswordOpen(false);
                                setResetData(null);
                                alert(`Password for ${resetData.username} changed successfully.`);
                            }} className="space-y-4">
                                <input
                                    className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="New Password"
                                    type="password"
                                    value={resetData.newPass}
                                    onChange={e => setResetData({ ...resetData, newPass: e.target.value })}
                                    required
                                />
                                <div className="flex gap-2 justify-end mt-4">
                                    <button type="button" onClick={() => { setResetPasswordOpen(false); setResetData(null); }} className="px-4 py-2 border rounded hover:bg-slate-50">Cancel</button>
                                    <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Update Password</button>
                                </div>
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
    // --- VIEW 5: INCIDENT CONTROL CENTER ---
    if (viewMode === 'incidents') {
        const openIncidents = incidents.filter(i => i.status === 'OPEN').length;
        const criticalIncidents = incidents.filter(i => i.priority === 'CRITICAL' && i.status !== 'RESOLVED').length;
        const resolvedIncidents = incidents.filter(i => i.status === 'RESOLVED').length;

        // Date Range State
        const [incidentStartDate, setIncidentStartDate] = useState('');
        const [incidentEndDate, setIncidentEndDate] = useState('');

        // Enhanced Resolve/Update Handler
        const handleResolve = async (id: string, notes: string, status: 'RESOLVED' | 'IN_PROGRESS' | 'ON_HOLD' = 'RESOLVED') => {
            if (!updateIncident) {
                alert("Error: Update function not available.");
                return;
            }

            const updates: any = {
                status,
                resolutionNotes: notes
            };

            if (status === 'RESOLVED') {
                updates.resolvedAt = new Date().toISOString();
                updates.resolvedBy = currentUser?.username || 'Admin';
            }

            await updateIncident(id, updates);
        };

        const handleResetSystem = async () => {
            if (confirm("WARNING: This will DELETE ALL DATA (Sheets, Incidents, Logs). Are you sure?")) {
                const doubleCheck = prompt("Type 'DELETE' to confirm system reset:");
                if (doubleCheck === 'DELETE') {
                    await resetSystemData();
                    alert("System data has been reset.");
                }
            }
        };

        return (
            <div className="space-y-6">
                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white p-4 rounded-xl border border-rose-100 shadow-sm flex items-center justify-between">
                        <div><p className="text-sm text-slate-500 font-bold uppercase">Critical Issues</p><h3 className="text-2xl font-bold text-rose-600">{criticalIncidents}</h3></div>
                        <div className="p-3 bg-rose-50 rounded-lg text-rose-500"><AlertTriangle size={24} /></div>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-blue-100 shadow-sm flex items-center justify-between">
                        <div><p className="text-sm text-slate-500 font-bold uppercase">Open Incidents</p><h3 className="text-2xl font-bold text-blue-600">{openIncidents}</h3></div>
                        <div className="p-3 bg-blue-50 rounded-lg text-blue-500"><AlertCircle size={24} /></div>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-green-100 shadow-sm flex items-center justify-between">
                        <div><p className="text-sm text-slate-500 font-bold uppercase">Resolved Total</p><h3 className="text-2xl font-bold text-green-600">{resolvedIncidents}</h3></div>
                        <div className="p-3 bg-green-50 rounded-lg text-green-500"><CheckCircle size={24} /></div>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2"><ShieldAlert className="text-slate-400" size={18} /> Incident Control Center</h3>
                        <div className="flex gap-2 items-center">
                            {/* Filters */}
                            <select
                                className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                value={incidentStatusFilter}
                                onChange={(e) => setIncidentStatusFilter(e.target.value as any)}
                            >
                                <option value="ALL">All Status</option>
                                <option value="OPEN">Open</option>
                                <option value="IN_PROGRESS">In Progress</option>
                                <option value="ON_HOLD">On Hold</option>
                                <option value="RESOLVED">Resolved</option>
                            </select>

                            <select
                                className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                value={incidentDeptFilter}
                                onChange={(e) => setIncidentDeptFilter(e.target.value)}
                            >
                                <option value="ALL">All Depts</option>
                                <option value="LOGISTICS">Logistics</option>
                                <option value="QUALITY">Quality</option>
                                <option value="MAINTENANCE">Maintenance</option>
                                <option value="OPERATIONS">Operations</option>
                                <option value="IT">IT</option>
                                <option value="HR">HR</option>
                                <option value="OTHER">Other</option>
                            </select>

                            <input
                                type="date"
                                value={incidentStartDate}
                                onChange={(e) => setIncidentStartDate(e.target.value)}
                                className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                title="Start Date"
                            />
                            <span className="text-slate-400">-</span>
                            <input
                                type="date"
                                value={incidentEndDate}
                                onChange={(e) => setIncidentEndDate(e.target.value)}
                                className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                title="End Date"
                            />

                            {isAdmin && (
                                <button
                                    onClick={handleResetSystem}
                                    className="px-3 py-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                                >
                                    <Trash2 size={14} /> Reset System Data
                                </button>
                            )}
                        </div>
                    </div>
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-xs">
                            <tr>
                                <th className="p-4">Priority</th>
                                <th className="p-4">Type</th>
                                <th className="p-4">Description</th>
                                <th className="p-4">Assigned To</th>
                                <th className="p-4">Reported By</th>
                                <th className="p-4">Sheet ID</th>
                                <th className="p-4">Status</th>
                                <th className="p-4 text-center">Actions</th>
                            </tr>

                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {incidents.filter(inc => {
                                // 1. Status Filter
                                const matchStatus = incidentStatusFilter === 'ALL' || inc.status === incidentStatusFilter;
                                // 2. Dept Filter
                                const matchDept = incidentDeptFilter === 'ALL' || inc.assignedDepartment === incidentDeptFilter;
                                // 3. Date Filter
                                const incDate = new Date(inc.createdAt).toISOString().split('T')[0];
                                const matchStart = !incidentStartDate || incDate >= incidentStartDate;
                                const matchEnd = !incidentEndDate || incDate <= incidentEndDate;

                                return matchStatus && matchDept && matchStart && matchEnd;
                            }).length === 0 ? (
                                <tr><td colSpan={8} className="p-8 text-center text-slate-400">No matching incidents found.</td></tr>
                            ) : (
                                incidents
                                    .filter(inc => {
                                        const matchStatus = incidentStatusFilter === 'ALL' || inc.status === incidentStatusFilter;
                                        const matchDept = incidentDeptFilter === 'ALL' || inc.assignedDepartment === incidentDeptFilter;
                                        const incDate = new Date(inc.createdAt).toISOString().split('T')[0];
                                        const matchStart = !incidentStartDate || incDate >= incidentStartDate;
                                        const matchEnd = !incidentEndDate || incDate <= incidentEndDate;
                                        return matchStatus && matchDept && matchStart && matchEnd;
                                    })
                                    .map(inc => (
                                        <tr key={inc.id} className="hover:bg-slate-50">
                                            <td className="p-4">
                                                <span className={`px-2 py-1 rounded text-xs font-bold ${inc.priority === 'CRITICAL' ? 'bg-rose-100 text-rose-700' :
                                                    inc.priority === 'HIGH' ? 'bg-orange-100 text-orange-700' :
                                                        inc.priority === 'MEDIUM' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'
                                                    }`}>{inc.priority}</span>
                                            </td>
                                            <td className="p-4 font-bold text-slate-700">{inc.type}</td>
                                            <td className="p-4 max-w-xs truncate" title={inc.description}>{inc.description}</td>
                                            <td className="p-4 text-slate-600 font-bold">{inc.assignedDepartment || '-'}</td>

                                            <td className="p-4 text-slate-600">
                                                {inc.createdBy}
                                                <div className="text-[10px] text-slate-400 mt-1">
                                                    Created: {new Date(inc.createdAt).toLocaleString()}
                                                    {inc.occurredAt && !isNaN(new Date(inc.occurredAt).getTime()) && (
                                                        <div className="text-rose-600 font-bold bg-rose-50 px-1 rounded w-fit mt-0.5">
                                                            Time: {new Date(inc.occurredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-4 font-mono text-blue-600">{inc.sheetId}</td>
                                            <td className="p-4">
                                                <span className={`flex items-center gap-1 font-bold text-xs ${inc.status === 'OPEN' ? 'text-rose-600' :
                                                    inc.status === 'RESOLVED' ? 'text-green-600' :
                                                        inc.status === 'IN_PROGRESS' ? 'text-blue-600' :
                                                            'text-amber-600'}`}>
                                                    {inc.status === 'RESOLVED' && <CheckCircle size={14} />}
                                                    {inc.status === 'OPEN' && <AlertCircle size={14} />}
                                                    {inc.status === 'IN_PROGRESS' && <Clock size={14} />}
                                                    {inc.status === 'ON_HOLD' && <AlertTriangle size={14} />}
                                                    {inc.status.replace('_', ' ')}
                                                </span>
                                                {inc.resolutionNotes && (
                                                    <div className="text-[10px] text-slate-400 italic mt-1 max-w-[100px] truncate" title={inc.resolutionNotes}>
                                                        {inc.status === 'ON_HOLD' ? 'Reason: ' : 'Note: '}{inc.resolutionNotes}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-4 text-center">
                                                {inc.status !== 'RESOLVED' && (
                                                    <div className="flex items-center justify-center gap-1">
                                                        {/* Start / Resume */}
                                                        {inc.status !== 'IN_PROGRESS' && (
                                                            <button
                                                                onClick={() => handleResolve(inc.id, "Started Work", 'IN_PROGRESS')}
                                                                title="Mark In Progress"
                                                                className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                                                            >
                                                                <Clock size={14} />
                                                            </button>
                                                        )}

                                                        {/* Hold */}
                                                        {inc.status !== 'ON_HOLD' && (
                                                            <button
                                                                onClick={() => {
                                                                    const reason = prompt("Enter Hold Reason:");
                                                                    if (reason) handleResolve(inc.id, reason, 'ON_HOLD');
                                                                }}
                                                                title="Put On Hold"
                                                                className="p-1.5 bg-amber-50 text-amber-600 hover:bg-amber-100 rounded-lg transition-colors"
                                                            >
                                                                <AlertTriangle size={14} />
                                                            </button>
                                                        )}

                                                        {/* Resolve */}
                                                        <button
                                                            onClick={() => {
                                                                const note = prompt("Enter Resolution/Closing Comment:");
                                                                if (note) handleResolve(inc.id, note, 'RESOLVED');
                                                            }}
                                                            title="Resolve"
                                                            className="p-1.5 bg-green-50 text-green-600 hover:bg-green-100 rounded-lg transition-colors"
                                                        >
                                                            <CheckCircle size={14} />
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div >
        );
    }

    if (viewMode === 'database' || viewMode === 'approvals' || viewMode === 'staging-db' || viewMode === 'loading-db') {

        // Title & Context Logic
        let viewTitle = 'Database Management';
        let isLockedWorkflow = false;

        if (viewMode === 'staging-db') {
            viewTitle = 'Staging Workflow Database';
            isLockedWorkflow = true;
        } else if (viewMode === 'loading-db') {
            viewTitle = 'Loading Workflow Database';
            isLockedWorkflow = true;
        } else if (viewMode === 'approvals') {
            viewTitle = 'Shift Lead Database'; // Unified Title
        }

        const isAdmin = currentUser?.role === Role.ADMIN;
        const isShiftLead = currentUser?.role === Role.SHIFT_LEAD;

        const urlParams = new URLSearchParams(window.location.search);
        const statusFilter = urlParams.get('status');



        if (!isAdmin && !isShiftLead && viewMode !== 'staging-db' && viewMode !== 'loading-db') {
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

            // 1. Primary Filter: Status from URL (Overrules everything if set and not 'ALL')
            if (statusFilter && statusFilter !== 'ALL') {
                if (s.status !== statusFilter) return false;
            } else if (viewMode === 'approvals') {
                // SPECIAL RULE: Shift Leads "Easy View" - If no filter, show ALL Pending items (Staging OR Loading)
                const isPending = s.status === SheetStatus.STAGING_VERIFICATION_PENDING || s.status === SheetStatus.LOADING_VERIFICATION_PENDING;
                if (!isPending) return false;
            }

            // 2. Scope Filter: Workflow Constraints
            // Does this view have a strict list of allowed statuses?
            const allowedStatuses = VIEW_SCOPES[viewMode];
            if (allowedStatuses) {
                if (!allowedStatuses.includes(s.status)) return false;
            }

            // 3. Date Range Filter
            if (dateRange.start) {
                const sheetDate = new Date(s.date).getTime();
                const startDate = new Date(dateRange.start).getTime();
                if (sheetDate < startDate) return false;
            }
            if (dateRange.end) {
                const sheetDate = new Date(s.date).getTime();
                const endDate = new Date(dateRange.end).getTime();
                if (sheetDate > endDate) return false;
            }

            // 4. Supervisor Filter
            if (supervisorFilter !== 'ALL') {
                const svName = resolveUserName(s.supervisorName, s.createdBy)?.toLowerCase() || '';
                const ldgName = resolveUserName(s.loadingSvName, s.completedBy)?.toLowerCase() || '';
                if (!svName.includes(supervisorFilter.toLowerCase()) && !ldgName.includes(supervisorFilter.toLowerCase())) return false;
            }

            // 5. Location Filter
            if (locationFilter !== 'ALL') {
                if (!s.destination || !s.destination.toLowerCase().includes(locationFilter.toLowerCase())) return false;
            }

            // 6. NEW: Duration Filter
            if (durationFilter !== 'ALL') {
                if (!s.createdAt || !s.completedAt) return false; // Must be completed to have duration
                const diff = new Date(s.completedAt).getTime() - new Date(s.createdAt).getTime();
                const mins = diff / 60000;

                if (durationFilter === 'UNDER_30' && mins >= 30) return false;
                if (durationFilter === '30_60' && (mins < 30 || mins > 60)) return false;
                if (durationFilter === 'OVER_60' && mins <= 60) return false;
                if (durationFilter === 'OVER_120' && mins <= 120) return false;
            }

            return matchesSearch;
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

                    {/* NEW: Date Range & Extended Filters Toolbar */}
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 mb-4 flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-2">
                            <CalendarRange size={18} className="text-slate-500" />
                            <span className="text-sm font-bold text-slate-700">Date Range:</span>
                            <input
                                type="date"
                                className="p-1.5 text-sm border border-slate-300 rounded hover:border-blue-400 focus:border-blue-500 outline-none"
                                value={dateRange.start}
                                onChange={e => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                            />
                            <span className="text-slate-400">-</span>
                            <input
                                type="date"
                                className="p-1.5 text-sm border border-slate-300 rounded hover:border-blue-400 focus:border-blue-500 outline-none"
                                value={dateRange.end}
                                onChange={e => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                            />
                            {(dateRange.start || dateRange.end) && (
                                <button onClick={() => setDateRange({ start: '', end: '' })} className="text-xs text-red-500 hover:text-red-700 font-medium ml-2">Clear</button>
                            )}
                        </div>

                        {/* Placeholder for Future Supervisor Filter -> ACTIVATED */}
                        <div className="flex items-center gap-2">
                            <Users size={18} className="text-slate-500" />
                            <span className="text-sm font-bold text-slate-700">Supervisor:</span>
                            <select
                                className="p-1.5 text-sm border border-slate-300 rounded hover:border-blue-400 focus:border-blue-500 outline-none bg-white"
                                value={supervisorFilter}
                                onChange={e => setSupervisorFilter(e.target.value)}
                            >
                                <option value="ALL">All Supervisors</option>
                                {users.filter(u => u.role === Role.STAGING_SUPERVISOR || u.role === Role.LOADING_SUPERVISOR).map(u => (
                                    <option key={u.id} value={u.fullName || u.username}>{u.fullName || u.username}</option>
                                ))}
                            </select>
                        </div>

                        {/* NEW: Location Filter */}
                        <div className="flex items-center gap-2">
                            <MapPin size={18} className="text-slate-500" />
                            <span className="text-sm font-bold text-slate-700">Location:</span>
                            <select
                                className="p-1.5 text-sm border border-slate-300 rounded hover:border-blue-400 focus:border-blue-500 outline-none bg-white max-w-[150px]"
                                value={locationFilter}
                                onChange={e => setLocationFilter(e.target.value)}
                            >
                                <option value="ALL">All Locations</option>
                                {/* Unique Destinations */}
                                {Array.from(new Set(sheets.map(s => s.destination).filter(Boolean))).sort().map(loc => (
                                    <option key={loc} value={loc}>{loc}</option>
                                ))}
                            </select>
                        </div>

                        {/* NEW: Duration Filter Dropdown */}
                        <div className="flex items-center gap-2">
                            <Clock size={18} className="text-slate-500" />
                            <span className="text-sm font-bold text-slate-700">Duration:</span>
                            <select
                                className="p-1.5 text-sm border border-slate-300 rounded hover:border-blue-400 focus:border-blue-500 outline-none bg-white max-w-[150px]"
                                value={durationFilter}
                                onChange={e => setDurationFilter(e.target.value)}
                            >
                                <option value="ALL">All Durations</option>
                                <option value="UNDER_30">Under 30 Mins</option>
                                <option value="30_60">30 Mins - 1 Hour</option>
                                <option value="OVER_60">Over 1 Hour</option>
                                <option value="OVER_120">Over 2 Hours</option>
                            </select>
                        </div>



                        {/* NEW: Database (Workflow) Filter - Replaces Tabs */}
                        {viewMode !== 'approvals' && (
                            <div className="flex items-center gap-2">
                                <Database size={18} className="text-slate-500" />
                                <span className="text-sm font-bold text-slate-700">Database:</span>
                                <select
                                    className="p-1.5 text-sm border border-slate-300 rounded hover:border-blue-400 focus:border-blue-500 outline-none bg-white font-bold text-slate-700"
                                    value={dbWorkflow}
                                    onChange={(e) => {
                                        const val = e.target.value as any;
                                        setDbWorkflow(val);
                                        navigateToDatabase(val === 'ALL' ? 'ALL' : 'ALL', val);
                                    }}
                                >
                                    <option value="ALL">All Databases</option>
                                    <option value="STAGING">Staging Workflow</option>
                                    <option value="LOADING">Loading Workflow</option>
                                    <option value="APPROVALS">Shift Lead View</option>
                                </select>
                            </div>
                        )}
                    </div>



                    <div className="flex flex-col gap-4 mb-6">


                        {/* Status Filters based on Workflow */}
                        <div className="flex items-center gap-2 overflow-x-auto">

                            {/* 1. STAGING WORKFLOW FILTERS (or Default ALL) */}
                            {(dbWorkflow === 'STAGING' || dbWorkflow === 'ALL') && viewMode !== 'approvals' && (
                                <>
                                    <button onClick={() => navigateToDatabase('ALL')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${!statusFilter || statusFilter === 'ALL' ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-white text-slate-500 border-slate-200'}`}><Filter size={12} /> All</button>
                                    <button onClick={() => navigateToDatabase('DRAFT')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${statusFilter === 'DRAFT' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-500 border-slate-200 hover:border-blue-300'}`}><Edit3 size={12} /> Drafts</button>
                                    <button onClick={() => navigateToDatabase('STAGING_VERIFICATION_PENDING')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${statusFilter === 'STAGING_VERIFICATION_PENDING' ? 'bg-yellow-500 text-white border-yellow-500' : 'bg-white text-slate-500 border-slate-200 hover:border-yellow-300'}`}><Clock size={12} /> Staging Pending</button>
                                    {/* Show Locked in Staging so they can see what they finished */}
                                    <button onClick={() => navigateToDatabase('LOCKED')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${statusFilter === 'LOCKED' ? 'bg-slate-600 text-white border-slate-600' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}><Lock size={12} /> Ready for Loading</button>
                                </>
                            )}

                            {/* 2. LOADING WORKFLOW FILTERS */}
                            {dbWorkflow === 'LOADING' && viewMode !== 'approvals' && (
                                <div className="flex items-center gap-2 overflow-x-auto">
                                    <button onClick={() => navigateToDatabase('ALL')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${!statusFilter || statusFilter === 'ALL' ? 'bg-orange-100 text-orange-700 border-orange-200' : 'bg-white text-slate-500 border-slate-200'}`}><Filter size={12} /> All</button>
                                    <button onClick={() => navigateToDatabase('LOCKED')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${statusFilter === 'LOCKED' ? 'bg-orange-600 text-white border-orange-600' : 'bg-white text-slate-500 border-slate-200 hover:border-orange-300'}`}><Lock size={12} /> Ready to Load</button>
                                    <button onClick={() => navigateToDatabase('LOADING_VERIFICATION_PENDING')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${statusFilter === 'LOADING_VERIFICATION_PENDING' ? 'bg-yellow-500 text-white border-yellow-500' : 'bg-white text-slate-500 border-slate-200 hover:border-yellow-300'}`}><Clock size={12} /> Loading Pending</button>
                                    <button onClick={() => navigateToDatabase('COMPLETED')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${statusFilter === 'COMPLETED' ? 'bg-green-600 text-white border-green-600' : 'bg-white text-slate-500 border-slate-200 hover:border-green-300'}`}><CheckCircle size={12} /> Completed</button>
                                </div>
                            )}

                            {/* SHIFT LEAD DEDICATED FILTERS */}
                            {(viewMode === 'approvals' || dbWorkflow === 'APPROVALS') && (
                                <div className="flex items-center gap-2 overflow-x-auto">
                                    <button onClick={() => navigateToDatabase('ALL', 'APPROVALS')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${!statusFilter || statusFilter === 'ALL' ? 'bg-purple-100 text-purple-700 border-purple-200' : 'bg-white text-slate-500 border-slate-200'}`}><Filter size={12} /> All Approvals</button>
                                    <button onClick={() => navigateToDatabase('STAGING_VERIFICATION_PENDING', 'APPROVALS')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${statusFilter === 'STAGING_VERIFICATION_PENDING' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-500 border-slate-200 hover:border-blue-300'}`}><ClipboardList size={12} /> Staging Approval</button>
                                    <button onClick={() => navigateToDatabase('LOADING_VERIFICATION_PENDING', 'APPROVALS')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${statusFilter === 'LOADING_VERIFICATION_PENDING' ? 'bg-orange-600 text-white border-orange-600' : 'bg-white text-slate-500 border-slate-200 hover:border-orange-300'}`}><Truck size={12} /> Loading Approval</button>
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
                                    <div className="grid grid-cols-[100px_100px_120px_120px_120px_180px_180px_180px_180px_220px_80px] bg-slate-800 text-white font-bold text-xs uppercase divide-x divide-slate-700 border-b border-slate-600">
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
                                            <div key={s.id} className={`grid grid-cols-[100px_100px_120px_120px_120px_180px_180px_180px_180px_220px_80px] items-center text-sm border-l-4 transition-all ${s.status === 'STAGING_VERIFICATION_PENDING' ? 'bg-blue-50/50 border-l-blue-500 hover:bg-blue-100' : s.status === 'LOADING_VERIFICATION_PENDING' ? 'bg-orange-50/50 border-l-orange-500 hover:bg-orange-100' : s.status === 'COMPLETED' ? 'bg-green-50/30 border-l-green-600 hover:bg-green-100' : 'bg-white border-l-transparent hover:bg-slate-50'
                                                }`}>
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
                                                    <div className="flex flex-col gap-1 w-full max-w-[200px]">
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
                                                <div className="p-4 flex gap-2 justify-center">
                                                    <button onClick={() => onViewSheet(s)} className="text-blue-600 hover:text-blue-800" title="View Details"><Eye size={18} /></button>
                                                    {isAdmin && (
                                                        <>
                                                            <button onClick={(e) => handleDelete(e, s.id)} className="text-red-600 hover:text-red-800" title="Delete Sheet"><Trash2 size={18} /></button>
                                                            {(s.status === 'LOCKED' || s.status === 'COMPLETED' || s.status.includes('PENDING')) && (
                                                                <button onClick={(e) => handleUnlockSheet(e, s)} className="text-amber-600 hover:text-amber-800" title="Unlock / Revert Status"><LockOpen size={18} /></button>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        ) : (
                                            // DURATION VIEW ROW
                                            <div key={s.id} className="grid grid-cols-[100px_120px_180px_180px_180px_180px_180px_100px_80px] items-center text-sm text-blue-100 hover:bg-slate-800/50 border-b border-slate-800">
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
                        {/* PRINT ONLY: Detailed Filter Flow Legend */}
                        <div className="hidden print:block mt-8 pt-8 border-t border-slate-300">
                            <h3 className="font-bold text-slate-800 text-sm uppercase mb-4">Detailed Filter Flow Reference</h3>
                            <div className="grid grid-cols-3 gap-8 text-xs text-slate-600">
                                <div>
                                    <h4 className="font-bold text-blue-600 mb-2">1. Staging Workflow</h4>
                                    <ul className="space-y-1">
                                        <li>• <b>Drafts:</b> Initial creation. Editable.</li>
                                        <li>• <b>Pending:</b> Submitted for Staging Approval.</li>
                                        <li>• <b>Ready:</b> Approved & Locked. Ready for Loading Team.</li>
                                    </ul>
                                </div>
                                <div>
                                    <h4 className="font-bold text-orange-600 mb-2">2. Loading Workflow</h4>
                                    <ul className="space-y-1">
                                        <li>• <b>Ready to Load:</b> Picked up from Staging.</li>
                                        <li>• <b>Pending:</b> Submitted for Loading Approval.</li>
                                        <li>• <b>Completed:</b> Finalized. No further edits.</li>
                                    </ul>
                                </div>
                                <div>
                                    <h4 className="font-bold text-purple-600 mb-2">3. Shift Lead Database</h4>
                                    <ul className="space-y-1">
                                        <li>• <b>All Approvals:</b> Master list of checks needed.</li>
                                        <li>• <b>Staging Appr:</b> Drafts waiting for sign-off.</li>
                                        <li>• <b>Loading Appr:</b> Loads waiting for sign-off.</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                </div >
            </div >
        );
    }

    return <div>Unknown View Mode</div>;
};
