import React, { useState } from 'react';
import { AlertTriangle, X, Send } from 'lucide-react';
import { IncidentType, IncidentPriority } from '../types';
import { supabase } from '../services/supabaseClient';

interface IncidentModalProps {
    sheetId: string;
    currentUser: string;
    onClose: () => void;
    onSuccess: () => void;
}

export const IncidentModal: React.FC<IncidentModalProps> = ({ sheetId, currentUser, onClose, onSuccess }) => {
    const [type, setType] = useState<IncidentType>('OTHER');
    const [priority, setPriority] = useState<IncidentPriority>('MEDIUM');
    const [description, setDescription] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!description.trim()) {
            setError('Please provide a description');
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            const { error: insertError } = await supabase
                .from('incidents')
                .insert({
                    sheet_id: sheetId,
                    type,
                    description,
                    priority,
                    status: 'OPEN',
                    created_by: currentUser
                });

            if (insertError) throw insertError;

            onSuccess();
            onClose();
        } catch (err: any) {
            setError(err.message || 'Failed to submit incident');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
                <div className="p-4 border-b border-rose-100 bg-rose-50 flex justify-between items-center">
                    <h3 className="font-bold text-rose-700 flex items-center gap-2">
                        <AlertTriangle size={20} /> Report Incident
                    </h3>
                    <button onClick={onClose} className="text-rose-400 hover:text-rose-700 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {error && (
                        <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
                            {error}
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Type</label>
                            <select
                                value={type}
                                onChange={(e) => setType(e.target.value as IncidentType)}
                                className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-rose-500 outline-none"
                            >
                                <option value="DAMAGE">Damage</option>
                                <option value="SHORTAGE">Shortage</option>
                                <option value="QUALITY">Quality</option>
                                <option value="SAFETY">Safety</option>
                                <option value="OTHER">Other</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Priority</label>
                            <select
                                value={priority}
                                onChange={(e) => setPriority(e.target.value as IncidentPriority)}
                                className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-rose-500 outline-none"
                            >
                                <option value="LOW">Low</option>
                                <option value="MEDIUM">Medium</option>
                                <option value="HIGH">High</option>
                                <option value="CRITICAL">Critical</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Describe the issue in detail..."
                            rows={4}
                            className="w-full p-3 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-rose-500 outline-none resize-none"
                        />
                    </div>

                    <div className="pt-2 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-slate-500 hover:bg-slate-50 rounded-lg text-sm font-medium transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex items-center gap-2 px-6 py-2 bg-rose-600 text-white rounded-lg text-sm font-bold hover:bg-rose-700 transition-colors shadow-sm disabled:opacity-50"
                        >
                            {isSubmitting ? 'Sending...' : <><Send size={16} /> Submit Report</>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
