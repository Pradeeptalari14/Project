import { StaffPerformanceWidget } from './StaffPerformanceWidget';
import { SLAMonitorWidget } from './SLAMonitorWidget';

export const WIDGET_COMPONENTS: Record<string, React.ComponentType<any>> = {
    'staff-performance': StaffPerformanceWidget,
    'sla-monitor': SLAMonitorWidget,
};
