import React, { useMemo } from 'react';
import { useApp } from '../../AppContext';
import { Role, SheetStatus } from '../../types';
import { Clock, AlertTriangle } from 'lucide-react';

export const StaffPerformanceWidget = () => {
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
                // Completed Today
                const completedToday = sheets.filter(s =>
                    s.status === SheetStatus.COMPLETED &&
                    isToday(s.date) &&
                    (s.supervisorName === u.username || s.loadingSvName === u.username)
                ).length;

                // Active (Locked/Draft owned by user)
                const active = sheets.filter(s =>
                    s.status !== SheetStatus.COMPLETED &&
                    (s.supervisorName === u.username || s.loadingSvName === u.username)
                ).length;

                // SLA Breaches (Last 24h)
                const breaches = sheets.filter(s => {
                    const isOwner = (s.supervisorName === u.username || s.loadingSvName === u.username);
                    if (!isOwner || !s.loadingStartTime || !s.loadingEndTime) return false;

                    // Simple HH:mm diff
                    const start = new Date(`1970-01-01T${s.loadingStartTime}:00`);
                    const end = new Date(`1970-01-01T${s.loadingEndTime}:00`);
                    const diffMins = (end.getTime() - start.getTime()) / 60000;

                    return diffMins > 40;
                }).length;

                return { ...u, completedToday, active, breaches };
            })
            .sort((a, b) => b.completedToday - a.completedToday);
    }, [users, sheets]);

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-xs">
                    <tr>
                        <th className="p-3">Staff Member</th>
                        <th className="p-3 text-center">Todays Done</th>
                        <th className="p-3 text-center">Active Now</th>
                        <th className="p-3 text-center">SLA Breaches</th>
                        <th className="p-3 text-center">Status</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {staffStats.map(staff => (
                        <tr key={staff.id} className="hover:bg-slate-50">
                            <td className="p-3 font-medium text-slate-700">
                                <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${staff.role === Role.STAGING_SUPERVISOR ? 'bg-blue-500' : 'bg-orange-500'}`}></div>
                                    <div className="flex flex-col">
                                        <span>{staff.fullName || staff.username}</span>
                                        <span className="text-[10px] text-slate-400 uppercase">{staff.role.replace('_SUPERVISOR', '')}</span>
                                    </div>
                                </div>
                            </td>
                            <td className="p-3 text-center font-bold text-slate-800">{staff.completedToday}</td>
                            <td className="p-3 text-center font-bold text-blue-600">{staff.active}</td>
                            <td className="p-3 text-center">
                                {staff.breaches > 0 ? (
                                    <span className="inline-flex items-center gap-1 text-red-600 font-bold bg-red-50 px-2 py-1 rounded-full text-xs">
                                        <AlertTriangle size={10} /> {staff.breaches}
                                    </span>
                                ) : <span className="text-slate-300">-</span>}
                            </td>
                            <td className="p-3 text-center">
                                {staff.active > 0 ? (
                                    <span className="text-green-600 text-xs font-bold flex items-center justify-center gap-1"><Clock size={12} /> Working</span>
                                ) : (
                                    <span className="text-slate-400 text-xs flex items-center justify-center gap-1">Idle</span>
                                )}
                            </td>
                        </tr>
                    ))}
                    {staffStats.length === 0 && (
                        <tr><td colSpan={5} className="p-4 text-center text-slate-400">No active staff found.</td></tr>
                    )}
                </tbody>
            </table>
        </div>
    );
};
