import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Map, PlusCircle, LayoutDashboard, LogIn, LogOut, ShieldAlert } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';
import { motion } from 'framer-motion';

export function Layout() {
  const { user, profile, login, logout } = useAuth();
  const location = useLocation();

  const navItems = [
    { name: 'الخريطة المجتمعية', path: '/', icon: Map },
    { name: 'بلّغ الآن', path: '/report', icon: PlusCircle, requiresAuth: true },
    { name: 'لوحة التحكم', path: '/dashboard', icon: LayoutDashboard, requiresAuth: true, authorityOnly: true },
  ];

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col font-sans" dir="rtl">
      {/* Header */}
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-2">
              <div className="bg-green-600 p-2 rounded-xl text-white">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <Link to="/">
                <span className="font-bold text-2xl tracking-tight text-neutral-900">بلّغ</span>
                <span className="text-xs text-neutral-500 block -mt-1 font-medium">صوتك يوصل</span>
              </Link>
            </div>
            
            <div className="flex items-center gap-4">
              {user ? (
                <div className="flex items-center gap-4">
                  <div className="hidden md:block text-sm text-neutral-600 font-medium">
                    {profile?.displayName}
                  </div>
                  <img src={profile?.photoURL || 'https://via.placeholder.com/40'} alt="Profile" className="w-9 h-9 rounded-full border border-neutral-200" />
                  <button onClick={logout} className="text-neutral-500 hover:text-neutral-700 transition px-2 py-1 rounded-md hover:bg-neutral-100 flex items-center gap-2 text-sm font-medium">
                    <LogOut className="w-4 h-4" /> خروج
                  </button>
                </div>
              ) : (
                <button onClick={login} className="text-sm font-medium bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2">
                  <LogIn className="w-4 h-4" /> تسجيل الدخول
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 overflow-hidden relative">
        <Outlet />
      </main>

      {/* Bottom Navigation for Mobile / Side Navigation Desktop integration */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200 pb-safe z-50 md:hidden">
        <div className="flex justify-around items-center h-16">
          {navItems.filter(item => {
            if (item.authorityOnly && profile?.role !== 'authority') return false;
            return true;
          }).map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link key={item.path} to={item.path} onClick={(e) => {
                if (item.requiresAuth && !user) {
                  e.preventDefault();
                  login();
                }
              }} className={cn(
                "flex flex-col items-center justify-center w-full h-full space-y-1 relative",
                isActive ? "text-green-600" : "text-neutral-500 hover:text-neutral-900"
              )}>
                {isActive && (
                  <motion.div layoutId="navIndicator" className="absolute top-0 left-0 right-0 h-0.5 bg-green-600" />
                )}
                <Icon className={cn("w-5 h-5", isActive ? "stroke-[2.5px]" : "stroke-2")} />
                <span className="text-[10px] font-medium">{item.name}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
