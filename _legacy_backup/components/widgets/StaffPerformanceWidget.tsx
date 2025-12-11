import React, { useMemo } from 'react';
import { useApp } from '../../AppContext';
import { Role, SheetStatus } from '../../types';
import { Clock, AlertTriangle, Calendar, Activity } from 'lucide-react';

export const StaffPerformanceWidget = ({ onNavigate }: { onNavigate?: (page: string, filter?: string) => void }) => {
    const { users, sheets, currentUser } = useApp();

    // Helper for robust date checking
    const isToday = (dateStr: string) => {
        if (!dateStr) return false;
        const today = new Date();
        const d = new Date(dateStr);
        if (dateStr === today.toISOString().split('T')[0]) return true;
        if (dateStr === today.toLocaleDateString()) return true;
        return !isNaN(d.getTime()) && d.toDateString() === today.toDateString();
    };

    const isYesterday = (dateStr: string) => {
        if (!dateStr) return false;
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const d = new Date(dateStr);
        // Simple comparison using toDateString handles date boundaries correctly
        return !isNaN(d.getTime()) && d.toDateString() === yesterday.toDateString();
    };

    const formatTimeAgo = (isoString?: string) => {
        if (!isoString) return '-';
        const date = new Date(isoString);
        if (isNaN(date.getTime())) return '-';

        const now = new Date();
        const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

        if (diffInSeconds < 60) return 'Just now';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
        return `${Math.floor(diffInSeconds / 86400)}d ago`;
    };

    const staffStats = useMemo(() => {
        return users
            .filter(u => {
                if (!u.isApproved) return false;

                // Role-based visibility
                if (currentUser?.role === Role.STAGING_SUPERVISOR) {
                    return u.role === Role.STAGING_SUPERVISOR;
                }
                if (currentUser?.role === Role.LOADING_SUPERVISOR) {
                    return u.role === Role.LOADING_SUPERVISOR;
                }
                // Admin sees both
                return u.role === Role.STAGING_SUPERVISOR || u.role === Role.LOADING_SUPERVISOR;
            })
            .map(u => {
                const userSheets = sheets.filter(s =>
                    s.supervisorName === u.username || s.loadingSvName === u.username ||
                    s.createdBy === u.username || s.completedBy === u.username
                );

                // Metrics
                const completedToday = userSheets.filter(s => s.status === SheetStatus.COMPLETED && isToday(s.date)).length;
                const completedYesterday = userSheets.filter(s => s.status === SheetStatus.COMPLETED && isYesterday(s.date)).length;
                const totalCompleted = userSheets.filter(s => s.status === SheetStatus.COMPLETED).length;

                // Active (Locked/Draft owned by user)
                const active = userSheets.filter(s => s.status !== SheetStatus.COMPLETED).length;

                // Last Active Timestamp
                // Find the most recent sheet interaction
                const lastSheet = userSheets.sort((a, b) => {
                    const timeA = new Date(a.updatedAt || a.createdAt).getTime();
                    const timeB = new Date(b.updatedAt || b.createdAt).getTime();
                    return timeB - timeA;
                })[0];
                const lastActiveTime = lastSheet ? (lastSheet.updatedAt || lastSheet.createdAt) : undefined;


                // SLA Breaches (Last 24h)
                const breaches = userSheets.filter(s => {
                    if (!s.loadingStartTime || !s.loadingEndTime) return false;

                    // Simple HH:mm diff
                    const start = new Date(`1970-01-01T${s.loadingStartTime}`);
                    const end = new Date(`1970-01-01T${s.loadingEndTime}`);
                    if (isNaN(start.getTime()) || isNaN(end.getTime())) return false;

                    const diffMins = (end.getTime() - start.getTime()) / 60000;
                    return diffMins > 40;
                }).length;

                return {
                    ...u,
                    completedToday,
                    completedYesterday,
                    totalCompleted,
                    active,
                    lastActiveTime,
                    breaches
                };
            })
            .sort((a, b) => b.completedToday - a.completedToday);
    }, [users, sheets]);

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-xs">
                    <tr>
                        <th className="p-3">Staff Member</th>
                        <th className="p-3 text-center">Last Active</th>
                        <th className="p-3 text-center">Today</th>
                        <th className="p-3 text-center">Yesterday</th>
                        <th className="p-3 text-center">Total</th>
                        <th className="p-3 text-center">Status</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {staffStats.map(staff => (
                        <tr
                            key={staff.id}
                            className="hover:bg-blue-50 cursor-pointer transition-colors group"
                            onClick={() => onNavigate?.('database', staff.username)}
                            title="Click to view detailed records"
                        >
                            <td className="p-3 font-medium text-slate-700">
                                <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${staff.role === Role.STAGING_SUPERVISOR ? 'bg-blue-500' : 'bg-orange-500'}`}></div>
                                    <div className="flex flex-col">
                                        <span>{staff.fullName || staff.username}</span>
                                        <span className="text-[10px] text-slate-400 uppercase">{staff.role.replace('_SUPERVISOR', '')}</span>
                                    </div>
                                </div>
                            </td>
                            <td className="p-3 text-center text-xs text-slate-500">
                                {formatTimeAgo(staff.lastActiveTime)}
                            </td>
                            <td className="p-3 text-center font-bold text-emerald-600 bg-emerald-50/50 rounded-lg">{staff.completedToday}</td>
                            <td className="p-3 text-center font-medium text-slate-600">{staff.completedYesterday}</td>
                            <td className="p-3 text-center font-bold text-slate-800">{staff.totalCompleted}</td>
                            <td className="p-3 text-center">
                                {staff.active > 0 ? (
                                    <span className="text-green-600 text-xs font-bold flex items-center justify-center gap-1"><Activity size={12} /> Working</span>
                                ) : (
                                    <span className="text-slate-400 text-xs flex items-center justify-center gap-1">Idle</span>
                                )}
                            </td>
                        </tr>
                    ))}
                    {staffStats.length === 0 && (
                        <tr><td colSpan={6} className="p-4 text-center text-slate-400">No active staff found.</td></tr>
                    )}
                </tbody>
            </table>
        </div>
    );
};
