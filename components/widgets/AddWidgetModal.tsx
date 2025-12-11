import React from 'react';
import { WIDGET_METADATA } from './WidgetMetadata';
import { Plus, X } from 'lucide-react';

interface AddWidgetModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (widgetId: string) => void;
    activeWidgets: string[];
}

export const AddWidgetModal: React.FC<AddWidgetModalProps> = ({ isOpen, onClose, onAdd, activeWidgets }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex justify-end backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
                <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <Plus size={20} className="text-blue-600" /> Add Content
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-6">
                    {/* Categories */}
                    {['Analytics', 'Score Card', 'Chart', 'List'].map(category => {
                        const widgets = WIDGET_METADATA.filter(w => w.category === category);
                        if (widgets.length === 0) return null;

                        return (
                            <div key={category}>
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">{category}</h4>
                                <div className="space-y-3">
                                    {widgets.map(widget => {
                                        const isActive = activeWidgets.includes(widget.id);
                                        return (
                                            <div key={widget.id} className="border border-slate-200 rounded-xl p-4 hover:border-blue-400 hover:shadow-md transition-all group">
                                                <div className="flex justify-between items-start mb-2">
                                                    <h5 className="font-bold text-slate-700">{widget.title}</h5>
                                                    <button
                                                        onClick={() => !isActive && onAdd(widget.id)}
                                                        disabled={isActive}
                                                        className={`px-3 py-1 text-xs font-bold rounded-full transition-colors \${isActive ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'}`}
                                                    >
                                                        {isActive ? 'Added' : 'Add'}
                                                    </button>
                                                </div>
                                                <p className="text-xs text-slate-500 leading-relaxed">{widget.description}</p>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
