import React from 'react';
import { WidgetDefinition } from './types';
import { StaffPerformanceWidget } from './StaffPerformanceWidget';
import { SLAMonitorWidget } from './SLAMonitorWidget';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer
} from 'recharts';

// Simple placeholder components for other widgets
const KPIScoreCard = ({ title, value, subtext, icon: Icon, color }: any) => (
    <div className="h-full flex flex-col justify-between">
        <div className="flex items-center gap-2 mb-2">
            <div className={`p-2 rounded-lg \${color} bg-opacity-10 text-opacity-100`}>
                {Icon && <Icon size={18} />}
            </div>
            <span className="text-slate-500 font-bold text-xs uppercase">{title}</span>
        </div>
        <div className="text-2xl font-bold text-slate-800">{value}</div>
        <div className="text-xs text-slate-400">{subtext}</div>
    </div>
);

// Registry
export const widgetRegistry: WidgetDefinition[] = [
    {
        id: 'staff-performance',
        title: 'Staff Performance & Activity',
        category: 'Analytics',
        description: 'Track user activity, completed sheets, and current working status.',
        defaultSize: 'large',
        component: StaffPerformanceWidget
    },
    {
        id: 'sla-monitor',
        title: 'SLA Compliance Monitor',
        category: 'Analytics',
        description: 'Monitor loading times against 40-minute SLA.',
        defaultSize: 'medium',
        component: SLAMonitorWidget
];
    // We can add more wrappers here later for generic charts
];

export const getWidgetDefinition = (id: string) => widgetRegistry.find(w => w.id === id);
