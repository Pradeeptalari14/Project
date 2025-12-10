import React, { useState, useEffect } from 'react';
import {
    Save, Lock, Printer, ArrowLeft, Plus, Calendar, MapPin, User,
    FileText, CheckCircle, AlertTriangle, ImageIcon, Trash2, Truck, UserCheck
} from 'lucide-react';
import { useApp } from '../AppContext';
import { Role, SheetStatus, SheetData } from '../types';
import { IncidentModal } from './IncidentModal';

interface Props {
    existingSheet?: SheetData;
    onCancel: () => void;
    onLock: (sheet: SheetData) => void;
    initialPreview?: boolean;
}

const EMPTY_STAGING_ITEMS = [];

export const StagingSheet: React.FC<Props> = ({ existingSheet, onCancel, onLock, initialPreview = false }) => {
    const { currentUser, addSheet, updateSheet, acquireLock, releaseLock } = useApp();
    const isLocked = (existingSheet?.status === SheetStatus.LOCKED || existingSheet?.status === SheetStatus.COMPLETED || existingSheet?.status === SheetStatus.STAGING_VERIFICATION_PENDING) && currentUser?.role !== Role.ADMIN ||
        (existingSheet?.status === SheetStatus.DRAFT && existingSheet.createdBy !== currentUser?.username && currentUser?.role !== Role.ADMIN);

    // Shift Lead Approval Mode
    const isPendingApproval = existingSheet?.status === SheetStatus.STAGING_VERIFICATION_PENDING;
    const canApprove = currentUser?.role === Role.SHIFT_LEAD || currentUser?.role === Role.ADMIN;

    // Checklist State
    const [stagingChecks, setStagingChecks] = useState({ qty: false, condition: false, sign: false });

    // Incident Modal State (ADDED)
    const [isIncidentModalOpen, setIncidentModalOpen] = useState(false);

    // Print Preview State
    const [isPreview, setIsPreview] = useState(initialPreview);

    // Header State
    const [shift, setShift] = useState(existingSheet?.shift || 'A');
    const [date, setDate] = useState(existingSheet?.date || new Date().toLocaleDateString('en-US'));
    const [destination, setDestination] = useState(existingSheet?.destination || '');

    // Auto-fill Supervisor and Emp Code from Current User (Creator) if new, otherwise preserve existing
    const [supervisorName, setSupervisorName] = useState(existingSheet?.supervisorName || currentUser?.fullName || currentUser?.username || '');
    const [empCode, setEmpCode] = useState(existingSheet?.empCode || currentUser?.empCode || '');

    const [loadingDockNo, setLoadingDockNo] = useState(existingSheet?.loadingDockNo || '');

    // Loading times for print view
    const loadingStartTime = existingSheet?.loadingStartTime || '';
    const loadingEndTime = existingSheet?.loadingEndTime || '';

    // Dirty State for Unsaved Changes
    const [isDirty, setIsDirty] = useState(false);

    // Items State
    const [items, setItems] = useState<any[]>(() => {
        const initial = existingSheet?.stagingItems || EMPTY_STAGING_ITEMS;
        // Ensure we have at least 20 rows for the Excel look
        const targetRows = 20;
        const rows = initial.length < targetRows
            ? [...initial, ...Array.from({ length: targetRows - initial.length }, (_, i) => ({ srNo: initial.length + i + 1, skuName: '', casesPerPlt: '', fullPlt: '', loose: '', ttlCases: '' }))]
            : initial;

        return JSON.parse(JSON.stringify(rows)).map((item: any) => ({
            ...item,
            casesPerPlt: (item.casesPerPlt === 0 && !isLocked) ? '' : item.casesPerPlt,
            fullPlt: (item.fullPlt === 0 && !isLocked) ? '' : item.fullPlt,
            loose: (item.loose === 0 && !isLocked) ? '' : item.loose
        }));
    });

    const [totalQty, setTotalQty] = useState(0);

    // Sync state if props change (e.g. ID change)
    useEffect(() => {
        if (existingSheet) {
            setShift(existingSheet.shift);
            setDate(existingSheet.date);
            setDestination(existingSheet.destination);
            setSupervisorName(existingSheet.supervisorName);
            setEmpCode(existingSheet.empCode);
            setLoadingDockNo(existingSheet.loadingDockNo || '');
            // We re-initialize items ONLY if sheet ID changed, preserving local edits otherwise
        } else {
            setSupervisorName(currentUser?.fullName || currentUser?.username || '');
            setEmpCode(currentUser?.empCode || '');
        }
    }, [existingSheet?.id]); // Only refire if ID changes

    useEffect(() => {
        const total = items.reduce((acc, item) => acc + (Number(item.ttlCases) || 0), 0);
        setTotalQty(total);
    }, [items]);

    const handleItemChange = (index: number, field: string, value: any) => {
        if (isLocked) return;
        setIsDirty(true);
        const newItems = [...items];
        let typedValue: string | number = value;
        if (['casesPerPlt', 'fullPlt', 'loose'].includes(field)) {
            typedValue = value === '' ? '' : Number(value);
        }
        const item = { ...newItems[index], [field]: typedValue };
        const cases = item.casesPerPlt === '' ? 0 : item.casesPerPlt;
        const full = item.fullPlt === '' ? 0 : item.fullPlt;
        const loose = item.loose === '' ? 0 : item.loose;
        item.ttlCases = (Number(cases) * Number(full)) + Number(loose);
        newItems[index] = item;
        setItems(newItems);
    };


    const handleRemoveItem = (index: number) => {
        if (isLocked) return;
        if (items.length <= 1) {
            alert("Cannot delete the last row.");
            return;
        }

        if (confirm("Are you sure you want to delete this item?")) {
            const newItems = items.filter((_, i) => i !== index).map((item, i) => ({
                ...item,
                srNo: i + 1 // Re-index logic
            }));

            // If we removed the last item and now have fewer than 15, we might want to pad it back or just leave it.
            // For now, let's keep it dynamic but ensure at least one empty row if needed? 
            // The request was just to delete.

            setItems(newItems);
            setIsDirty(true);
        }
    };

    const handleAddItem = () => {
        setItems(prev => [
            ...prev,
            { srNo: prev.length + 1, skuName: '', casesPerPlt: '', fullPlt: '', loose: '', ttlCases: '' }
        ]);
        setIsDirty(true);
    };

    const validateForm = (itemsToValidate: any[], strict: boolean): string[] => {
        const errors: string[] = [];
        if (strict && !destination.trim()) errors.push("Destination is required");
        if (strict && !loadingDockNo.trim()) errors.push("Loading Dock No is required");

        let hasAtLeastOneItem = false;
        itemsToValidate.forEach(item => {
            const hasName = String(item.skuName).trim() !== '';
            // "All or Nothing" Rule logic or partial row check
            if (hasName) {
                hasAtLeastOneItem = true;
            }
        });

        if (strict && !hasAtLeastOneItem && errors.length === 0) {
            errors.push("At least one valid item row (SKU Name) is required to lock.");
        }
        return errors;
    };

    const handleSave = async (lock: boolean, e?: React.MouseEvent) => {
        if (e) { e.preventDefault(); e.stopPropagation(); }

        try {
            const errors = validateForm(items, lock);
            if (errors.length > 0) {
                alert("Validation Failed:\n\n" + errors.map(e => "• " + e).join("\n"));
                return;
            }

            const finalItems: StagingItem[] = items.map(item => {
                const c = item.casesPerPlt === '' ? 0 : Number(item.casesPerPlt);
                const f = item.fullPlt === '' ? 0 : Number(item.fullPlt);
                const l = item.loose === '' ? 0 : Number(item.loose);
                return { ...item, casesPerPlt: c, fullPlt: f, loose: l, ttlCases: (c * f) + l };
            });

            const sheetId = existingSheet?.id || `SH - ${Date.now()} `;

            if (lock) {
                const hasLock = acquireLock(sheetId);
                if (!hasLock) {
                    alert("Cannot Lock: This sheet is currently locked by another user.");
                    return;
                }
            }

            // Generate downstream data (Loading Matrix) if locking
            let finalLoadingItems: LoadingItemData[] = existingSheet?.loadingItems || [];
            let finalAdditionalItems: AdditionalItem[] = existingSheet?.additionalItems || [];

            if (lock) {
                const validStagingItems = finalItems.filter(item => item.skuName && item.ttlCases > 0);
                finalLoadingItems = validStagingItems.map(sItem => {
                    const existingLoadingItem = finalLoadingItems.find(li => li.skuSrNo === sItem.srNo);
                    if (existingLoadingItem) {
                        return { ...existingLoadingItem, balance: sItem.ttlCases - existingLoadingItem.total };
                    } else {
                        return { skuSrNo: sItem.srNo, cells: [], looseInput: 0, total: 0, balance: sItem.ttlCases };
                    }
                });
                if (finalAdditionalItems.length === 0) {
                    finalAdditionalItems = Array.from({ length: 5 }, (_, i) => ({ id: i + 1, skuName: '', counts: Array(10).fill(0), total: 0 }));
                }
            }

            const sheetData: SheetData = {
                id: sheetId,
                status: lock ? SheetStatus.STAGING_VERIFICATION_PENDING : SheetStatus.DRAFT,
                version: (existingSheet?.version || 0),
                shift,
                date,
                destination,
                supervisorName,
                empCode,
                loadingDoc: '', // Removed input but keeping empty string for type compatibility
                loadingDockNo,
                stagingItems: finalItems,
                loadingItems: finalLoadingItems,
                additionalItems: finalAdditionalItems,
                // Preserve existing loading data if any
                transporter: existingSheet?.transporter,
                loadingStartTime: existingSheet?.loadingStartTime,
                loadingEndTime: existingSheet?.loadingEndTime,
                pickingBy: existingSheet?.pickingBy,
                pickingCrosscheckedBy: existingSheet?.pickingCrosscheckedBy,
                vehicleNo: existingSheet?.vehicleNo,
                sealNo: existingSheet?.sealNo,
                driverName: existingSheet?.driverName,
                regSerialNo: existingSheet?.regSerialNo,
                loadingSvName: existingSheet?.loadingSvName,
                loadingSupervisorSign: existingSheet?.loadingSupervisorSign,
                slSign: existingSheet?.slSign,
                deoSign: existingSheet?.deoSign,

                createdBy: existingSheet?.createdBy || currentUser?.username || 'Unknown',
                createdAt: existingSheet?.createdAt || new Date().toISOString(),
                lockedBy: lock ? currentUser?.username : existingSheet?.lockedBy,
                lockedAt: lock ? new Date().toISOString() : existingSheet?.lockedAt,
                capturedImages: existingSheet?.capturedImages || [],
                comments: existingSheet?.comments || [],
                history: existingSheet?.history || []
            };

            if (existingSheet) updateSheet(sheetData);
            else addSheet(sheetData);

            setIsDirty(false);

            if (lock) {
                onLock(sheetData);
                releaseLock(sheetId);
            } else {
                onCancel();
            }

        } catch (err) {
            console.error("Error saving sheet:", err);
            alert("An unexpected error occurred while saving.");
        }
    };

    const handleApprove = async (approve: boolean) => {
        if (!existingSheet) return;

        if (approve) {
            if (confirm("Confirm approval of this Staging Sheet? It will be locked for loading.")) {
                const updatedSheet: SheetData = {
                    ...existingSheet,
                    status: SheetStatus.LOCKED,
                    stagingApprovedBy: currentUser?.username,
                    stagingApprovedAt: new Date().toISOString(),
                    slSign: currentUser?.fullName, // Auto-sign with name
                    lockedBy: currentUser?.username, // Technically the SL is "locking" it now
                    lockedAt: new Date().toISOString()
                };

                // Ensure loading items are generated if not present (redundant safety)
                if ((!updatedSheet.loadingItems || updatedSheet.loadingItems.length === 0) && updatedSheet.stagingItems) {
                    const validStagingItems = updatedSheet.stagingItems.filter(item => item.skuName && item.ttlCases > 0);
                    updatedSheet.loadingItems = validStagingItems.map(sItem => ({ skuSrNo: sItem.srNo, cells: [], looseInput: 0, total: 0, balance: sItem.ttlCases }));
                    updatedSheet.additionalItems = Array.from({ length: 5 }, (_, i) => ({ id: i + 1, skuName: '', counts: Array(10).fill(0), total: 0 }));
                }

                updateSheet(updatedSheet);
                onLock(updatedSheet); // Refreshes parent view
            }
        } else {
            const reason = prompt("Enter rejection reason:");
            if (reason) {
                const updatedSheet: SheetData = {
                    ...existingSheet,
                    status: SheetStatus.DRAFT,
                    rejectionReason: reason,
                    history: [...(existingSheet.history || []), {
                        id: Date.now().toString(),
                        actor: currentUser?.username || 'Unknown',
                        action: 'REJECTED_STAGING',
                        timestamp: new Date().toISOString(),
                        details: `Rejected: ${reason} `
                    }]
                };
                updateSheet(updatedSheet);
                onCancel(); // Close or refresh
            }
        }
    };

    const handleBack = () => {
        if (isDirty) {
            if (window.confirm("You have unsaved changes. Are you sure you want to discard them?")) {
                onCancel();
            }
        } else {
            onCancel();
        }
    };

    const handlePrint = () => {
        if (window.confirm("Are you sure you want to print this sheet?")) {
            setIsPreview(true);
            setTimeout(() => window.print(), 300);
        }
    };

    const togglePreview = () => setIsPreview(!isPreview);
    const printNow = () => window.print();

    return (
        <div className="bg-white shadow-xl shadow-slate-200 rounded-xl pb-24 relative border border-slate-100 flex flex-col min-h-full">
            {/* Top Controls (Screen Only) */}
            {!isPreview && (
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-4 md:p-6 border-b border-slate-100 bg-white print:hidden gap-4">
                    <div>
                        <button onClick={handleBack} className="text-slate-500 hover:text-blue-600 text-sm flex items-center gap-1 mb-2 transition-colors">
                            <ArrowLeft size={16} /> Back
                        </button>
                        <div className="flex items-center gap-3">
                            <h2 className="text-xl md:text-2xl font-bold text-slate-800 tracking-tight">Staging Check Sheet</h2>
                            {isLocked && !isPendingApproval && <span className="bg-orange-100 text-orange-700 text-xs px-2.5 py-1 rounded-full font-bold border border-orange-200">LOCKED</span>}
                            {isPendingApproval && <span className="bg-purple-100 text-purple-700 text-xs px-2.5 py-1 rounded-full font-bold border border-purple-200 flex items-center gap-1"><AlertTriangle size={12} /> PENDING APPROVAL</span>}
                            {existingSheet?.status === SheetStatus.DRAFT && <span className="bg-slate-100 text-slate-600 text-xs px-2.5 py-1 rounded-full font-medium border border-slate-200">DRAFT</span>}
                            {isDirty && !isLocked && <span className="text-amber-500 text-xs flex items-center gap-1"><AlertTriangle size={12} /> Unsaved Changes</span>}
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => setIncidentModalOpen(true)} className="bg-rose-50 text-rose-600 border border-rose-200 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-rose-100 transition-colors">
                            <AlertTriangle size={16} /> Report Incident
                        </button>
                        <button onClick={togglePreview} className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-slate-700 transition-colors">
                            <Printer size={16} /> Print Preview
                        </button>
                    </div>
                </div>
            )}

            {/* Preview Control Bar */}
            {isPreview && (
                <div className="bg-slate-800 text-white p-4 rounded-b-xl shadow-lg flex justify-between items-center print:hidden sticky top-0 z-50">
                    <div className="flex items-center gap-3"><div className="bg-blue-600 p-2 rounded-lg"><Printer size={20} /></div><div><h3 className="font-bold">Excel Print View</h3></div></div>
                    <div className="flex gap-3"><button onClick={togglePreview} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm">Back to Edit</button><button onClick={printNow} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-bold flex items-center gap-2"><Printer size={16} /> Print</button></div>
                </div>
            )}

            {/* EXCEL PRINT LAYOUT (Visible in Preview Mode & Print) */}
            <div className={`${isPreview ? 'block' : 'hidden'} print:block font - sans text - [10px] w - full text - black bg - white p - 4 print: p - 0 overflow - auto`}>
                <div className="min-w-[800px]">
                    <table className="w-full border-collapse border border-black mb-1">
                        <thead><tr><th colSpan={8} className="border border-black p-1 text-center text-xl font-bold">UCIA - FG WAREHOUSE</th></tr></thead>
                        <tbody>
                            <tr>
                                <td className="border border-black p-1 font-bold text-center bg-gray-100 w-10">Shift</td>
                                <td colSpan={3} className="border border-black p-1 text-center font-bold text-lg">Staging Check Sheet</td>
                                <td className="border border-black p-1 w-24">Loading Dock No:</td>
                                <td className="border border-black p-1 font-bold w-24">{loadingDockNo}</td>
                            </tr>
                            <tr>
                                <td rowSpan={2} className="border border-black p-1 text-center font-bold text-xl align-middle">{shift}</td>
                                <td className="border border-black p-1 font-bold">Date</td>
                                <td className="border border-black p-1">{date}</td>
                                <td className="border border-black p-1 font-bold">Name of the SV / SG</td>
                                <td colSpan={3} className="border border-black p-1">{supervisorName}</td>
                            </tr>
                            <tr>
                                <td className="border border-black p-1 font-bold">Destination</td>
                                <td className="border border-black p-1">{destination}</td>
                                <td className="border border-black p-1 font-bold">Emp.code</td>
                                <td colSpan={3} className="border border-black p-1">{empCode}</td>
                            </tr>
                        </tbody>
                    </table>

                    {/* Split Grids - STAGING ONLY (Full Width) */}
                    <div className="border border-black">
                        <div className="w-full">
                            <div className="font-bold text-center bg-gray-200 border-b border-black p-1">STAGING DETAILS</div>
                            <table className="w-full text-[9px] border-collapse">
                                <thead>
                                    <tr className="bg-gray-100">
                                        <th className="border border-black p-1 w-12 text-center">Sr. No.</th>
                                        <th className="border border-black p-1 text-left">SKU Name</th>
                                        <th className="border border-black p-1 w-16 text-center">Cases/PLT</th>
                                        <th className="border border-black p-1 w-16 text-center">Full PLT</th>
                                        <th className="border border-black p-1 w-16 text-center">Loose</th>
                                        <th className="border border-black p-1 w-20 text-center">TTL Cases</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map(i => (
                                        <tr key={i.srNo}>
                                            <td className="border border-black p-1 text-center">{i.srNo}</td>
                                            <td className="border border-black p-1">{i.skuName}</td>
                                            <td className="border border-black p-1 text-center">{i.casesPerPlt || ''}</td>
                                            <td className="border border-black p-1 text-center">{i.fullPlt || ''}</td>
                                            <td className="border border-black p-1 text-center">{i.loose || ''}</td>
                                            <td className="border border-black p-1 text-center font-bold bg-gray-100">{i.ttlCases || ''}</td>
                                        </tr>
                                    ))}
                                    <tr>
                                        <td colSpan={5} className="border border-black p-1 text-right font-bold">Total Staging Qty</td>
                                        <td className="border border-black p-1 text-center font-bold bg-gray-200">{totalQty}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Footer Signatures matching Excel */}
                    {/* Footer Removed as per request */}
                </div>
            </div>

            {/* SCREEN FORM (Hidden in Preview) */}
            <div className={`p - 4 md: p - 6 bg - slate - 50 / 50 border - b border - slate - 100 ${isPreview ? 'hidden' : 'block'} print: hidden`}>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1"><Calendar size={14} /> Shift</label>
                        <select value={shift} onChange={e => { setShift(e.target.value); setIsDirty(true); }} disabled={isLocked} className="w-full border border-slate-200 bg-white p-2.5 rounded-lg text-sm text-slate-700 outline-none"><option value="A">A</option><option value="B">B</option><option value="C">C</option></select>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1"><Calendar size={14} /> Date</label>
                        <input type="text" value={date} onChange={e => { setDate(e.target.value); setIsDirty(true); }} disabled={isLocked} className="w-full border border-slate-200 bg-slate-100 p-2.5 rounded-lg text-sm text-slate-600 outline-none cursor-not-allowed" />
                    </div>
                    <div>
                        <input type="text" value={destination} onChange={e => { setDestination(e.target.value); setIsDirty(true); }} disabled={isLocked} className="w-full border border-slate-200 bg-white p-2.5 rounded-lg text-sm text-slate-700 outline-none placeholder:text-slate-300" placeholder="Enter Destination" />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1"><User size={14} /> Supervisor Name *</label>
                        <input type="text" value={supervisorName} onChange={e => { setSupervisorName(e.target.value); setIsDirty(true); }} disabled={isLocked} className="w-full border border-slate-200 bg-white p-2.5 rounded-lg text-sm text-slate-700 outline-none placeholder:text-slate-300" placeholder="Enter Name" />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1"><UserCheck size={14} /> Emp Code *</label>
                        <input type="text" value={empCode} onChange={e => { setEmpCode(e.target.value); setIsDirty(true); }} disabled={isLocked} className="w-full border border-slate-200 bg-white p-2.5 rounded-lg text-sm text-slate-700 outline-none placeholder:text-slate-300" placeholder="Enter Emp Code" />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1"><Truck size={14} /> Loading Dock No</label>
                        <input type="text" value={loadingDockNo} onChange={e => { setLoadingDockNo(e.target.value); setIsDirty(true); }} disabled={isLocked} className="w-full border border-slate-200 bg-white p-2.5 rounded-lg text-sm text-slate-700 outline-none placeholder:text-slate-300" placeholder="Enter Dock No" />
                    </div>
                </div>
            </div>

            {/* STAGING TABLE (Screen Only - Full Width) */}
            <div className={`p - 4 md: p - 6 ${isPreview ? 'hidden' : 'block'} print:hidden flex - 1 flex flex - col`}>
                <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm flex-1 custom-scrollbar">
                    {/* Min width ensures table is readable on mobile */}
                    <table className="w-full min-w-[600px] text-sm">
                        <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                            <tr>
                                <th className="p-3 w-12 text-center font-semibold text-xs uppercase tracking-wider text-slate-400">#</th>
                                <th className="p-3 text-left font-semibold text-xs uppercase tracking-wider min-w-[150px]">SKU Name</th>
                                <th className="p-3 w-24 text-center font-semibold text-xs uppercase tracking-wider">Cases/PLT</th>
                                <th className="p-3 w-24 text-center font-semibold text-xs uppercase tracking-wider">Full PLT</th>
                                <th className="p-3 w-24 text-center font-semibold text-xs uppercase tracking-wider">Loose</th>
                                <th className="p-3 w-24 text-center font-semibold text-xs uppercase tracking-wider bg-blue-100 text-blue-900 border-l border-blue-200">Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {items.map((item, index) => (
                                <tr key={item.srNo} className={`hover: bg - blue - 50 / 30 transition - colors group ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'} `}>
                                    <td className="p-3 text-center text-slate-400 font-mono text-xs">
                                        <div className="flex items-center justify-center gap-1">
                                            {item.srNo}
                                            {!isLocked && (
                                                <button
                                                    onClick={() => handleRemoveItem(index)}
                                                    className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-all"
                                                    title="Delete Row"
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                    <td className="p-1"><input type="text" value={item.skuName} onChange={e => handleItemChange(index, 'skuName', e.target.value)} disabled={isLocked} className="w-full p-2 bg-transparent rounded hover:bg-white focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all placeholder:text-slate-300" placeholder="Type SKU name..." /></td>
                                    <td className="p-1"><input type="number" value={item.casesPerPlt} onChange={e => handleItemChange(index, 'casesPerPlt', e.target.value)} disabled={isLocked} className="w-full p-2 text-center bg-transparent rounded hover:bg-white focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all" placeholder="-" /></td>
                                    <td className="p-1"><input type="number" value={item.fullPlt} onChange={e => handleItemChange(index, 'fullPlt', e.target.value)} disabled={isLocked} className="w-full p-2 text-center bg-transparent rounded hover:bg-white focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all" placeholder="-" /></td>
                                    <td className="p-1"><input type="number" value={item.loose} onChange={e => handleItemChange(index, 'loose', e.target.value)} disabled={isLocked} className="w-full p-2 text-center bg-transparent rounded hover:bg-white focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all" placeholder="-" /></td>
                                    <td className="p-3 text-center font-bold text-blue-700 bg-blue-50 border-l border-blue-100">{item.ttlCases || '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-slate-50 font-bold border-t border-slate-200">
                            <tr>
                                <td colSpan={5} className="p-4 text-right text-slate-500 text-xs uppercase tracking-wider">Total Staging Qty:</td>
                                <td className="p-4 text-center text-blue-600 text-lg bg-white shadow-inner">{totalQty}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
                {!isLocked && (
                    <div className="mt-4 flex justify-center pb-4">
                        <button onClick={handleAddItem} className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-6 py-3 rounded-lg transition-colors">
                            <Plus size={16} /> Add Row
                        </button>
                    </div>
                )}
            </div>

            {/* Footer Actions - Sticky Bottom */}
            {
                !isLocked && !isPreview && (
                    <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur-md border-t border-slate-200 shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.1)] flex justify-center gap-4 z-40 lg:ml-64 print:hidden">
                        <button type="button" onClick={() => handleSave(false)} className="px-6 py-2.5 bg-white text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 flex items-center gap-2 shadow-sm font-medium transition-all text-sm"><Save size={18} /> Save Draft</button>
                        <button type="button" id="lockButton" onClick={(e) => handleSave(true, e)} className="px-8 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2 font-bold shadow-lg shadow-purple-500/30 transform hover:scale-[1.02] active:scale-[0.98] transition-all text-sm"><Lock size={18} /> Request Verification</button>
                    </div>
                )
            }

            {/* Approval Footer (Shift Lead) */}
            {
                isPendingApproval && canApprove && !isPreview && (
                    <div className="fixed bottom-0 left-0 right-0 p-4 bg-purple-50/90 backdrop-blur-md border-t border-purple-200 shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.1)] flex flex-col items-center gap-4 z-40 lg:ml-64 print:hidden animate-in slide-in-from-bottom-4">

                        {/* Verification Checklist */}
                        <div className="w-full max-w-2xl bg-white border border-purple-200 rounded-xl p-4 shadow-sm">
                            <h4 className="text-xs font-bold text-purple-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <ClipboardList size={14} /> Verification Checklist (Staging Level)
                            </h4>
                            <div className="grid sm:grid-cols-3 gap-3">
                                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer p-2 hover:bg-purple-50 rounded-lg transition-colors border border-transparent hover:border-purple-100">
                                    <div className={`w - 5 h - 5 rounded border flex items - center justify - center transition - colors ${stagingChecks.qty ? 'bg-purple-600 border-purple-600 text-white' : 'bg-white border-slate-300'} `}>
                                        {stagingChecks.qty && <CheckCircle size={12} strokeWidth={4} />}
                                    </div>
                                    <input type="checkbox" className="hidden" checked={stagingChecks.qty} onChange={() => setStagingChecks(prev => ({ ...prev, qty: !prev.qty }))} />
                                    <span className="font-medium">Qty Matches</span>
                                </label>

                                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer p-2 hover:bg-purple-50 rounded-lg transition-colors border border-transparent hover:border-purple-100">
                                    <div className={`w - 5 h - 5 rounded border flex items - center justify - center transition - colors ${stagingChecks.condition ? 'bg-purple-600 border-purple-600 text-white' : 'bg-white border-slate-300'} `}>
                                        {stagingChecks.condition && <CheckCircle size={12} strokeWidth={4} />}
                                    </div>
                                    <input type="checkbox" className="hidden" checked={stagingChecks.condition} onChange={() => setStagingChecks(prev => ({ ...prev, condition: !prev.condition }))} />
                                    <span className="font-medium">Pallet OK</span>
                                </label>

                                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer p-2 hover:bg-purple-50 rounded-lg transition-colors border border-transparent hover:border-purple-100">
                                    <div className={`w - 5 h - 5 rounded border flex items - center justify - center transition - colors ${stagingChecks.sign ? 'bg-purple-600 border-purple-600 text-white' : 'bg-white border-slate-300'} `}>
                                        {stagingChecks.sign && <CheckCircle size={12} strokeWidth={4} />}
                                    </div>
                                    <input type="checkbox" className="hidden" checked={stagingChecks.sign} onChange={() => setStagingChecks(prev => ({ ...prev, sign: !prev.sign }))} />
                                    <span className="font-medium">Sup. Sign</span>
                                </label>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <button type="button" onClick={() => handleApprove(false)} className="px-6 py-2.5 bg-white text-red-600 border border-red-200 rounded-lg hover:bg-red-50 flex items-center gap-2 shadow-sm font-bold transition-all text-sm"><AlertTriangle size={18} /> Reject</button>
                            <button
                                type="button"
                                disabled={!Object.values(stagingChecks).every(Boolean)}
                                onClick={() => handleApprove(true)}
                                className={`px - 8 py - 2.5 rounded - lg flex items - center gap - 2 font - bold shadow - lg transform transition - all text - sm ${Object.values(stagingChecks).every(Boolean) ? 'bg-purple-600 text-white hover:bg-purple-700 hover:scale-[1.02] active:scale-[0.98] shadow-purple-500/30' : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'} `}
                            >
                                <Lock size={18} /> Approve & Lock
                            </button>
                        </div>
                    </div>
                )
            }
            {
                isIncidentModalOpen && existingSheet && (
                    <IncidentModal
                        sheetId={existingSheet.id}
                        currentUser={currentUser?.username || 'Unknown'}
                        onClose={() => setIncidentModalOpen(false)}
                        onSuccess={() => {
                            // Optional: Refresh sheet data or show toast
                            setIncidentModalOpen(false);
                            alert('Incident reported successfully');
                        }}
                    />
                )
            }
        </div >
    );
};
