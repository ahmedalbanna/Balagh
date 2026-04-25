import { useState, useEffect } from 'react';
import { 
  Plus, 
  Map as MapIcon, 
  Settings, 
  Bell, 
  User as UserIcon,
  LogOut,
  ChevronRight,
  Camera,
  Mic,
  CheckCircle2,
  AlertCircle,
  Clock,
  ThumbsUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db } from './lib/firebase.ts';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut 
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Report, UserProfile, ReportStatus, ReportPriority, ReportCategory } from './types.ts';
import { reportService } from './services/reportService.ts';
import { classifyReport } from './services/geminiService.ts';

// --- Components ---

function Header({ user, onSignOut }: { user: any; onSignOut: () => void }) {
  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-white/80 backdrop-blur-md border-b border-gray-100 z-40 flex items-center justify-between px-4 md:px-8">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center">
          <Bell className="w-5 h-5 text-white" />
        </div>
        <h1 className="font-sans font-bold text-xl tracking-tight text-gray-900">بلّغ</h1>
      </div>
      
      <div className="flex items-center gap-3">
        {user ? (
          <div className="flex items-center gap-2">
            <div className="hidden md:block text-right">
              <p className="text-sm font-medium text-gray-900 leading-none">{user.displayName}</p>
              <p className="text-xs text-gray-400">مواطن</p>
            </div>
            <button onClick={onSignOut} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500">
              <LogOut className="w-5 h-5" />
            </button>
            <img src={user.photoURL || ''} alt="" className="w-10 h-10 rounded-full border-2 border-orange-100" />
          </div>
        ) : (
          <button 
            onClick={() => signInWithPopup(auth, new GoogleAuthProvider())}
            className="bg-orange-600 text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-orange-700 transition-all shadow-sm shadow-orange-200"
          >
            دخول بالجوجل
          </button>
        )}
      </div>
    </header>
  );
}

