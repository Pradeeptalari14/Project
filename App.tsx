
import React, { useState } from 'react';
import { useApp } from './AppContext';
import { Auth } from './components/Auth';
import { Layout } from './components/Layout';
import { AdminDashboard } from './components/AdminDashboard';
import { StagingSheet } from './components/StagingSheet';
import { LoadingSheet } from './components/LoadingSheet';
import { Role, SheetStatus, SheetData } from './types';
import { PlusCircle, Search, Edit3, Eye, Lock, Printer } from 'lucide-react';

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

// Basic Error Boundary
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
    state: ErrorBoundaryState = { hasError: false, error: null };

    constructor(props: { children: React.ReactNode }) {
        super(props);
    }

    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="p-8 text-center text-red-600">
                    <h2 className="text-xl font-bold mb-2">Something went wrong.</h2>
                    <p className="text-sm bg-red-50 p-4 rounded border border-red-200 inline-block text-left">
                        {this.state.error?.toString()}
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        className="block mx-auto mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                        Reload Page
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

const App = () => {
    // ... existing hook calls ...
    const { currentUser, sheets } = useApp();
    const [currentPage, setCurrentPage] = useState('dashboard');
    // ... rest of state ...
    const [selectedSheetId, setSelectedSheetId] = useState<string | null>(null);
    const [isCreatingNew, setIsCreatingNew] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [openInPreviewMode, setOpenInPreviewMode] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [initialSearch, setInitialSearch] = useState('');

    if (!currentUser) {
        return <Auth />;
    }

    const effectiveUser = currentUser;

    const activeSheet = selectedSheetId ? sheets.find(s => s.id === selectedSheetId) : null;

    // ... handlers ...
    const handleNavigate = (page: string, filter?: string) => {
        // Handle Role-Based Filter Navigation (e.g. 'admin_STAGING_SUPERVISOR')
        if (page.startsWith('admin_')) {
            const roleFilter = page.replace('admin_', '').replace('_SUPERVISOR', ' SUPERVISOR'); // "STAGING SUPERVISOR"
            setInitialSearch(roleFilter);
            setCurrentPage('admin');
        } else {
            // Apply specific filter if provided (User Drill-down)
            if (filter) {
                setInitialSearch(filter);
            } else {
                setInitialSearch('');
            }
            setCurrentPage(page);
        }
        setSelectedSheetId(null);
        setIsCreatingNew(false);
        setIsEditing(false);
        setOpenInPreviewMode(false);
    };

    const handleCreateSheet = () => {
        setSelectedSheetId(null);
        setIsCreatingNew(true);
        setIsEditing(true);
        setOpenInPreviewMode(false);
        setCurrentPage('staging-editor');
    };

    const handleViewSheet = (sheet: SheetData, source?: string) => {
        setSelectedSheetId(sheet.id);
        setIsCreatingNew(false);
        setIsEditing(true);
        setOpenInPreviewMode(false);

        // If accessing from Staging Dashboard, always show Staging View (Read-only if locked)
        if (source === 'staging') {
            setCurrentPage('staging-editor');
            return;
        }

        // Default Logic (Admin / Loading Dashboards)
        if (sheet.status === SheetStatus.DRAFT) {
            setCurrentPage('staging-editor');
        } else {
            setCurrentPage('loading-editor');
        }
    };

    const handlePrintSheet = (e: React.MouseEvent, sheet: SheetData) => {
        e.stopPropagation();
        setSelectedSheetId(sheet.id);
        setIsCreatingNew(false);
        setIsEditing(true);
        setOpenInPreviewMode(true);
        setCurrentPage('loading-editor');
    };

    const renderContent = () => {
        switch (currentPage) {
            case 'dashboard':
                return <AdminDashboard viewMode="analytics" onViewSheet={(s) => handleViewSheet(s)} onNavigate={handleNavigate} />;

            case 'admin':
                return <AdminDashboard viewMode="users" onViewSheet={(s) => handleViewSheet(s)} initialSearch={initialSearch} />;

            case 'database':
                return <AdminDashboard viewMode="database" onViewSheet={(s) => handleViewSheet(s)} />;

            case 'staging-editor':
                return <StagingSheet
                    key={isCreatingNew ? 'new' : activeSheet?.id}
                    existingSheet={isCreatingNew ? undefined : activeSheet || undefined}
                    onCancel={() => handleNavigate('staging')}
                    onLock={(updatedSheet) => { handleNavigate('staging'); }}
                    initialPreview={openInPreviewMode}
                />;

            case 'loading-editor':
                if (!activeSheet) return <div>Error loading sheet data. Please try again.</div>;
                return <LoadingSheet
                    key={activeSheet.id}
                    sheet={activeSheet}
                    onClose={() => handleNavigate('loading')}
                    initialPreview={openInPreviewMode}
                />;

            case 'staging':
            case 'loading':
                const isStagingView = currentPage === 'staging';
                const filteredSheets = sheets.filter(s => {
                    const matchesSearch = s.id.includes(searchTerm) || s.supervisorName.toLowerCase().includes(searchTerm.toLowerCase());
                    if (isStagingView) {
                        return matchesSearch;
                    } else {
                        return matchesSearch && (s.status === SheetStatus.LOCKED || s.status === SheetStatus.COMPLETED);
                    }
                });

                return (
                    <div className="space-y-6">
                        <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-lg shadow-sm border border-slate-200">
                            <div className="relative w-full md:w-96">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
                                <input
                                    type="text"
                                    placeholder="Search by Sheet ID or Supervisor..."
                                    className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                />
                            </div>
                            {isStagingView && (effectiveUser.role === Role.ADMIN || effectiveUser.role === Role.STAGING_SUPERVISOR) && (
                                <button
                                    onClick={handleCreateSheet}
                                    className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg flex items-center justify-center gap-2 font-medium shadow-lg shadow-blue-500/30 transition-all"
                                >
                                    <PlusCircle size={20} /> New Staging Sheet
                                </button>
                            )}
                        </div>

                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-xs">
                                    <tr>
                                        <th className="p-4">Sheet ID</th>
                                        <th className="p-4">Date</th>
                                        <th className="p-4">Shift</th>
                                        <th className="p-4">Status</th>
                                        <th className="p-4">Dock/Dest</th>
                                        <th className="p-4 text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredSheets.map(sheet => (
                                        <tr key={sheet.id} className="hover:bg-slate-50 transition cursor-pointer" onClick={() => handleViewSheet(sheet, currentPage)}>
                                            <td className="p-4 font-mono font-medium text-blue-600">{sheet.id}</td>
                                            <td className="p-4 text-slate-600">{sheet.date}</td>
                                            <td className="p-4 text-slate-600">{sheet.shift}</td>
                                            <td className="p-4">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold
                                                ${sheet.status === SheetStatus.DRAFT ? 'bg-slate-100 text-slate-600' :
                                                        sheet.status === SheetStatus.LOCKED ? 'bg-orange-100 text-orange-600' :
                                                            'bg-green-100 text-green-600'}`}>
                                                    {sheet.status}
                                                </span>
                                            </td>
                                            <td className="p-4 text-slate-600 font-medium">{sheet.loadingDockNo || sheet.destination || '-'}</td>
                                            <td className="p-4 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button className="p-2 text-slate-400 hover:text-blue-600 transition-colors" title="View/Edit">
                                                        {sheet.status === SheetStatus.DRAFT ? <Edit3 size={18} /> :
                                                            (sheet.status === SheetStatus.LOCKED && !isStagingView) ? <Lock size={18} /> : <Eye size={18} />}
                                                    </button>
                                                    {!isStagingView && sheet.status === SheetStatus.COMPLETED && (
                                                        <button
                                                            className="p-2 text-slate-400 hover:text-green-600 transition-colors"
                                                            title="Print Preview"
                                                            onClick={(e) => handlePrintSheet(e, sheet)}
                                                        >
                                                            <Printer size={18} />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredSheets.length === 0 && (
                                        <tr><td colSpan={6} className="p-8 text-center text-slate-400 italic">No sheets found.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                );

            case 'audit':
                return <AdminDashboard viewMode="audit" onViewSheet={(s) => handleViewSheet(s)} />;

            case 'approvals':
                return <AdminDashboard viewMode="approvals" onViewSheet={(s) => handleViewSheet(s)} onNavigate={handleNavigate} />;

            default:
                return <div>Page Not Found</div>;
        }
    };

    return (
        <ErrorBoundary>

            <Layout currentPage={currentPage} onNavigate={handleNavigate}>
                {renderContent()}
            </Layout>
        </ErrorBoundary>
    );
};

export default App;
