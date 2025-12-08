
import React, { useState } from 'react';
import { useApp } from '../AppContext';
import { Role } from '../types';
import { UserPlus, LogIn, AlertCircle, CheckCircle2, Eye, EyeOff } from 'lucide-react';

export const Auth = () => {
    const { login, register } = useApp();
    const [isLogin, setIsLogin] = useState(true);

    const [username, setUsername] = useState('');
    const [fullName, setFullName] = useState('');
    const [empCode, setEmpCode] = useState('');
    const [password, setPassword] = useState('');
    const [email, setEmail] = useState('');
    const [role, setRole] = useState<Role>(Role.STAGING_SUPERVISOR);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const resetForm = () => {
        setUsername('');
        setFullName('');
        setEmpCode('');
        setPassword('');
        setEmail('');
        setRole(Role.STAGING_SUPERVISOR);
        setError('');
        setSuccessMsg('');
    };

    const toggleMode = () => {
        setIsLogin(!isLogin);
        resetForm();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccessMsg('');

        if (isLogin) {
            const success = await login(username.trim(), password, role);
            if (!success) setError('Invalid credentials or role mismatch.');
        } else {
            if (!fullName.trim() || !empCode.trim()) {
                setError('Full Name and Employee Code are required.');
                return;
            }
            try {
                await register({
                    id: Date.now().toString(),
                    username: username.trim(),
                    fullName: fullName.trim(),
                    empCode: empCode.trim(),
                    password,
                    role,
                    email: email.trim(),
                    isApproved: false
                });
                setIsLogin(true);
                setSuccessMsg('Registration successful! Please login.');
                setUsername('');
                setFullName('');
                setEmpCode('');
                setPassword('');
            } catch (err: any) {
                setError(err.message || 'Registration failed.');
            }
        }
    };

    return (
        <div
            className="min-h-screen w-full flex items-center justify-center md:justify-end md:pr-24 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: "url('/login-bg.png')" }}
        >
            {/* Overlay for better text contrast if image is too bright, optional */}
            <div className="absolute inset-0 bg-black/20 pointer-events-none"></div>

            <div className="w-full max-w-sm bg-black/60 backdrop-blur-md p-8 rounded-2xl shadow-2xl text-white border border-white/10 z-10 mx-4">
                <div className="text-center mb-8">
                    <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-900/50">
                        <span className="text-2xl font-bold text-white">U</span>
                    </div>
                    <h1 className="text-2xl font-bold mb-1">Unicharm SCM</h1>
                    <p className="text-white/60 text-xs">FG Warehouse Operations</p>
                </div>

                {error && (
                    <div className="mb-4 p-3 rounded-lg bg-red-500/20 border border-red-500/50 flex items-center gap-2 text-sm text-red-100">
                        <AlertCircle size={16} /> {error}
                    </div>
                )}
                {successMsg && (
                    <div className="mb-4 p-3 rounded-lg bg-green-500/20 border border-green-500/50 flex items-center gap-2 text-sm text-green-100">
                        <CheckCircle2 size={16} /> {successMsg}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <input
                            id="loginUsername"
                            type="text"
                            required
                            className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/10 focus:border-blue-400 focus:bg-white/20 focus:outline-none transition-all text-sm font-medium text-white placeholder-white/50"
                            placeholder="Username"
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                        />
                    </div>

                    {!isLogin && (
                        <>
                            <div>
                                <input
                                    type="text"
                                    required
                                    className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/10 focus:border-blue-400 focus:bg-white/20 focus:outline-none transition-all text-sm font-medium text-white placeholder-white/50"
                                    placeholder="Full Name"
                                    value={fullName}
                                    onChange={e => setFullName(e.target.value)}
                                />
                            </div>
                            <div>
                                <input
                                    type="text"
                                    required
                                    className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/10 focus:border-blue-400 focus:bg-white/20 focus:outline-none transition-all text-sm font-medium text-white placeholder-white/50"
                                    placeholder="Employee Code"
                                    value={empCode}
                                    onChange={e => setEmpCode(e.target.value)}
                                />
                            </div>
                        </>
                    )}

                    {!isLogin && (
                        <div>
                            <input
                                type="email"
                                required
                                className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/10 focus:border-blue-400 focus:bg-white/20 focus:outline-none transition-all text-sm font-medium text-white placeholder-white/50"
                                placeholder="Email Address"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                            />
                        </div>
                    )}

                    <div className="relative">
                        <input
                            id="loginPassword"
                            type={showPassword ? 'text' : 'password'}
                            required
                            className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/10 focus:border-blue-400 focus:bg-white/20 focus:outline-none transition-all text-sm font-medium text-white placeholder-white/50 pr-10"
                            placeholder="Password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/60 hover:text-white transition-colors"
                        >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>

                    <div className="relative">
                        <select
                            className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/10 focus:border-blue-400 focus:bg-white/20 focus:outline-none transition-all text-sm font-medium text-white appearance-none cursor-pointer"
                            value={role}
                            onChange={e => setRole(e.target.value as Role)}
                        >
                            <option value={Role.STAGING_SUPERVISOR} className="text-slate-900">Staging Supervisor</option>
                            <option value={Role.LOADING_SUPERVISOR} className="text-slate-900">Loading Supervisor</option>
                            <option value={Role.ADMIN} className="text-slate-900">Administrator</option>
                            <option value={Role.SHIFT_LEAD} className="text-slate-900">Shift Lead</option>
                        </select>
                        <div className="absolute right-4 top-1/2 transform -translate-y-1/2 pointer-events-none text-white/50">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                        </div>
                    </div>

                    <button type="submit" className="w-full bg-[#ff7b00] hover:bg-[#ff9500] text-white font-bold py-3.5 rounded-lg shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 mt-4">
                        {isLogin ? <><LogIn size={18} /> Login</> : <><UserPlus size={18} /> Register</>}
                    </button>
                </form>

                <div className="mt-6 text-center">
                    <p className="text-sm text-white/60">
                        {isLogin ? "Don't have an account?" : "Already have an account?"}
                        <button onClick={toggleMode} className="ml-1 text-[#ff7b00] font-semibold hover:text-[#ff9500] hover:underline">
                            {isLogin ? "Register now" : "Login here"}
                        </button>
                    </p>
                </div>
            </div>
        </div>
    );
};