function ReportCard({ report, onSupport }: { report: Report; onSupport: (id: string) => void }) {
  const statusColors = {
    [ReportStatus.PENDING]: 'bg-gray-100 text-gray-600',
    [ReportStatus.ACKNOWLEDGED]: 'bg-blue-50 text-blue-600',
    [ReportStatus.IN_PROGRESS]: 'bg-orange-50 text-orange-600',
    [ReportStatus.RESOLVED]: 'bg-green-50 text-green-600'
  };

  const statusIcons = {
    [ReportStatus.PENDING]: <Clock className="w-4 h-4" />,
    [ReportStatus.ACKNOWLEDGED]: <CheckCircle2 className="w-4 h-4" />,
    [ReportStatus.IN_PROGRESS]: <Clock className="w-4 h-4" />,
    [ReportStatus.RESOLVED]: <CheckCircle2 className="w-4 h-4" />
  };

  const priorityColors = {
    [ReportPriority.LOW]: 'text-gray-400',
    [ReportPriority.MEDIUM]: 'text-blue-400',
    [ReportPriority.HIGH]: 'text-orange-400',
    [ReportPriority.CRITICAL]: 'text-red-500'
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all group"
    >
      <div className="flex justify-between items-start mb-3">
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${statusColors[report.status]}`}>
          {statusIcons[report.status]}
          <span>{report.status}</span>
        </div>
        <div className={`w-2 h-2 rounded-full ${priorityColors[report.priority]} bg-current animate-pulse`} title={`الأولوية: ${report.priority}`} />
      </div>

      <h3 className="font-sans font-semibold text-gray-900 mb-1 line-clamp-1">{report.category}</h3>
      <p className="text-sm text-gray-500 line-clamp-2 mb-4 leading-relaxed tracking-tight">{report.description}</p>

      {report.imageUrl && (
        <div className="aspect-video rounded-xl overflow-hidden mb-4 bg-gray-50">
          <img src={report.imageUrl} alt="" className="w-full h-full object-cover" />
        </div>
      )}

      <div className="flex items-center justify-between pt-4 border-t border-gray-50">
        <button 
          onClick={() => onSupport(report.id)}
          className="flex items-center gap-2 text-gray-400 hover:text-orange-600 transition-colors group/btn"
        >
          <ThumbsUp className="w-5 h-5 group-hover/btn:scale-110 transition-transform" />
          <span className="text-sm font-medium">{report.supportCount} تأييد</span>
        </button>
        
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span>{report.createdAt?.seconds ? new Date(report.createdAt.seconds * 1000).toLocaleDateString('ar-SA') : 'الآن'}</span>
        </div>
      </div>
    </motion.div>
  );
}

function CreateReportModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [step, setStep] = useState(1);
  const [recording, setRecording] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      // AI Classification
      const aiResponse = await classifyReport(description, undefined, photo || undefined);
      
      const newReport: Partial<Report> = {
        category: aiResponse.category as ReportCategory,
        description: aiResponse.summary || description,
        priority: aiResponse.priority as ReportPriority,
        imageUrl: photo || undefined,
        location: { lat: 15.3694, lng: 44.1910, address: 'صنعاء - شارع الستين' }, // Mock for now
        neighborhoodId: 'sanaa_central'
      };

      await reportService.createReport(newReport);
      onCreated();
      onClose();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCapture = () => {
    // Simulated photo capture - in a real app would use navigator.mediaDevices
    setPhoto("https://images.unsplash.com/photo-1544006659-f0b21f04cb1b?auto=format&fit=crop&q=80&w=800"); 
    setStep(2);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-4">
      <motion.div 
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        className="bg-white w-full max-w-lg rounded-t-3xl md:rounded-3xl overflow-hidden shadow-2xl relative"
      >
        <div className="p-6">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 font-sans">بلاغ جديد</h2>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400">
              <Plus className="w-6 h-6 rotate-45" />
            </button>
          </div>

          <div className="space-y-6">
            {step === 1 ? (
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={handleCapture}
                  className="aspect-square bg-orange-50 border-2 border-dashed border-orange-200 rounded-3xl flex flex-col items-center justify-center gap-3 text-orange-600 hover:bg-orange-100 transition-all active:scale-95"
                >
                  <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-lg">
                    <Camera className="w-8 h-8" />
                  </div>
                  <span className="font-bold">صور المشكلة</span>
                </button>
                <button 
                  onClick={() => setRecording(!recording)}
                  className={`aspect-square rounded-3xl flex flex-col items-center justify-center gap-3 transition-all active:scale-95 ${recording ? 'bg-red-500 text-white shadow-xl shadow-red-200 animate-pulse' : 'bg-blue-50 border-2 border-dashed border-blue-200 text-blue-600 hover:bg-blue-100'}`}
                >
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center shadow-lg ${recording ? 'bg-white text-red-500' : 'bg-white'}`}>
                    <Mic className="w-8 h-8" />
                  </div>
                  <span className="font-bold">{recording ? 'جاري التسجيل...' : 'اضغط وسجل'}</span>
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {photo && (
                  <div className="relative aspect-video rounded-2xl overflow-hidden bg-gray-100">
                    <img src={photo} alt="" className="w-full h-full object-cover" />
                    <button 
                      onClick={() => setPhoto(null)} 
                      className="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-full backdrop-blur-sm"
                    >
                      <Plus className="w-4 h-4 rotate-45" />
                    </button>
                  </div>
                )}
                
                <textarea 
                  placeholder="اوصف المشكلة باختصار (اختياري)..."
                  className="w-full h-32 p-4 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-orange-500 text-gray-900 placeholder:text-gray-400"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />

                <button 
                  onClick={handleSubmit}
                  disabled={loading}
                  className="w-full bg-orange-600 text-white py-4 rounded-2xl font-bold text-lg hover:bg-orange-700 disabled:opacity-50 transition-all shadow-xl shadow-orange-100 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : 'إرسال البلاغ'}
                </button>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        // Ensure user profile exists
        const userDoc = doc(db, 'users', u.uid);
        const snap = await getDoc(userDoc);
        if (!snap.exists()) {
          await setDoc(userDoc, {
            uid: u.uid,
            displayName: u.displayName,
            photoURL: u.photoURL,
            role: 'citizen',
            createdAt: new Date().toISOString()
          });
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (user) {
      return reportService.subscribeToReports(setReports);
    }
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-12 h-12 border-4 border-orange-100 border-t-orange-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-white font-sans text-gray-900 flex flex-col items-center justify-center p-6 text-center" dir="rtl">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full"
        >
          <div className="w-24 h-24 bg-orange-600 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-orange-200 rotate-12">
            <Bell className="w-12 h-12 text-white -rotate-12" />
          </div>
          <h1 className="text-4xl font-black mb-4 tracking-tight">صوتك يوصل… حيّك يتحسن</h1>
          <p className="text-gray-500 mb-10 text-lg leading-relaxed">
            منصة "بلّغ" المجتمعية تتيح لك الإبلاغ عن أي مشكلة خدمية في حيك بالصوره والصوت بسهولة تامة.
          </p>
          
          <button 
            onClick={() => signInWithPopup(auth, new GoogleAuthProvider())}
            className="w-full bg-orange-600 text-white py-5 rounded-3xl font-bold text-xl hover:bg-orange-700 transition-all shadow-xl shadow-orange-100 mb-4"
          >
            ابدأ الآن (دخول بجوجل)
          </button>
          
          <p className="text-sm text-gray-400">
            بالانضمام، أنت تساهم في بناء مجتمع أفضل ومسؤول.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50 font-sans text-gray-900 pb-32" dir="rtl">
      <Header user={user} onSignOut={() => signOut(auth)} />

      <main className="max-w-7xl mx-auto pt-24 px-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-3xl font-black tracking-tight text-gray-900">بلاغات الحي</h2>
            <p className="text-gray-400 font-medium">صنعاء - المجتمع المحلي</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="bg-white p-2 rounded-xl border border-gray-100 shadow-sm flex items-center gap-2 px-4 py-3 hover:bg-gray-50 transition-colors">
              <MapIcon className="w-5 h-5 text-gray-400" />
              <span className="text-sm font-bold text-gray-600">عرض الخريطة</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reports.length === 0 ? (
            <div className="col-span-full py-20 text-center bg-white rounded-3xl border border-gray-100 border-dashed">
              <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-10 h-10 text-gray-200" />
              </div>
              <h3 className="text-xl font-bold text-gray-400">لا توجد بلاغات حتى الآن</h3>
              <p className="text-gray-300">كن أول من يساهم في تحسين الحي واضغط على زر "+"</p>
            </div>
          ) : (
            reports.map(report => (
              <ReportCard 
                key={report.id} 
                report={report} 
                onSupport={(id) => reportService.supportReport(id)} 
              />
            ))
          )}
        </div>
      </main>

      {/* Floating Action Button */}
      <div className="fixed bottom-0 left-0 right-0 p-6 flex justify-center pointer-events-none z-40">
        <button 
          onClick={() => setShowModal(true)}
          className="pointer-events-auto bg-orange-600 w-20 h-20 rounded-full flex items-center justify-center text-white shadow-2xl shadow-orange-300 hover:scale-110 active:scale-95 transition-all group overflow-hidden relative"
        >
          <div className="absolute inset-0 bg-gradient-to-tr from-orange-400 to-transparent opacity-0 group-hover:opacity-20 transition-opacity" />
          <Plus className="w-10 h-10 transition-transform group-hover:rotate-180 duration-500" />
        </button>
      </div>

      {/* Navigation (Mobile Style) */}
      <nav className="fixed bottom-6 right-6 md:right-10 flex flex-col gap-4 pointer-events-none z-40">
        {[
          { icon: <MapIcon className="w-6 h-6" />, label: 'خريطة' },
          { icon: <Bell className="w-6 h-6" />, label: 'تنبيهات' },
          { icon: <Settings className="w-6 h-6" />, label: 'إعدادات' }
        ].map((item, i) => (
          <button 
            key={i}
            className="pointer-events-auto w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-lg border border-gray-100 hover:bg-gray-50 transition-all active:scale-90"
            title={item.label}
          >
            <div className="text-gray-400">{item.icon}</div>
          </button>
        ))}
      </nav>

      <AnimatePresence>
        {showModal && (
          <CreateReportModal 
            onClose={() => setShowModal(false)} 
            onCreated={() => {}} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}
