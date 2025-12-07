
import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../AppContext';
import { SheetData, SheetStatus, LoadingItemData, AdditionalItem } from '../types';
import {
    Camera,
    Printer,
    CheckCircle,
    ArrowLeft,
    Save,
    ClipboardList,
    Box,
    Truck,
    MapPin,
    Calendar,
    Clock,
    User,
    FileCheck,
    Container,
    Plus,
    AlertTriangle,
    XCircle,
    Image as ImageIcon
} from 'lucide-react';
import { IncidentModal } from './IncidentModal';

// --- Extracted Component to prevent re-render focus loss ---
// Added min-height and padding for better touch targets on mobile
const HeaderField = ({ label, icon: Icon, hasError, children }: any) => (
    <div className="flex flex-col gap-1.5">
        <label className={`text-[10px] uppercase tracking-wider font-bold flex items-center gap-1.5 ${hasError ? 'text-red-600' : 'text-slate-500'}`}>
            {Icon && <Icon size={14} className={hasError ? 'text-red-500' : 'text-slate-400'} />} {label}
        </label>
        <div className={`p-2 rounded-lg border shadow-sm transition-all ${hasError ? 'bg-red-50 border-red-500 ring-1 ring-red-200' : 'bg-white border-slate-200'}`}>
            {children}
        </div>
    </div>
);

interface Props {
    sheet: SheetData;
    onClose: () => void;
    initialPreview?: boolean;
}

