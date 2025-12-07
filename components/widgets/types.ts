import React, { ReactNode } from 'react';

export interface WidgetProps {
    id: string;
    title: string;
    onRemove?: () => void;
    onNavigate?: (page: string, filter?: string) => void;
}

export interface WidgetDefinition {
    id: string;
    title: string;
    category: 'Score Card' | 'Chart' | 'List' | 'Analytics';
    description: string;
    defaultSize: 'small' | 'medium' | 'large' | 'full';
    component: React.ComponentType<any>;
}

export interface UserWidgetConfig {
    id: string;
    widgetId: string; // Refers to the definition ID
    layout?: any;
}
