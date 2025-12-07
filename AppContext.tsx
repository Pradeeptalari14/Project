
import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, SheetData, Role, Notification } from './types';
import { supabase } from './services/supabaseClient';

interface AppContextType {
    currentUser: User | null;
    users: User[];
    sheets: SheetData[];
    notifications: Notification[];
    auditLogs: any[];
    isLoading: boolean;
    login: (username: string, pass: string, role: Role) => Promise<boolean>;
    logout: () => Promise<void>;
    register: (user: User) => Promise<void>;
    approveUser: (id: string, approve: boolean) => Promise<void>;
    deleteUser: (id: string) => Promise<void>;
    resetPassword: (id: string, newPass: string) => Promise<void>;
    addSheet: (sheet: SheetData) => Promise<void>;
    updateSheet: (sheet: SheetData) => Promise<void>;
    deleteSheet: (id: string, reason: string) => Promise<void>;
    addComment: (sheetId: string, text: string) => Promise<void>;
    acquireLock: (sheetId: string) => boolean;
    releaseLock: (sheetId: string) => void;
    addNotification: (msg: string) => void;
    markAllRead: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [users, setUsers] = useState<User[]>([]);
    const [sheets, setSheets] = useState<SheetData[]>([]);
    const [auditLogs, setAuditLogs] = useState<any[]>([]);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // Fetch data on load
    useEffect(() => {
        fetchSheets();
        fetchUsers();
        fetchLogs();
    }, []);

    const fetchSheets = async () => {
        const { data, error } = await supabase
            .from('sheets')
            .select('*')
            .order('created_at', { ascending: false });

        if (data && !error) {
            const loadedSheets = data
                .filter(d => d.data) // Filter out invalid/empty data
                .map(d => ({
                    ...d.data,
                    id: d.id,
                    status: d.data.status || 'DRAFT'
                })) as SheetData[];
            setSheets(loadedSheets);
        }
    };

    const fetchUsers = async () => {
        const { data } = await supabase.from('users').select('*');
        if (data) {
            const mappedUsers: User[] = data
                .filter(d => d.data) // Filter out null data
                .map(d => d.data as User);
            setUsers(mappedUsers);

            // Auto-Seed Default Admin if DB is empty
            if (mappedUsers.length === 0) {
                console.log("No users found. Seeding default admin...");
                const defaultAdmin: User = {
                    id: "1",
                    username: "admin",
                    fullName: "System Administrator",
                    role: Role.ADMIN,
                    empCode: "ADM001",
                    email: "admin@unicharm.com",
                    isApproved: true,
                    password: "123"
                };

                const { error: seedError } = await supabase.from('users').insert({
                    id: defaultAdmin.id,
                    data: defaultAdmin
                });

                if (!seedError) {
                    setUsers([defaultAdmin]);
                    addNotification("Default Admin (admin/123) created.");
                } else {
                    console.error("Failed to seed admin:", seedError);
                }
            }
        }
    };

    const fetchLogs = async () => {
        const { data } = await supabase.from('logs').select('*');
        if (data) {
            const mappedLogs = data.map(d => d.data).sort((a: any, b: any) =>
                new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            );
            setAuditLogs(mappedLogs);
        }
    };

    const addLog = async (action: string, details: string) => {
        const logEntry = {
            id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
            user: currentUser?.username || 'System',
            action,
            timestamp: new Date().toISOString(),
            details
        };
        setAuditLogs(prev => [logEntry, ...prev]);
        await supabase.from('logs').insert({
            id: logEntry.id,
            data: logEntry
        });
    };

