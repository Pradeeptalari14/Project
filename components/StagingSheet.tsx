
import React, { useState, useEffect } from 'react';
import { useApp } from '../AppContext';
import { SheetData, SheetStatus, StagingItem, LoadingItemData, AdditionalItem, Role } from '../types';
import { EMPTY_STAGING_ITEMS } from '../services/mockData';
import { Save, Lock, ArrowLeft, Printer, Calendar, User, MapPin, Plus, AlertTriangle } from 'lucide-react';

interface Props {
    existingSheet?: SheetData;
    onCancel: () => void;
    onLock: (sheet: SheetData) => void;
    initialPreview?: boolean;
}

export const StagingSheet: React.FC<Props> = ({ existingSheet, onCancel, onLock, initialPreview = false }) => {
    const { currentUser, addSheet, updateSheet, acquireLock, releaseLock } = useApp();
    const isLocked = (existingSheet?.status === SheetStatus.LOCKED || existingSheet?.status === SheetStatus.COMPLETED) ||
        (existingSheet?.status === SheetStatus.DRAFT && existingSheet.createdBy !== currentUser?.username && currentUser?.role !== Role.ADMIN);

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

    const handleAddRow = () => {
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

            const sheetId = existingSheet?.id || `SH-${Date.now()}`;

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
                status: lock ? SheetStatus.LOCKED : SheetStatus.DRAFT,
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
                            {isLocked && <span className="bg-orange-100 text-orange-700 text-xs px-2.5 py-1 rounded-full font-bold border border-orange-200">LOCKED</span>}
                            {existingSheet?.status === SheetStatus.DRAFT && <span className="bg-slate-100 text-slate-600 text-xs px-2.5 py-1 rounded-full font-medium border border-slate-200">DRAFT</span>}
                            {isDirty && <span className="text-amber-500 text-xs flex items-center gap-1"><AlertTriangle size={12} /> Unsaved Changes</span>}
                        </div>
                    </div>
                    <div className="flex gap-2">
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
            <div className={`${isPreview ? 'block' : 'hidden'} print:block font-sans text-[10px] w-full text-black bg-white p-4 print:p-0 overflow-auto`}>
                <div className="min-w-[800px]">
                    <table className="w-full border-collapse border border-black mb-1">
                        <thead><tr><th colSpan={8} className="border border-black p-1 text-center text-xl font-bold">UCIA - FG WAREHOUSE</th></tr></thead>
                        <tbody>
                            <tr>
                                <td className="border border-black p-1 font-bold text-center bg-gray-100 w-10">Shift</td>
                                <td colSpan={3} className="border border-black p-1 text-center font-bold text-lg">Staging Check Sheet</td>
                                <td className="border border-black p-1 font-bold bg-gray-100">Transporter</td>
                                <td className="border border-black p-1"></td>
                                <td className="border border-black p-1 font-bold bg-gray-100">Seal No.</td>
                                <td className="border border-black p-1"></td>
                            </tr>
                            <tr>
                                <td rowSpan={3} className="border border-black p-1 text-center font-bold text-xl align-middle">{shift}</td>
                                <td className="border border-black p-1 font-bold">Date</td>
                                <td className="border border-black p-1">{date}</td>
                                <td className="border border-black p-1 font-bold">Name of the SV / SG</td>
                                <td className="border border-black p-1">{supervisorName}</td>
                                <td className="border border-black p-1 font-bold">Loading Start Time</td>
                                <td colSpan={2} className="border border-black p-1">{loadingStartTime}</td>
                            </tr>
                            <tr>
                                <td className="border border-black p-1 font-bold">Picking By</td>
                                <td className="border border-black p-1"></td>
                                <td className="border border-black p-1 font-bold">Destination</td>
                                <td className="border border-black p-1">{destination}</td>
                                <td className="border border-black p-1 font-bold">Loading End Time</td>
                                <td colSpan={2} className="border border-black p-1">{loadingEndTime}</td>
                            </tr>
                            <tr>
                                <td className="border border-black p-1 font-bold">Picking Crosschecked By</td>
                                <td className="border border-black p-1"></td>
                                <td className="border border-black p-1 font-bold">Vehicle No</td>
                                <td className="border border-black p-1"></td>
                                <td colSpan={2} className="border border-black p-1">Driver Name & Contact No</td>
                                <td className="border border-black p-1"></td>
                            </tr>
                            <tr>
                                <td className="border border-black p-1"></td>
                                <td className="border border-black p-1 font-bold">Loading Dock No:</td>
                                <td className="border border-black p-1">{loadingDockNo}</td>
                                <td className="border border-black p-1 font-bold">Reg.Serial No</td>
                                <td className="border border-black p-1"></td>
                                <td className="border border-black p-1 font-bold">Emp.code</td>
                                <td colSpan={2} className="border border-black p-1">{empCode}</td>
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
                                            <td className="border border-black p-1 text-center">{i.casesPerPlt}</td>
                                            <td className="border border-black p-1 text-center">{i.fullPlt}</td>
                                            <td className="border border-black p-1 text-center">{i.loose}</td>
                                            <td className="border border-black p-1 text-center font-bold bg-gray-100">{i.ttlCases}</td>
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
                    <div className="border border-black border-t-0 flex">
                        <div className="w-[40%] border-r border-black p-1">
                            <div className="flex justify-between border-b border-black p-1"><span>Actual Loaded Qty</span><span></span></div>
                            <div className="flex justify-between p-1"><span>Balance to be returned</span><span></span></div>
                        </div>
                        <div className="w-[60%] p-1">
                            <div className="font-bold text-xs">Remarks (If any adjustment for shortage/excess, please mention details with approval no.)</div>
                            <div className="h-8"></div>
                        </div>
                    </div>
                    <div className="border border-black border-t-0 flex text-xs">
                        <div className="w-1/4 border-r border-black p-1">
                            <div className="font-bold border-b border-gray-300 mb-2">Supervisor Name</div>
                            <div>{supervisorName}</div>
                            <div className="text-[8px] text-gray-500">(after loading completed)</div>
                        </div>
                        <div className="w-1/4 border-r border-black p-1">
                            <div className="font-bold border-b border-gray-300 mb-8">Supervisor Sign</div>
                            <div className="text-[8px] text-gray-500">(after loading completed)</div>
                        </div>
                        <div className="w-1/4 border-r border-black p-1">
                            <div className="font-bold border-b border-gray-300 mb-8">Name/Sign. SL</div>
                            <div className="text-[8px] text-gray-500">(after loading completed & crosscheck)</div>
                        </div>
                        <div className="w-1/4 p-1">
                            <div className="font-bold border-b border-gray-300 mb-8">Name/Sign. DEO</div>
                            <div className="text-[8px] text-gray-500">(signing after cross check with documents)</div>
                        </div>
                    </div>
                    <div className="border border-black border-t-0 p-2 text-center text-lg font-bold">
                        TOTAL loaded Cases {'----->'}
                    </div>
                </div>
            </div>

            {/* SCREEN FORM (Hidden in Preview) */}
            <div className={`p-4 md:p-6 bg-slate-50/50 border-b border-slate-100 ${isPreview ? 'hidden' : 'block'} print:hidden`}>
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
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1"><MapPin size={14} /> Destination *</label>
                        <input type="text" value={destination} onChange={e => { setDestination(e.target.value); setIsDirty(true); }} disabled={isLocked} className="w-full border border-slate-200 bg-white p-2.5 rounded-lg text-sm text-slate-700 outline-none placeholder:text-slate-300" placeholder="Enter Destination" />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1"><User size={14} /> Supervisor Name *</label>
                        <input type="text" value={supervisorName} disabled={true} className="w-full border border-slate-200 bg-slate-100 p-2.5 rounded-lg text-sm text-slate-500 outline-none cursor-not-allowed font-medium" />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1"><User size={14} /> Emp. Code *</label>
                        <input type="text" value={empCode} disabled={true} className="w-full border border-slate-200 bg-slate-100 p-2.5 rounded-lg text-sm text-slate-500 outline-none cursor-not-allowed font-medium" />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1"><MapPin size={14} /> Loading Dock No *</label>
                        <input type="text" value={loadingDockNo} onChange={e => { setLoadingDockNo(e.target.value); setIsDirty(true); }} disabled={isLocked} className="w-full border border-slate-200 bg-white p-2.5 rounded-lg text-sm text-slate-700 outline-none placeholder:text-slate-300" placeholder="Enter Dock # (e.g. 1)" />
                    </div>
                </div>
            </div>

            {/* STAGING TABLE (Screen Only - Full Width) */}
            <div className={`p-4 md:p-6 ${isPreview ? 'hidden' : 'block'} print:hidden flex-1 flex flex-col`}>
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
                                <tr key={item.srNo} className={`hover:bg-blue-50/30 transition-colors group ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                                    <td className="p-3 text-center text-slate-400 font-mono text-xs">{item.srNo}</td>
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
                        <button onClick={handleAddRow} className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-6 py-3 rounded-lg transition-colors">
                            <Plus size={16} /> Add Row
                        </button>
                    </div>
                )}
            </div>

            {/* Footer Actions - Sticky Bottom */}
            {!isLocked && !isPreview && (
                <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur-md border-t border-slate-200 shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.1)] flex justify-center gap-4 z-40 lg:ml-64 print:hidden">
                    <button type="button" onClick={() => handleSave(false)} className="px-6 py-2.5 bg-white text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 flex items-center gap-2 shadow-sm font-medium transition-all text-sm"><Save size={18} /> Save Draft</button>
                    <button type="button" id="lockButton" onClick={(e) => handleSave(true, e)} className="px-8 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 font-bold shadow-lg shadow-blue-500/30 transform hover:scale-[1.02] active:scale-[0.98] transition-all text-sm"><Lock size={18} /> Lock & Submit</button>
                </div>
            )}
        </div>
    );
};
