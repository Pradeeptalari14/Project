import React from 'react';
import { useApp } from '../../AppContext';
import { AlertTriangle, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { IncidentPriority, IncidentStatus, SheetData, Incident } from '../../types';

interface IncidentListWidgetProps {
    onViewSheet: (sheet: SheetData) => void;
}

const PriorityBadge = ({ priority }: { priority: IncidentPriority }) => {
    const colors = {
        LOW: 'bg-slate-100 text-slate-700',
        MEDIUM: 'bg-blue-50 text-blue-700',
        HIGH: 'bg-orange-50 text-orange-700',
        CRITICAL: 'bg-red-50 text-red-700 border-red-200'
    };
    return <span className={`px-2 py-0.5 rounded text-[10px] font-bold border border-transparent ${colors[priority]}`}>{priority}</span>;
};

const StatusBadge = ({ status }: { status: IncidentStatus }) => {
    const styles = {
        OPEN: { bg: 'bg-rose-100', text: 'text-rose-700', icon: AlertCircle },
        IN_PROGRESS: { bg: 'bg-amber-100', text: 'text-amber-700', icon: Clock },
        RESOLVED: { bg: 'bg-green-100', text: 'text-green-700', icon: CheckCircle }
    };
    const Conf = styles[status];
    const Icon = Conf.icon;
    return (
        <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${Conf.bg} ${Conf.text}`}>
            <Icon size={10} /> {status.replace('_', ' ')}
        </span>
    );
};

export const IncidentListWidget: React.FC<IncidentListWidgetProps> = ({ onViewSheet }) => {
    const { incidents, sheets } = useApp();

    const resolveSheet = (sheetId: string) => sheets.find(s => s.id === sheetId);

    if (incidents.length === 0) {
        return (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
                <div className="bg-green-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle size={32} className="text-green-600" />
                </div>
                <h3 className="text-lg font-bold text-slate-800">No Open Incidents</h3>
                <p className="text-slate-500 text-sm">Operations are running smoothly.</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                <h3 className="font-bold text-slate-700 flex items-center gap-2">
                    <AlertTriangle size={18} className="text-rose-500" />
                    Reported Incidents
                    <span className="bg-rose-100 text-rose-700 text-xs px-2 py-0.5 rounded-full">{incidents.length}</span>
                </h3>
            </div>
            <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto custom-scrollbar">
                {incidents.map((inc) => {
                    const sheet = resolveSheet(inc.sheetId);
                    return (
                        <div key={inc.id} className="p-4 hover:bg-slate-50 transition-colors group">
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center gap-2">
                                    <PriorityBadge priority={inc.priority} />
                                    <span className="text-xs font-bold text-slate-500">{inc.type}</span>
                                </div>
                                <StatusBadge status={inc.status} />
                            </div>

                            <p className="text-sm text-slate-800 font-medium mb-2">{inc.description}</p>

                            <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-500 gap-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span>By: <span className="font-semibold text-slate-700">{inc.createdBy}</span></span>
                                    <span className="hidden sm:inline text-slate-300">|</span>
                                    <span>Sheet:
                                        {sheet ? (
                                            <button
                                                onClick={() => onViewSheet(sheet)}
                                                className="ml-1 text-blue-600 hover:underline font-medium"
                                            >
                                                {sheet.id}
                                            </button>
                                        ) : (
                                            <span className="ml-1 text-slate-400">#{inc.sheetId}</span>
                                        )}
                                    </span>
                                </div>
                                <span className="font-mono text-[10px] sm:text-xs text-slate-400">
                                    {new Date(inc.createdAt).toLocaleDateString()} {new Date(inc.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