    const login = async (username: string, pass: string, role: Role) => {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('data->>username', username)
                .eq('data->>password', pass)
                .limit(1);

            if (error) {
                console.error("Login Error", error);
                return false;
            }

            if (data && data.length > 0) {
                const user = data[0].data as User;
                if (!user.isApproved) return false;
                setCurrentUser(user);
                addLog('LOGIN', `User ${username} logged in`);
                return true;
            }
            return false;
        } catch (e) {
            console.error(e);
            return false;
        }
    };

    const logout = async () => {
        if (currentUser) addLog('LOGOUT', `User ${currentUser.username} logged out`);
        setCurrentUser(null);
    };

    const register = async (user: User) => {
        // Auto-approve first user as ADMIN
        const isFirstUser = users.length === 0;
        const finalUser = isFirstUser ? { ...user, role: Role.ADMIN, isApproved: true } : user;

        const { error } = await supabase.from('users').insert({
            id: finalUser.id || Date.now().toString() + Math.random().toString(36).substring(2, 9),
            data: finalUser
        });
        if (error) throw error;

        if (isFirstUser) {
            addLog('SYSTEM', `First user registered as ADMIN: ${finalUser.username}`);
        }

        fetchUsers();
    };

    const approveUser = async (id: string, approve: boolean) => {
        const userToUpdate = users.find(u => u.id === id);
        if (!userToUpdate) return;

        if (approve) {
            const updatedUser = { ...userToUpdate, isApproved: true };
            await supabase.from('users').update({ data: updatedUser }).eq('id', id);
            addLog('USER_APPROVE', `User ${userToUpdate.username} approved`);
        } else {
            await supabase.from('users').delete().eq('id', id);
            addLog('USER_REJECT', `User ${userToUpdate.username} rejected`);
        }
        fetchUsers();
    };

    const deleteUser = async (id: string) => {
        const userToDelete = users.find(u => u.id === id);
        if (!userToDelete) return;

        await supabase.from('users').delete().eq('id', id);
        addLog('USER_DELETE', `User ${userToDelete.username} deleted by admin`);
        fetchUsers();
    };

    const resetPassword = async (id: string, newPass: string) => {
        const userToUpdate = users.find(u => u.id === id);
        if (!userToUpdate) return;

        const updatedUser = { ...userToUpdate, password: newPass };
        await supabase.from('users').update({ data: updatedUser }).eq('id', id);
        addLog('PASSWORD_RESET', `Password reset for user ${userToUpdate.username}`);
        fetchUsers();
    };

    const addSheet = async (sheet: SheetData) => {
        const { error } = await supabase.from('sheets').insert({
            id: sheet.id,
            data: sheet
        });

        if (!error) {
            setSheets(prev => [sheet, ...prev]);
            addNotification(`Sheet ${sheet.id} created.`);
            addLog('SHEET_CREATE', `Sheet ${sheet.id} created`);
        }
    };

    const updateSheet = async (sheet: SheetData) => {
        const { error } = await supabase.from('sheets').update({
            data: sheet
        }).eq('id', sheet.id);

        if (!error) {
            setSheets(prev => prev.map(s => s.id === sheet.id ? sheet : s));
            if (sheet.status !== SheetStatus.DRAFT) {
                addLog('SHEET_UPDATE', `Sheet ${sheet.id} updated (Status: ${sheet.status})`);
            }
        }
    };

    const deleteSheet = async (id: string, reason: string) => {
        const { error } = await supabase.from('sheets').delete().eq('id', id);
        if (!error) {
            setSheets(prev => prev.filter(s => s.id !== id));
            addLog('SHEET_DELETE', `Sheet ${id} deleted. Reason: ${reason}`);
        }
    };

    const addComment = async (sheetId: string, text: string) => {
        const sheet = sheets.find(s => s.id === sheetId);
        if (!sheet) return;

        const newComment = {
            id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
            author: currentUser?.username || 'Unknown',
            text,
            timestamp: new Date().toISOString()
        };

        const updatedSheet = {
            ...sheet,
            comments: [newComment, ...(sheet.comments || [])]
        };
        await updateSheet(updatedSheet);
        addLog('COMMENT', `Comment added to sheet ${sheetId}`);
    };

    const [activeLocks, setActiveLocks] = useState<Set<string>>(new Set());
    const acquireLock = (sheetId: string) => {
        if (activeLocks.has(sheetId)) return false;
        setActiveLocks(prev => new Set(prev).add(sheetId));
        return true;
    };
    const releaseLock = (sheetId: string) => {
        setActiveLocks(prev => {
            const next = new Set(prev);
            next.delete(sheetId);
            return next;
        });
    };

    const addNotification = (msg: string) => {
        setNotifications(prev => [{ id: Date.now().toString() + Math.random().toString(36).substring(2, 9), message: msg, read: false, timestamp: new Date().toISOString() }, ...prev]);
    };

    const markAllRead = () => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    };

    return (
        <AppContext.Provider value={{
            currentUser, users, sheets, notifications, auditLogs, isLoading,
            login, logout, register, approveUser, deleteUser, resetPassword,
            addSheet, updateSheet, deleteSheet, addComment,
            acquireLock, releaseLock, addNotification, markAllRead
        }}>
            {children}
        </AppContext.Provider>
    );
};

export const useApp = () => {
    const context = useContext(AppContext);
    if (context === undefined) {
        throw new Error('useApp must be used within an AppProvider');
    }
    return context;
};

// Need to import SheetStatus for conditional check if not imported
import { SheetStatus } from './types'; 
