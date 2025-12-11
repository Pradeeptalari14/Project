import { WidgetMeta } from './types';

export const WIDGET_METADATA: WidgetMeta[] = [
    {
        id: 'staff-performance',
        title: 'Staff Performance & Activity',
        category: 'Analytics',
        description: 'Track user activity, completed sheets, and current working status.',
        defaultSize: 'large'
    },
    {
        id: 'sla-monitor',
        title: 'SLA Compliance Monitor',
        category: 'Analytics',
        description: 'Monitor loading times against 40-minute SLA.',
        defaultSize: 'medium'
    }
];

export const getWidgetMeta = (id: string) => WIDGET_METADATA.find(w => w.id === id);
