import React, { useMemo } from 'react';
import { useApp } from '../../AppContext';
import { SheetStatus } from '../../types';
import { CheckCircle2, Siren } from 'lucide-react';

export const SLAMonitorWidget = () => {
    const { sheets } = useApp();

    const slaStats = useMemo(() => {
        // Only care about COMPLETED loading sheets where data exists
        const validSheets = sheets.filter(s =>
            s.status === SheetStatus.COMPLETED &&
            s.loadingStartTime &&
            s.loadingEndTime
        );

        let breached = 0;
        let withinSla = 0;

        validSheets.forEach(s => {
            // Simple HH:mm diff (Assuming same day for simplicity unless dates diff)
            // In real app, use full timestamps. Here we assume HH:mm formats.
            const start = new Date(`1970-01-01T${s.loadingStartTime}:00`);
            const end = new Date(`1970-01-01T${s.loadingEndTime}:00`);
            let diffMins = (end.getTime() - start.getTime()) / 60000;

            // Handle overnight crossing if needed (simple hack: if negative, add 24h)
            if (diffMins < 0) diffMins += 24 * 60;

            if (diffMins > 40) breached++;
            else withinSla++;
        });

        const total = breached + withinSla;
        const adherence = total > 0 ? Math.round((withinSla / total) * 100) : 100;

        return { breached, withinSla, adherence, total };
    }, [sheets]);

    return (
        <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-red-50 p-4 rounded-lg border border-red-100 flex flex-col items-center justify-center text-center">
                    <Siren className="text-red-500 mb-2" size={24} />
                    <span className="text-3xl font-bold text-red-700">{slaStats.breached}</span>
                    <span className="text-xs text-red-600 font-bold uppercase">Breaches</span>
                </div>
                <div className="bg-green-50 p-4 rounded-lg border border-green-100 flex flex-col items-center justify-center text-center">
                    <CheckCircle2 className="text-green-500 mb-2" size={24} />
                    <span className="text-3xl font-bold text-green-700">{slaStats.adherence}%</span>
                    <span className="text-xs text-green-600 font-bold uppercase">Adherence</span>
                </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs text-slate-500 text-center">
                <span className="font-bold text-slate-700">Service Level Agreement:</span> Loading duration must not exceed <span className="font-bold text-slate-800">40 minutes</span>.
            </div>
        </div>
    );
};
