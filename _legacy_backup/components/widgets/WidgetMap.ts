import React from 'react';

// Lazy load widgets to prevent circular dependency / initialization issues
// Lazy load widgets to prevent circular dependency / initialization issues
const StaffPerformanceWidget = React.lazy(() => import('./StaffPerformanceWidget').then(module => ({ default: module.StaffPerformanceWidget })));
const SLAMonitorWidget = React.lazy(() => import('./SLAMonitorWidget').then(module => ({ default: module.SLAMonitorWidget })));

// DUMMY COMPONENTS FOR DEBUGGING (Removed)

export const WIDGET_COMPONENTS: Record<string, React.LazyExoticComponent<any>> = {
    'staff-performance': StaffPerformanceWidget,
    'sla-monitor': SLAMonitorWidget,
};
