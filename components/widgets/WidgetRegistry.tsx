import React from 'react';
import { WidgetDefinition } from './types';
import { StaffPerformanceWidget } from './StaffPerformanceWidget';
import { SLAMonitorWidget } from './SLAMonitorWidget';


// Simple placeholder components for other widgets


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
    }
    // We can add more wrappers here later for generic charts
];

export const getWidgetDefinition = (id: string) => widgetRegistry.find(w => w.id === id);