export const LoadingSheet: React.FC<Props> = ({ sheet, onClose, initialPreview = false }) => {
    const { updateSheet, currentUser } = useApp();
    const [currentSheet, setCurrentSheet] = useState<SheetData>(sheet);

    // Controls to hide Submit / Show Print after completion
    const isCompleted = currentSheet.status === SheetStatus.COMPLETED;

    const [isIncidentModalOpen, setIncidentModalOpen] = useState(false);

    // Print Preview State
    const [isPreview, setIsPreview] = useState(initialPreview);

    // Header inputs
    const [transporter, setTransporter] = useState(sheet.transporter || '');
    const [loadingDock, setLoadingDock] = useState(sheet.loadingDockNo || '');
    const [shift, setShift] = useState(sheet.shift || 'A');
    const [startTime, setStartTime] = useState(sheet.loadingStartTime || new Date().toLocaleTimeString('en-US', { hour12: false }));
    const [endTime, setEndTime] = useState(sheet.loadingEndTime || '');

    // Loading Specific Extra Fields
    const [pickingBy, setPickingBy] = useState(sheet.pickingBy || sheet.supervisorName || sheet.createdBy || '');
    const [pickingCrosscheckedBy, setPickingCrosscheckedBy] = useState(sheet.pickingCrosscheckedBy || currentUser?.fullName || currentUser?.username || '');

    const [vehicleNo, setVehicleNo] = useState(sheet.vehicleNo || '');
    const [driverName, setDriverName] = useState(sheet.driverName || '');
    const [sealNo, setSealNo] = useState(sheet.sealNo || '');
    const [regSerialNo, setRegSerialNo] = useState(sheet.regSerialNo || '');

    // Signatures & Remarks
    const [svName, setSvName] = useState(sheet.loadingSvName || '');
    const [svSign, setSvSign] = useState(sheet.loadingSupervisorSign || '');
    const [slSign, setSlSign] = useState(sheet.slSign || '');
    const [deoSign, setDeoSign] = useState(sheet.deoSign || '');
    const [remarks, setRemarks] = useState(sheet.comments?.[0]?.text || '');

    // Validation State (Kept for visual feedback but not blocking)
    const [errors, setErrors] = useState<string[]>([]);

    // Camera State
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [cameraActive, setCameraActive] = useState(false);
    const [capturedImage, setCapturedImage] = useState<string | null>(sheet.capturedImages?.[0] || null);
    const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);

    // --- Sync Local State with Prop Updates ---
    useEffect(() => {
        // ALWAYS sync state when props change to ensure consistency after save
        setCurrentSheet(sheet);
        setTransporter(sheet.transporter || '');
        setLoadingDock(sheet.loadingDockNo || '');
        setShift(sheet.shift || 'A');
        setStartTime(sheet.loadingStartTime || new Date().toLocaleTimeString('en-US', { hour12: false }));
        setEndTime(sheet.loadingEndTime || '');

        setPickingBy(sheet.pickingBy || sheet.supervisorName || sheet.createdBy || '');
        setPickingCrosscheckedBy(sheet.pickingCrosscheckedBy || currentUser?.fullName || currentUser?.username || '');

        setVehicleNo(sheet.vehicleNo || '');
        setDriverName(sheet.driverName || '');
        setSealNo(sheet.sealNo || '');
        setRegSerialNo(sheet.regSerialNo || '');

        // Stronger Auto-fill: checking for empty or whitespace-only strings
        let defaultSvName = sheet.loadingSvName;
        if (!defaultSvName || defaultSvName.trim() === '') {
            defaultSvName = currentUser?.fullName || currentUser?.username || '';
        }
        setSvName(defaultSvName);

        setSvSign(sheet.loadingSupervisorSign || '');
        setSlSign(sheet.slSign || '');
        setDeoSign(sheet.deoSign || '');
        setRemarks(sheet.comments?.[0]?.text || '');
        setCapturedImage(sheet.capturedImages?.[0] || null);
    }, [sheet, currentUser]);

    // Initialize Loading Items based on Staging Items if empty
    useEffect(() => {
        const hasStagingData = currentSheet.stagingItems.some(i => i.ttlCases > 0);
        const hasLoadingData = currentSheet.loadingItems && currentSheet.loadingItems.length > 0;
        const hasAdditionalData = currentSheet.additionalItems && currentSheet.additionalItems.length > 0;

        if (hasStagingData && (!hasLoadingData || !hasAdditionalData)) {
            generateLoadingItems();
        }
    }, []);

    useEffect(() => {
        return () => {
            if (mediaStream) {
                mediaStream.getTracks().forEach(track => track.stop());
            }
        };
    }, [mediaStream]);

    useEffect(() => {
        if (cameraActive && mediaStream && videoRef.current) {
            videoRef.current.srcObject = mediaStream;
        }
    }, [cameraActive, mediaStream]);

    const generateLoadingItems = () => {
        // Use props sheet to ensure we have the source truth
        let updatedLoadingItems = sheet.stagingItems
            .filter(item => item.skuName && item.ttlCases > 0)
            .map(item => ({
                skuSrNo: item.srNo,
                cells: [],
                looseInput: 0,
                total: 0,
                balance: item.ttlCases
            }));

        // Preserve existing additional items
        let updatedAdditionalItems = (sheet.additionalItems && sheet.additionalItems.length > 0)
            ? sheet.additionalItems
            : Array.from({ length: 5 }, (_, i) => ({
                id: i + 1,
                skuName: '',
                counts: Array(10).fill(0),
                total: 0
            }));

        const updatedSheet = {
            ...currentSheet,
            loadingItems: updatedLoadingItems,
            additionalItems: updatedAdditionalItems
        };

        setCurrentSheet(updatedSheet);
        updateSheet(updatedSheet);
        return updatedLoadingItems;
    };

    const handleLoadingCellChange = (skuSrNo: number, row: number, col: number, val: string) => {
        const value = val === '' ? 0 : parseInt(val);
        if (isNaN(value)) return;
        const stagingItem = sheet.stagingItems.find(s => s.srNo === skuSrNo);

        // Safety: ensure loadingItems exists
        const safeLoadingItems = currentSheet.loadingItems && currentSheet.loadingItems.length > 0
            ? currentSheet.loadingItems
            : generateLoadingItems();

        const updatedLoadingItems = safeLoadingItems.map(li => {
            if (li.skuSrNo !== skuSrNo) return li;
            const existingCellIndex = li.cells.findIndex(c => c.row === row && c.col === col);
            let newCells = [...li.cells];
            if (existingCellIndex >= 0) { newCells[existingCellIndex] = { row, col, value }; }
            else { newCells.push({ row, col, value }); }
            const cellSum = newCells.reduce((acc, c) => acc + c.value, 0);
            const total = cellSum + li.looseInput;
            const totalCases = stagingItem?.ttlCases || 0;
            const balance = totalCases - total;
            return { ...li, cells: newCells, total, balance };
        });
        setCurrentSheet(prev => ({ ...prev, loadingItems: updatedLoadingItems }));
    };

    const handleCellBlur = (skuSrNo: number, row: number, col: number, val: string) => {
        if (!val) return;
        const intVal = parseInt(val);
        const sItem = sheet.stagingItems.find(s => s.srNo === skuSrNo);

        // Strict Validation: Must match Cases Per Pallet from Staging
        // This is ONLY applied to the grid cells (1-10) via the onBlur event
        if (sItem && sItem.casesPerPlt > 0 && intVal !== sItem.casesPerPlt) {
            alert(`Incorrect Quantity! The defined Cases/PLT for this SKU is ${sItem.casesPerPlt}. Please fill this number.`);
            handleLoadingCellChange(skuSrNo, row, col, '');
        }
    };

    const handleLooseChange = (skuSrNo: number, val: string) => {
        const value = val === '' ? 0 : parseInt(val);
        if (isNaN(value)) return;
        const stagingItem = sheet.stagingItems.find(s => s.srNo === skuSrNo);

        const safeLoadingItems = currentSheet.loadingItems && currentSheet.loadingItems.length > 0
            ? currentSheet.loadingItems
            : generateLoadingItems();

        const updatedLoadingItems = safeLoadingItems.map(li => {
            if (li.skuSrNo !== skuSrNo) return li;
            const cellSum = li.cells.reduce((acc, c) => acc + c.value, 0);
            const total = cellSum + value;
            const totalCases = stagingItem?.ttlCases || 0;
            const balance = totalCases - total;
            return { ...li, looseInput: value, total, balance };
        });
        setCurrentSheet(prev => ({ ...prev, loadingItems: updatedLoadingItems }));
    };

    const handleAdditionalChange = (id: number, field: 'skuName' | 'count', value: string, colIndex?: number) => {
        const updatedAdditional = (currentSheet.additionalItems || []).map(item => {
            if (item.id !== id) return item;
            if (field === 'skuName') {
                return { ...item, skuName: value };
            } else if (field === 'count' && colIndex !== undefined) {
                const newCounts = [...item.counts];
                newCounts[colIndex] = value === '' ? 0 : parseInt(value) || 0;
                const newTotal = newCounts.reduce((sum, v) => sum + v, 0);
                return { ...item, counts: newCounts, total: newTotal };
            }
            return item;
        });
        setCurrentSheet(prev => ({ ...prev, additionalItems: updatedAdditional }));
    };

    const startCamera = async () => {
        try { setCameraActive(true); const stream = await navigator.mediaDevices.getUserMedia({ video: true }); setMediaStream(stream); }
        catch (err) { console.error("Camera error:", err); alert("Check permissions. Camera access is required."); setCameraActive(false); }
    };
    const capturePhoto = () => {
        if (videoRef.current && canvasRef.current) {
            const context = canvasRef.current.getContext('2d');
            if (context) {
                canvasRef.current.width = videoRef.current.videoWidth; canvasRef.current.height = videoRef.current.videoHeight;
                context.drawImage(videoRef.current, 0, 0); setCapturedImage(canvasRef.current.toDataURL('image/png')); stopCamera();
            }
        }
    };
    const stopCamera = () => { if (mediaStream) mediaStream.getTracks().forEach(track => track.stop()); setMediaStream(null); setCameraActive(false); };
    const clearError = (field: string) => { setErrors(prev => prev.filter(e => e !== field)); };

    const buildSheetData = (status: SheetStatus): SheetData => {
        const finalLoadingItems = (currentSheet.loadingItems && currentSheet.loadingItems.length > 0)
            ? currentSheet.loadingItems
            : generateLoadingItems();

        const finalAdditionalItems = (currentSheet.additionalItems && currentSheet.additionalItems.length > 0)
            ? currentSheet.additionalItems
            : (sheet.additionalItems || []);

        return {
            ...currentSheet,
            status,
            stagingItems: sheet.stagingItems,
            loadingItems: finalLoadingItems,
            additionalItems: finalAdditionalItems,
            shift,
            transporter,
            loadingDockNo: loadingDock,
            loadingStartTime: startTime,
            loadingEndTime: status === SheetStatus.COMPLETED ? new Date().toLocaleTimeString('en-US', { hour12: false }) : endTime,
            pickingBy,
            pickingCrosscheckedBy,
            vehicleNo,
            driverName,
            sealNo,
            regSerialNo,
            loadingSvName: svName,
            loadingSupervisorSign: svSign,
            slSign,
            deoSign,
            capturedImages: capturedImage ? [capturedImage] : [],
            completedBy: status === SheetStatus.COMPLETED ? currentUser?.username : undefined,
            completedAt: status === SheetStatus.COMPLETED ? new Date().toISOString() : undefined,
            comments: remarks ? [{ id: Date.now().toString(), author: currentUser?.username || 'User', text: remarks, timestamp: new Date().toISOString() }] : []
        };
    };

    const handleSaveProgress = () => {
        const data = buildSheetData(currentSheet.status);
        updateSheet(data);
        alert("Progress Saved Successfully!");
    };

    const handleSubmit = () => {
        // Validation: Supervisor Name is required for completion
        if (!svName || svName.trim() === '') {
            alert("Supervisor Name is required to complete the sheet.");
            return;
        }

        // Non-blocking save - gathers all data and completes immediately
        const finalSheet = buildSheetData(SheetStatus.COMPLETED);
        updateSheet(finalSheet);
        setCurrentSheet(finalSheet);
        setEndTime(finalSheet.loadingEndTime || '');
        alert("Sheet Completed Successfully!");
    };

    const togglePreview = () => setIsPreview(!isPreview);
    const printNow = () => window.print();

    // Totals
    const totalLoadedMain = currentSheet.loadingItems?.reduce((acc, li) => acc + li.total, 0) || 0;
    const totalAdditional = currentSheet.additionalItems?.reduce((acc, ai) => acc + ai.total, 0) || 0;
    const grandTotalLoaded = totalLoadedMain + totalAdditional;
    const totalStaging = sheet.stagingItems.reduce((acc, si) => acc + si.ttlCases, 0);

    // FIXED BALANCE LOGIC: Sum of positive balances (shortages) only, extras do not offset this.
    const balance = currentSheet.loadingItems?.reduce((acc, li) => acc + Math.max(0, li.balance), 0) || 0;

    const displayedStagingItems = sheet.stagingItems.filter(i => i.skuName && i.skuName.trim() !== '');
    const extraItemsWithQty = (currentSheet.additionalItems || []).filter(item => item.total > 0 && item.skuName);
    const returnedItems = currentSheet.loadingItems?.filter(li => li.balance > 0) || [];

    return (
        <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-24 print:w-full print:max-w-none print:pb-0 print:gap-1">
            {/* Preview Controls */}
            {isPreview && (
                <div className="bg-slate-800 text-white p-4 rounded-xl shadow-lg flex justify-between items-center print:hidden sticky top-4 z-50">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setIncidentModalOpen(true)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-rose-50 text-rose-600 rounded-lg text-xs font-bold hover:bg-rose-100 transition-colors border border-rose-100"
                        >
                            <AlertTriangle size={14} /> Report Issue
                        </button>
                        <div className="bg-blue-600 p-2 rounded-lg"><Printer size={20} /></div><div><h3 className="font-bold">Print Preview Mode</h3></div>
                    </div>
                    <div className="flex gap-3"><button type="button" onClick={togglePreview} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm">Back</button><button type="button" onClick={printNow} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-bold flex items-center gap-2"><Printer size={16} /> Print</button></div>
                </div>
            )}
            {/* Screen Header */}
            <div className={`flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200 ${isPreview ? 'hidden' : 'block'} print:hidden`}>
                <div className="flex items-center gap-4"><button type="button" onClick={onClose} className="text-slate-500 hover:text-blue-600"><ArrowLeft size={20} /></button><div><h2 className="text-xl font-bold text-slate-800">Loading Check Sheet</h2><p className="text-xs text-slate-400 font-mono">ID: {currentSheet.id}</p></div></div>
                <div className="flex gap-2">
                    {isCompleted && <button type="button" onClick={togglePreview} className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"><Printer size={16} /> Print Preview</button>}
                    {!isCompleted && <button type="button" onClick={handleSaveProgress} className="bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-slate-50"><Save size={16} /> Save Progress</button>}
                </div>
            </div>

            {/* EXCEL PRINT LAYOUT */}
            <div className={`${isPreview ? 'block' : 'hidden'} print:block font-sans text-[10px] w-full text-black bg-white p-4 print:p-0 overflow-auto`}>
                <div className="min-w-[800px]">
                    <table className="w-full border-collapse border border-black mb-1">
                        <thead><tr><th colSpan={8} className="border border-black p-1 text-center text-xl font-bold">UCIA - FG WAREHOUSE</th></tr></thead>
                        <tbody>
                            <tr><td className="border border-black p-1 font-bold text-center bg-gray-100" colSpan={8}>Staging & Loading Check Sheet</td></tr>

                            {/* Row 1: Shift (2) | Date (2) | Name of SV/SG (4) */}
                            {/* Row 1: Shift (1+1) | Date (1+2) | Name of SV/SG (1+2) */}
                            <tr>
                                <td className="border border-black p-1 font-bold">Shift</td>
                                <td className="border border-black p-1 font-bold">{shift}</td>
                                <td className="border border-black p-1 font-bold">Date</td>
                                <td className="border border-black p-1" colSpan={2}>{currentSheet.date}</td>
                                <td className="border border-black p-1 font-bold">Name of the SV / SG</td>
                                <td className="border border-black p-1" colSpan={2}>{sheet.supervisorName}</td>
                            </tr>

                            {/* Row 2: Emp.code (2) | Transporter (3) | Loading Start Time (3) */}
                            <tr>
                                <td className="border border-black p-1 font-bold">Emp.code</td>
                                <td className="border border-black p-1">{sheet.empCode}</td>
                                <td className="border border-black p-1 w-24">Transporter</td>
                                <td className="border border-black p-1 font-bold" colSpan={2}>{transporter}</td>
                                <td className="border border-black p-1 font-bold">Loading Start Time</td>
                                <td className="border border-black p-1" colSpan={2}>{startTime}</td>
                            </tr>

                            {/* Row 3: Picking By (2) | Destination (3) | Loading End Time (3) */}
                            <tr>
                                <td className="border border-black p-1 font-bold">Picking By</td>
                                <td className="border border-black p-1 font-bold">{pickingBy}</td>
                                <td className="border border-black p-1 font-bold">Destination</td>
                                <td className="border border-black p-1" colSpan={2}>{sheet.destination}</td>
                                <td className="border border-black p-1 font-bold">Loading End Time</td>
                                <td className="border border-black p-1" colSpan={2}>{endTime}</td>
                            </tr>

                            {/* Row 4: Picking Crosschecked By (2) | Driver Name (3) | Vehicle No (3) */}
                            <tr>
                                <td className="border border-black p-1 font-bold">Picking Crosschecked By</td>
                                <td className="border border-black p-1 font-bold">{pickingCrosscheckedBy}</td>
                                <td className="border border-black p-1 font-bold">Driver Name</td>
                                <td className="border border-black p-1 font-bold" colSpan={2}>{driverName}</td>
                                <td className="border border-black p-1 font-bold">Vehicle No</td>
                                <td className="border border-black p-1 font-bold uppercase" colSpan={2}>{vehicleNo}</td>
                            </tr>

                            {/* Row 5: Loading Dock No (2) | Reg.Serial No (2) | Seal No (4) */}
                            {/* Row 5: Loading Dock No (1+1) | Reg.Serial No (1+2) | Seal No (1+2) */}
                            <tr>
                                <td className="border border-black p-1 font-bold">Loading Dock No:</td>
                                <td className="border border-black p-1">{loadingDock}</td>
                                <td className="border border-black p-1 font-bold">Reg.Serial No</td>
                                <td className="border border-black p-1" colSpan={2}>{regSerialNo}</td>
                                <td className="border border-black p-1 w-24">Seal No</td>
                                <td className="border border-black p-1 font-bold" colSpan={2}>{sealNo}</td>
                            </tr>
                        </tbody>
                    </table>
                    <div className="flex border border-black">
                        <div className="w-[40%] border-r border-black"><div className="font-bold text-center bg-gray-200">STAGING DETAILS</div>
                            <table className="w-full text-[9px] border-collapse">
                                <thead>
                                    <tr className="bg-gray-100">
                                        <th className="border border-black p-1">Sr. No.</th>
                                        <th className="border border-black p-1">SKU Name</th>
                                        <th className="border border-black p-1">Cases/PLT</th>
                                        <th className="border border-black p-1">Full PLT</th>
                                        <th className="border border-black p-1">Loose</th>
                                        <th className="border border-black p-1">TTL Cases</th>
                                    </tr>
                                </thead>
                                <tbody>{displayedStagingItems.map(i => (
                                    <tr key={i.srNo}>
                                        <td className="border border-black p-1 text-center">{i.srNo}</td>
                                        <td className="border border-black p-1">{i.skuName}</td>
                                        <td className="border border-black p-1 text-center">{i.casesPerPlt}</td>
                                        <td className="border border-black p-1 text-center">{i.fullPlt}</td>
                                        <td className="border border-black p-1 text-center">{i.loose}</td>
                                        <td className="border border-black p-1 text-center">{i.ttlCases}</td>
                                    </tr>
                                ))}</tbody>
                            </table>
                        </div>
                        <div className="w-[60%]"><div className="font-bold text-center bg-gray-200">LOADING DETAILS</div>
                            <table className="w-full text-[9px] border-collapse">
                                <thead>
                                    <tr className="bg-gray-100">
                                        <th className="border border-black p-1">S No.</th>
                                        <th className="border border-black p-1">SKU Name</th>
                                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => <th key={n} className="border border-black p-1 w-4">{n}</th>)}
                                        <th className="border border-black p-1">Lse</th>
                                        <th className="border border-black p-1">Total</th>
                                        <th className="border border-black p-1">Balance</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {currentSheet.loadingItems
                                        ?.filter(li => displayedStagingItems.some(ds => ds.srNo === li.skuSrNo))
                                        .map((lItem, idx) => {
                                            const sItem = sheet.stagingItems.find(s => s.srNo === lItem.skuSrNo);
                                            if (!sItem) return null;
                                            // Calculate rows needed for this item in print view
                                            const rowsNeeded = Math.max(1, Math.ceil(sItem.fullPlt / 10));

                                            return Array.from({ length: rowsNeeded }).map((_, rIndex) => (
                                                <tr key={`${lItem.skuSrNo}-${rIndex}`}>
                                                    {/* Only show SKU/Idx on first row */}
                                                    {rIndex === 0 ? (
                                                        <>
                                                            <td rowSpan={rowsNeeded} className="border border-black p-1 text-center align-middle">{idx + 1}</td>
                                                            <td rowSpan={rowsNeeded} className="border border-black p-1 align-middle">{sItem.skuName}</td>
                                                        </>
                                                    ) : null}

                                                    {/* Cells for this row */}
                                                    {Array.from({ length: 10 }).map((_, cIndex) => {
                                                        const cell = lItem.cells.find(c => c.row === rIndex && c.col === cIndex);
                                                        return <td key={cIndex} className="border border-black p-1 text-center">{cell?.value !== undefined ? cell.value : ''}</td>
                                                    })}

                                                    {/* Totals only on first row */}
                                                    {rIndex === 0 ? (
                                                        <>
                                                            <td rowSpan={rowsNeeded} className="border border-black p-1 text-center align-middle">{lItem.looseInput !== undefined ? lItem.looseInput : ''}</td>
                                                            <td rowSpan={rowsNeeded} className="border border-black p-1 text-center align-middle">{lItem.total}</td>
                                                            <td rowSpan={rowsNeeded} className="border border-black p-1 text-center align-middle">{lItem.balance}</td>
                                                        </>
                                                    ) : null}
                                                </tr>
                                            ));
                                        })
                                    }
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div className="border border-black border-t-0 flex">
                        <div className="w-[40%] border-r border-black flex">
                            <div className="flex-1 p-1">
                                <div className="flex justify-between border-b border-black p-1"><span>Total Staging Qty</span><span>{totalStaging}</span></div>
                                <div className="flex justify-between border-b border-black p-1"><span>Actual Loaded Qty</span><span>{grandTotalLoaded}</span></div>
                                <div className="flex justify-between p-1"><span>Balance to be returned</span><span>{balance}</span></div>
                            </div>
                            {balance > 0 && (
                                <div className="w-20 border-l border-black p-1 flex items-end">
                                    <div className="text-[7px] text-center leading-tight">
                                        Picking Sv sign return received
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="w-[60%] p-1">
                            <div className="font-bold text-xs">Remarks (If any adjustment for shortage/excess, please mention details with approval no.)</div>
                            <div className="mt-1 space-y-1">
                                {returnedItems.map((item, idx) => (
                                    <div key={`ret-${idx}`} className="flex items-end text-[9px]">
                                        <span>For <strong>{sheet.stagingItems.find(s => s.srNo === item.skuSrNo)?.skuName}</strong> {item.balance} loose returned.</span>
                                    </div>
                                ))}
                                {extraItemsWithQty.map((item, idx) => (
                                    <div key={`ext-${idx}`} className="flex items-end text-[9px]">
                                        <span>For <strong>{item.skuName}</strong> {item.total} Cases Extra loaded.</span>
                                        <span className="ml-4 flex-1 border-b border-black text-center pr-2">Approval Sign:</span>
                                    </div>
                                ))}
                            </div>
                            {remarks && <div className="mt-2 text-[9px] italic">{remarks}</div>}
                            <div className="h-4"></div>
                        </div>
                    </div>
                    <div className="border border-black border-t-0 p-2 text-center text-lg font-bold">TOTAL loaded Cases: {grandTotalLoaded}</div>
                    <div className="flex border border-black border-t-0 text-xs mt-2">
                        <div className="w-1/4 border-r border-black p-1"><div>Supervisor Name:</div><div className="font-bold">{svName}</div></div>
                        <div className="w-1/4 border-r border-black p-1"><div>Supervisor Sign:</div><div className="font-script text-sm">{svSign}</div></div>
                        <div className="w-1/4 border-r border-black p-1"><div>SL Sign:</div><div className="font-script text-sm">{slSign}</div></div>
                        <div className="w-1/4 p-1"><div>DEO Sign:</div><div className="font-script text-sm">{deoSign}</div></div>
                    </div>
                    {capturedImage && <div className="print-break-before mt-4"><img src={capturedImage} className="max-w-full h-auto" /></div>}
                </div>
            </div>

            {/* MAIN FORM */}
            <div className={`${isPreview ? 'hidden' : 'block'} bg-white shadow-xl shadow-slate-200 rounded-xl overflow-hidden border border-slate-200 print:hidden`}>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 md:p-6 bg-slate-50/50 border-b border-slate-200">
                    <HeaderField label="Shift" icon={Calendar}>
                        <select value={shift} onChange={e => setShift(e.target.value)} disabled={isCompleted} className="w-full bg-transparent text-sm font-medium text-slate-700 outline-none"><option value="A">A</option><option value="B">B</option><option value="C">C</option></select>
                    </HeaderField>
                    <HeaderField label="Date" icon={Calendar}><div className="font-semibold text-slate-700 text-sm">{currentSheet.date}</div></HeaderField>
                    <HeaderField label="Transporter *" icon={Truck} hasError={errors.includes('transporter')}>
                        <input type="text" value={transporter} onChange={e => { setTransporter(e.target.value); clearError('transporter'); }} disabled={isCompleted} className="w-full bg-transparent text-sm font-medium text-slate-700 outline-none placeholder:text-slate-300" placeholder="Enter Transporter" />
                    </HeaderField>
                    <HeaderField label="Loading Dock *" icon={MapPin} hasError={errors.includes('loadingDock')}>
                        <input type="text" value={loadingDock} onChange={e => setLoadingDock(e.target.value)} disabled={isCompleted || (!!sheet.loadingDockNo && sheet.loadingDockNo.trim() !== '')} className={`w-full bg-transparent text-sm font-medium text-slate-700 outline-none ${(!sheet.loadingDockNo && !isCompleted) ? 'placeholder:text-blue-400' : 'cursor-not-allowed text-slate-500'}`} placeholder={!sheet.loadingDockNo ? "Enter Dock No" : ""} />
                    </HeaderField>
                    <HeaderField label="Loading Start Time" icon={Clock}>
                        <input type="text" value={startTime} onChange={e => setStartTime(e.target.value)} disabled={isCompleted} className="w-full bg-transparent text-sm font-medium text-slate-700 outline-none placeholder:text-slate-300" placeholder="HH:MM:SS" />
                    </HeaderField>
                    <HeaderField label="Loading End Time" icon={Clock}>
                        <input type="text" value={endTime} onChange={e => setEndTime(e.target.value)} disabled={isCompleted} className="w-full bg-transparent text-sm font-medium text-slate-700 outline-none placeholder:text-slate-300" placeholder="--:--:--" />
                    </HeaderField>
                    <HeaderField label="Picking By *" icon={User} hasError={errors.includes('pickingBy')}><input type="text" value={pickingBy} onChange={e => { setPickingBy(e.target.value); clearError('pickingBy'); }} disabled={isCompleted} className="w-full bg-transparent text-sm font-medium text-slate-700 outline-none" placeholder="Auto-filled / Picker" /></HeaderField>
                    <HeaderField label="Crosschecked By" icon={FileCheck}><input type="text" value={pickingCrosscheckedBy} onChange={e => setPickingCrosscheckedBy(e.target.value)} disabled={isCompleted} className="w-full bg-transparent text-sm font-medium text-slate-700 outline-none" placeholder="Checker Name" /></HeaderField>
                    <HeaderField label="Vehicle No *" icon={Truck} hasError={errors.includes('vehicleNo')}><input type="text" value={vehicleNo} onChange={e => { setVehicleNo(e.target.value); clearError('vehicleNo'); }} disabled={isCompleted} className="w-full bg-transparent text-sm font-medium text-slate-700 outline-none uppercase" placeholder="XX-00-XX-0000" /></HeaderField>
                    <HeaderField label="Driver Name" icon={User}><input type="text" value={driverName} onChange={e => setDriverName(e.target.value)} disabled={isCompleted} className="w-full bg-transparent text-sm font-medium text-slate-700 outline-none" placeholder="Driver Name" /></HeaderField>
                    <HeaderField label="Seal No *" icon={Container} hasError={errors.includes('sealNo')}><input type="text" value={sealNo} onChange={e => { setSealNo(e.target.value); clearError('sealNo'); }} disabled={isCompleted} className="w-full bg-transparent text-sm font-medium text-slate-700 outline-none" placeholder="Seal #" /></HeaderField>
                    <HeaderField label="Reg. Serial No" icon={FileCheck}><input type="text" value={regSerialNo} onChange={e => setRegSerialNo(e.target.value)} disabled={isCompleted} className="w-full bg-transparent text-sm font-medium text-slate-700 outline-none" placeholder="Serial #" /></HeaderField>
                </div>

                <div className="flex flex-col lg:flex-row border-b border-slate-200">
                    {/* Left Panel: Staging Mirror (Stacks on top on mobile) */}
                    <div className="w-full lg:w-1/3 border-r border-slate-200 bg-slate-50/50">
                        <div className="p-4 border-b border-slate-200 flex items-center justify-between"><div className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2"><ClipboardList size={14} className="no-print" /> Staging (Mirror)</div></div>
                        <div className="overflow-x-auto custom-scrollbar">
                            {/* Minimum width for table ensures it's readable/scrollable on mobile */}
                            <table className="w-full min-w-[350px] text-xs">
                                <thead className="text-slate-400 border-b border-slate-200 bg-slate-50">
                                    <tr><th className="p-3 text-left w-8">#</th><th className="p-3 text-left">SKU Name</th><th className="p-3 text-center w-10">Cs/P</th><th className="p-3 text-center w-10">Full</th><th className="p-3 text-center w-10">Lse</th><th className="p-3 text-center w-12 bg-slate-100">TTL</th></tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {displayedStagingItems.map((item, idx) => (
                                        <tr key={item.srNo}>
                                            <td className="p-3 text-center">{item.srNo}</td>
                                            <td className="p-3 truncate max-w-[120px]" title={item.skuName}>{item.skuName}</td>
                                            <td className="p-3 text-center">{item.casesPerPlt || '-'}</td>
                                            <td className="p-3 text-center">{item.fullPlt || '-'}</td>
                                            <td className="p-3 text-center">{item.loose || '-'}</td>
                                            <td className="p-3 text-center font-bold bg-slate-50">{item.ttlCases}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Right Panel: Loading Entry (Below on mobile) */}
                    <div className="w-full lg:w-2/3 bg-white flex flex-col">
                        <div className="p-4 border-b border-slate-200 flex justify-between items-center"><div className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2"><Box size={14} /> Loading Entry</div></div>
                        <div className="overflow-x-auto flex-1 custom-scrollbar">
                            {/* Force min-width to ensure the 10-cell matrix isn't squashed on mobile */}
                            <table className="w-full min-w-[800px] text-xs border-collapse">
                                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200"><tr><th className="p-3 text-left w-24 sticky left-0 bg-slate-50 z-10 border-r border-slate-200">SKU</th><th className="p-3 text-center" colSpan={10}>Cells (1-10)</th><th className="p-3 text-center w-10">Lse</th><th className="p-3 text-center w-12">Tot</th><th className="p-3 text-center w-12">Bal</th></tr></thead>
                                <tbody>
                                    {currentSheet.loadingItems?.map((lItem, idx) => {
                                        const sItem = sheet.stagingItems.find(s => s.srNo === lItem.skuSrNo);
                                        if (!sItem || !sItem.skuName) return null;
                                        const rowsNeeded = Math.max(1, Math.ceil(sItem.fullPlt / 10));
                                        return Array.from({ length: rowsNeeded }).map((_, rIndex) => (
                                            <tr key={`${lItem.skuSrNo}-${rIndex}`} className={`hover:bg-blue-50/20 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                                                {rIndex === 0 && <td rowSpan={rowsNeeded} className="border-r border-b border-slate-200 p-3 font-medium align-middle sticky left-0 z-10 bg-inherit min-w-[100px]">{sItem.skuName}</td>}
                                                {Array.from({ length: 10 }).map((_, cIndex) => {
                                                    const cellNum = rIndex * 10 + cIndex + 1;
                                                    const isValid = cellNum <= sItem.fullPlt;
                                                    const cell = lItem.cells.find(c => c.row === rIndex && c.col === cIndex);
                                                    // Updated to hide 0s - only show valid values
                                                    // Added padding for larger touch target
                                                    return <td key={cIndex} className={`border-r border-b border-slate-100 p-0 text-center w-10 h-10 ${!isValid ? 'bg-slate-50' : ''}`}>{isValid && <input type="number" className="w-full h-full text-center outline-none bg-transparent" value={cell?.value !== undefined ? cell.value : ''} onChange={e => handleLoadingCellChange(lItem.skuSrNo, rIndex, cIndex, e.target.value)} onBlur={(e) => handleCellBlur(lItem.skuSrNo, rIndex, cIndex, e.target.value)} disabled={isCompleted} placeholder={isValid ? '' : ''} />}</td>
                                                })}
                                                {rIndex === 0 && <><td rowSpan={rowsNeeded} className="border-r border-b border-slate-100 p-0"><input type="number" placeholder="" className="w-full h-full text-center outline-none bg-transparent" value={lItem.looseInput !== undefined ? lItem.looseInput : ''} onChange={e => handleLooseChange(lItem.skuSrNo, e.target.value)} disabled={isCompleted} /></td><td rowSpan={rowsNeeded} className="border-r border-b border-slate-100 p-3 text-center font-bold">{lItem.total}</td><td rowSpan={rowsNeeded} className={`border-b border-slate-100 p-3 text-center font-bold ${lItem.balance !== 0 ? 'text-red-600' : 'text-green-600'}`}>{lItem.balance}</td></>}
                                            </tr>
                                        ));
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div className="p-4 border-b border-slate-200 bg-slate-50/30">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2"><Plus size={14} /> Additional Items (Extras)</h3>
                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full min-w-[600px] text-xs border border-slate-200 bg-white">
                            <thead><tr className="bg-slate-50 text-slate-500"><th className="p-2 text-left border-r w-8">#</th><th className="p-2 text-left border-r min-w-[120px]">SKU Name</th>{Array.from({ length: 10 }).map((_, i) => <th key={i} className="p-2 text-center border-r w-8">{i + 1}</th>)}<th className="p-2 text-center w-12">Total</th></tr></thead>
                            <tbody>
                                {currentSheet.additionalItems?.map((item) => (
                                    <tr key={item.id} className="border-t border-slate-100"><td className="p-2 text-center border-r">{item.id}</td><td className="p-0 border-r"><input type="text" className="w-full p-2 outline-none" placeholder="SKU Name" value={item.skuName} onChange={e => handleAdditionalChange(item.id, 'skuName', e.target.value)} disabled={isCompleted} /></td>{item.counts.map((c, idx) => (<td key={idx} className="p-0 border-r"><input type="number" className="w-full p-2 text-center outline-none" value={c || ''} onChange={e => handleAdditionalChange(item.id, 'count', e.target.value, idx)} disabled={isCompleted} /></td>))}<td className="p-2 text-center font-bold">{item.total}</td></tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 border-b border-slate-200">
                    <div className="p-4 md:p-6 border-r border-slate-200 bg-slate-50/30">
                        <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-4">Summary Totals</h3>
                        <table className="w-full text-sm">
                            <tbody>
                                <tr className="border-b border-slate-200 border-dashed"><td className="py-2.5 text-slate-500">Total Staging Qty</td><td className="py-2.5 text-right font-medium text-slate-800">{totalStaging}</td></tr>
                                <tr className="border-b border-slate-200 border-dashed"><td className="py-2.5 text-slate-500">Total Loaded Cases (Main + Extras)</td><td className="py-2.5 text-right font-bold text-blue-600">{grandTotalLoaded}</td></tr>
                                <tr><td className="py-2.5 text-slate-500">Balance to be Returned</td><td className={`py-2.5 text-right font-bold ${balance > 0 ? 'text-red-500' : 'text-green-500'}`}>{balance}</td></tr>
                            </tbody>
                        </table>
                    </div>
                    <div className="p-4 md:p-6 bg-amber-50/20">
                        <label className="block text-[10px] font-bold text-amber-600/80 uppercase tracking-wide mb-4 flex items-center gap-2"><AlertTriangle size={14} className="text-amber-500" /> Remarks & Adjustments</label>
                        {(extraItemsWithQty.length > 0 || returnedItems.length > 0) && (
                            <div className="mb-3 p-3 bg-amber-50 border border-amber-100 rounded-lg text-xs text-amber-900">
                                <ul className="list-disc pl-4 space-y-1">
                                    {returnedItems.map((item, idx) => (
                                        <li key={`ret-scr-${idx}`} className="font-semibold text-red-600">For {sheet.stagingItems.find(s => s.srNo === item.skuSrNo)?.skuName} {item.balance} loose returned.</li>
                                    ))}
                                    {extraItemsWithQty.map((item, idx) => (
                                        <li key={`ext-scr-${idx}`} className="font-semibold">For {item.skuName} {item.total} Cases Extra loaded.</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        <textarea className="w-full h-24 p-3 border border-slate-300 rounded-lg text-sm outline-none bg-white focus:ring-2 focus:ring-amber-500/20" placeholder="Enter other remarks regarding shortage/excess..." value={remarks} onChange={e => setRemarks(e.target.value)} disabled={isCompleted}></textarea>
                    </div>
                </div>

                <div className="p-6 border-t border-slate-200">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <HeaderField label="Supervisor Name" icon={User}><input type="text" value={svName} onChange={e => setSvName(e.target.value)} disabled={isCompleted} className="w-full text-sm outline-none" /></HeaderField>
                        <HeaderField label="Supervisor Sign" icon={FileCheck}><input type="text" value={svSign} onChange={e => setSvSign(e.target.value)} disabled={isCompleted} className="w-full text-sm outline-none font-script text-lg" placeholder="Sign" /></HeaderField>
                        <HeaderField label="SL Sign" icon={FileCheck}><input type="text" value={slSign} onChange={e => setSlSign(e.target.value)} disabled={isCompleted} className="w-full text-sm outline-none font-script text-lg" placeholder="Sign" /></HeaderField>
                        <HeaderField label="DEO Sign" icon={FileCheck}><input type="text" value={deoSign} onChange={e => setDeoSign(e.target.value)} disabled={isCompleted} className="w-full text-sm outline-none font-script text-lg" placeholder="Sign" /></HeaderField>
                    </div>
                </div>

                {/* Captured Evidence Section (On Screen) */}
                {capturedImage && (
                    <div className="p-6 border-t border-slate-200 bg-slate-50/20">
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2"><ImageIcon size={14} /> Captured Evidence</h3>
                        <div className="relative inline-block group">
                            <img src={capturedImage} alt="Captured" className="h-48 rounded-lg shadow-md border border-slate-200" />
                            {!isCompleted && (
                                <button onClick={() => setCapturedImage(null)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 transition-colors" title="Remove Photo">
                                    <XCircle size={16} />
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {!isCompleted && !cameraActive && (
                    <div className="fixed bottom-0 left-0 w-full p-4 bg-white/90 backdrop-blur-md border-t border-slate-200 shadow flex justify-center gap-4 z-50 lg:pl-64 no-print">
                        <button type="button" id="cameraButton" onClick={startCamera} className="px-6 py-2.5 bg-slate-100 text-slate-700 border border-slate-300 rounded-lg flex items-center gap-2 cursor-pointer hover:bg-slate-200 transition-colors pointer-events-auto"><Camera size={18} /> Add Photo</button>
                        <button type="button" id="submitButton" onClick={handleSubmit} className="px-8 py-2.5 bg-green-600 text-white rounded-lg flex items-center gap-2 font-bold shadow-lg cursor-pointer hover:bg-green-700 transition-colors pointer-events-auto"><CheckCircle size={18} /> Complete Loading</button>
                    </div>
                )}
                {cameraActive && (
                    <div className="fixed inset-0 z-[60] bg-slate-900 flex flex-col items-center justify-center">
                        <button onClick={stopCamera} className="absolute top-4 right-4 text-white hover:text-red-400"><XCircle size={32} /></button>
                        <video ref={videoRef} autoPlay playsInline className="max-w-full max-h-[70vh] border-2 border-slate-500 rounded-lg" />
                        <button type="button" onClick={capturePhoto} className="mt-8 bg-white text-black w-16 h-16 rounded-full border-4 border-slate-300 flex items-center justify-center hover:scale-105 transition-transform"></button>
                        <canvas ref={canvasRef} className="hidden" />
                    </div>
                )}
            </div>

            {isIncidentModalOpen && (
                <IncidentModal
                    sheetId={sheet.id}
                    currentUser={currentUser?.username || ''}
                    onClose={() => setIncidentModalOpen(false)}
                    onSuccess={() => {
                        // Optional: Show toast or update local state logic if needed
                    }}
                />
            )}
        </div>
    );
};
