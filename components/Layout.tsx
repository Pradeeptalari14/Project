
import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../AppContext';
import { Role } from '../types';
import {
  LogOut,
  LayoutDashboard,
  ClipboardList,
  Truck,
  Users,
  History,
  Bell,
  Menu,
  Key,
  X,
  Database,
  AlertTriangle
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  currentPage: string;
  onNavigate: (page: string) => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, currentPage, onNavigate }) => {
  const { currentUser, logout, notifications, resetPassword, markAllRead } = useApp();
  const [isChangePasswordOpen, setChangePasswordOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');

  // Mobile Menu State
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Notification State
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(n => !n.read).length;

  const NavItem = ({ page, icon: Icon, label, roles }: { page: string, icon: any, label: string, roles: Role[] }) => {
    if (!currentUser || !roles.includes(currentUser.role) && currentUser.role !== Role.ADMIN) return null;

    const isActive = currentPage === page;

    return (
      <button
        onClick={() => {
          onNavigate(page);
          setIsMobileMenuOpen(false); // Close menu on mobile nav
        }}
        className={`group w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-all duration-200 rounded-lg mx-2 w-[calc(100%-16px)] ${isActive
          ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
          }`}
      >
        <Icon size={20} className={`transition-colors ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'}`} />
        <span>{label}</span>
      </button>
    );
  };

  const handleChangePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !newPassword) return;

    resetPassword(currentUser.id, newPassword);
    alert('Your password has been changed successfully.');
    setNewPassword('');
    setChangePasswordOpen(false);
  };

  const toggleNotifications = () => {
    if (!showNotifications) {
      markAllRead();
    }
    setShowNotifications(!showNotifications);
  };

  // Close notifications when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans print:h-auto print:overflow-visible print:block">
      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        ></div>
      )}

      {/* Sidebar - Responsive */}
      <div className={`
            fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-slate-200 flex flex-col transition-transform duration-300 ease-in-out transform
            lg:static lg:translate-x-0 lg:w-56 print:hidden
            ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-200">
              <span className="text-white font-bold text-lg">U</span>
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-800 leading-tight">Unicharm</h1>
              <p className="text-[10px] text-slate-400 font-medium tracking-wide uppercase">SCM Operations</p>
            </div>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="lg:hidden text-slate-400 hover:text-slate-600">
            <X size={24} />
          </button>
        </div>

        <nav className="flex-1 py-2 space-y-1 overflow-y-auto">
          <NavItem
            page="dashboard"
            icon={LayoutDashboard}
            label="Dashboard"
            roles={[Role.ADMIN, Role.SHIFT_LEAD, Role.STAGING_SUPERVISOR, Role.LOADING_SUPERVISOR, Role.VIEWER]}
          />
          <NavItem
            page="staging"
            icon={ClipboardList}
            label="Staging Sheets"
            roles={[Role.STAGING_SUPERVISOR, Role.ADMIN, Role.SHIFT_LEAD]}
          />
          <NavItem
            page="loading"
            icon={Truck}
            label="Loading Sheets"
            roles={[Role.LOADING_SUPERVISOR, Role.ADMIN, Role.SHIFT_LEAD]}
          />
          <NavItem
            page="approvals"
            icon={ClipboardList} // Using ClipboardList as it fits
            label="Shift Lead"
            roles={[Role.ADMIN, Role.SHIFT_LEAD]}
          />

          <div className="pt-4 pb-2 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Administration</div>
          <NavItem
            page="admin"
            icon={Users}
            label="User Management"
            roles={[Role.ADMIN]}
          />
          <NavItem
            page="database"
            icon={Database}
            label="Database"
            roles={[Role.ADMIN]}
          />
          <NavItem
            page="audit"
            icon={History}
            label="Audit Logs"
            roles={[Role.ADMIN]}
          />
        </nav>

        {/* User Profile Card - Compact */}
        <div className="p-2 border-t border-slate-100">
          <div className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 transition-colors gap-2">
            <div className="flex items-center gap-2 min-w-0 overflow-hidden">
              <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold text-xs">
                {currentUser?.fullName ? currentUser.fullName.charAt(0).toUpperCase() : currentUser?.username.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-700 truncate">{currentUser?.fullName || currentUser?.username}</p>
                <p className="text-[10px] text-slate-400 truncate capitalize">{currentUser?.role.replace('_', ' ').toLowerCase()}</p>
              </div>
            </div>
            <button
              onClick={logout}
              className="p-1.5 text-slate-400 hover:text-red-500 rounded-md transition-colors"
              title="Sign Out"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden w-full relative print:h-auto print:overflow-visible print:block">
        {/* Header - Transparent & Light */}
        <header className="h-16 flex items-center justify-between px-4 md:px-8 bg-white/80 backdrop-blur-sm border-b border-slate-200 z-10 no-print flex-shrink-0 sticky top-0">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden text-slate-500 hover:text-blue-600"
            >
              <Menu size={24} />
            </button>
            <h2 className="text-lg md:text-xl font-bold text-slate-800 capitalize tracking-tight truncate">
              {currentPage === 'admin' ? 'User Administration' : currentPage.replace('-', ' ')}
            </h2>
          </div>

          <div className="flex items-center gap-4 md:gap-6">
            {/* User Profile in Header */}
            <div className="hidden md:flex flex-col items-end mr-2">
              <span className="text-sm font-bold text-slate-800">{currentUser?.fullName || currentUser?.username}</span>
              <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{currentUser?.role.replace(/_/g, ' ')}</span>
            </div>

            <div className="hidden md:flex flex-col items-end border-l border-slate-200 pl-4">
              <span className="text-xs font-semibold text-slate-600">{new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
            </div>
            <div className="h-8 w-[1px] bg-slate-200 hidden md:block"></div>

            {/* Notification Dropdown */}
            <div className="relative" ref={notificationRef}>
              <div
                onClick={toggleNotifications}
                className="p-2 rounded-full hover:bg-slate-100 cursor-pointer transition-colors relative"
              >
                <Bell className="text-slate-500" size={20} />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full animate-pulse"></span>
                )}
              </div>

              {/* Dropdown Menu */}
              {showNotifications && (
                <div className="absolute right-0 top-12 w-72 md:w-80 bg-white rounded-xl shadow-2xl border border-slate-100 overflow-hidden z-50 animate-in fade-in zoom-in duration-200">
                  <div className="p-3 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                    <h3 className="font-bold text-slate-700 text-xs uppercase tracking-wider">Notifications</h3>
                    <button onClick={() => setShowNotifications(false)} className="text-slate-400 hover:text-slate-600"><X size={14} /></button>
                  </div>
                  <div className="max-h-64 overflow-y-auto custom-scrollbar">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-slate-400 text-sm">No new notifications.</div>
                    ) : (
                      <div className="divide-y divide-slate-50">
                        {notifications.map(n => (
                          <div key={n.id} className={`p-3 hover:bg-slate-50 transition-colors ${!n.read ? 'bg-blue-50/50' : ''}`}>
                            <p className="text-sm text-slate-700 leading-snug">{n.message}</p>
                            <p className="text-[10px] text-slate-400 mt-1">{new Date(n.timestamp).toLocaleString()}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-auto p-4 md:p-8 relative print:p-0 print:overflow-visible w-full bg-slate-50 print:bg-white print:h-auto">
          <div className="max-w-7xl mx-auto h-full print:h-auto print:max-w-none print:w-full">
            {children}
          </div>
        </main>
      </div>

      {/* Change Password Modal (User Self-Service) */}
      {isChangePasswordOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm no-print">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-700 flex items-center gap-2"><Key size={18} className="text-blue-600" /> Change Password</h3>
              <button onClick={() => setChangePasswordOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors"><X size={20} /></button>
            </div>
            <form onSubmit={handleChangePasswordSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">New Password</label>
                <input
                  type="password"
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                />
              </div>
              <div className="pt-2">
                <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-lg shadow-md transition-all active:scale-[0.98]">
                  Update Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
