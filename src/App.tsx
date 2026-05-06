import { useState, useEffect, useRef } from 'react';
import { cn } from './lib/utils.ts';
import { 
  Plus, 
  Map as MapIcon, 
  Bell, 
  User as UserIcon,
  LogOut,
  Camera,
  Mic,
  CheckCircle2,
  AlertCircle,
  Clock,
  ThumbsUp,
  Image as ImageIcon,
  Play,
  Square,
  Activity,
  Heart,
  TrendingUp,
  Newspaper,
  ShieldCheck,
  Star,
  Share2,
  Trash2,
  Filter,
  MessageSquare,
  Medal,
  ChevronRight,
  ArrowRight,
  MapPin,
  Calendar,
  Eye,
  MessageCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db } from './lib/firebase.ts';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut 
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, increment, serverTimestamp } from 'firebase/firestore';
import { Report, UserProfile, ReportStatus, ReportPriority, ReportCategory, NewsItem } from './types.ts';
import { reportService } from './services/reportService.ts';
import { classifyReport } from './services/geminiService.ts';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix leaflet icons
// @ts-expect-error - image imports
import iconUrl from 'leaflet/dist/images/marker-icon.png';
// @ts-expect-error - image imports
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
// @ts-expect-error - image imports
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

L.Icon.Default.mergeOptions({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
});

// --- Components ---

function Header({ user, profile, onSignOut, currentTab, setTab }: { user: any; profile: UserProfile | null; onSignOut: () => void; currentTab: string, setTab: (t: string) => void }) {
  return (
    <nav className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-md border-b border-slate-200/60">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-3 flex justify-between items-center h-16 md:h-20">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setTab('home')}>
            <div className="w-10 h-10 bg-brand-orange rounded-xl flex items-center justify-center shadow-lg shadow-brand-orange/25 group-hover:scale-105 transition-transform duration-300">
              <Bell className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-xl font-bold tracking-tight text-slate-900 leading-tight">بلّغ</h1>
              <span className="text-[10px] text-slate-500 font-medium tracking-wide">صوتك يوصل</span>
            </div>
          </div>
          
          {user && (
            <div className="hidden md:flex items-center gap-1">
              {[
                { id: 'home', label: 'الرئيسية' },
                { id: 'map', label: 'الخريطة' },
                { id: 'news', label: 'الأخبار' },
                { id: 'support', label: 'الدعم' },
              ].map((item) => (
                <button 
                  key={item.id}
                  onClick={() => setTab(item.id)} 
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 relative",
                    currentTab === item.id 
                      ? "text-brand-orange" 
                      : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                  )}
                >
                  {item.label}
                  {currentTab === item.id && (
                    <motion.div 
                      layoutId="nav-underline" 
                      className="absolute bottom-0 left-4 right-4 h-0.5 bg-brand-orange rounded-full" 
                    />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-3 md:gap-5">
              {profile && profile.role === 'citizen' && (
                <div className="hidden sm:flex items-center gap-2 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-full">
                  <Medal className="w-4 h-4 text-brand-orange" />
                  <span className="text-xs font-bold text-slate-700">{profile.points || 0} نقطة</span>
                </div>
              )}
              {profile && profile.role === 'authority' && (
                <div className="bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full flex items-center gap-2 text-xs font-bold border border-blue-100">
                  <ShieldCheck className="w-4 h-4" />
                  <span className="hidden sm:inline">جهة خدمية</span>
                </div>
              )}
              
              <div className="flex items-center gap-2">
                <div className="hidden sm:flex flex-col items-end mr-1">
                  <span className="text-[10px] font-bold text-slate-900 leading-none mb-0.5">{profile?.displayName}</span>
                  <span className="text-[9px] text-slate-500 font-medium leading-none">{profile?.tier || 'مواطن'}</span>
                </div>
                <div className="relative group">
                  <img src={user.photoURL || ''} alt="" className="w-9 h-9 rounded-full border-2 border-white ring-1 ring-slate-200 shadow-sm transition-transform group-hover:scale-105" />
                </div>
                <button 
                  onClick={onSignOut} 
                  className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                  title="تسجيل الخروج"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            </div>
          ) : (
            <button 
              onClick={() => signInWithPopup(auth, new GoogleAuthProvider())}
              className="bg-brand-orange text-white px-6 py-2.5 rounded-xl text-sm font-extrabold hover:bg-brand-orange-hover transition-all shadow-lg shadow-brand-orange/20 hover:-translate-y-0.5 active:translate-y-0"
            >
              تسجيل الدخول
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}

function ReportCard({ report, onSupport, isAuthority, onResolve, onClick }: { key?: string | number; report: Report; onSupport: (id: string) => void; isAuthority: boolean; onResolve: (id: string, img: string) => void; onClick: (r: Report) => void }) {
  const [resolving, setResolving] = useState(false);
  const [ratingInput, setRatingInput] = useState('');
  const [isRatingOpen, setIsRatingOpen] = useState(false);

  const statusColors = {
    [ReportStatus.PENDING]: 'bg-rose-50 text-rose-600 border-rose-100',
    [ReportStatus.ACKNOWLEDGED]: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    [ReportStatus.IN_PROGRESS]: 'bg-amber-50 text-amber-700 border-amber-100',
    [ReportStatus.RESOLVED]: 'bg-emerald-50 text-emerald-600 border-emerald-100'
  };

  const statusText = {
    [ReportStatus.PENDING]: 'جديد',
    [ReportStatus.ACKNOWLEDGED]: 'تم الاستلام',
    [ReportStatus.IN_PROGRESS]: 'جاري المعالجة',
    [ReportStatus.RESOLVED]: 'تم الحل'
  };

  const isResolved = report.status === ReportStatus.RESOLVED;
  const isDelayed = report.status === ReportStatus.PENDING && report.createdAt?.seconds && ((new Date().getTime() / 1000) - report.createdAt.seconds) > (7 * 24 * 60 * 60);
  const isMine = report.userId === auth.currentUser?.uid;

  return (
    <div 
      onClick={() => onClick(report)}
      className={cn(
      "group relative p-5 rounded-3xl bg-white border border-slate-100 flex flex-col gap-4 transition-all duration-300 hover:shadow-xl hover:shadow-slate-200/40 hover:border-slate-200 cursor-pointer",
      isResolved && "bg-slate-50/50 grayscale-[0.3]",
      isDelayed && "border-rose-200 bg-rose-50/10"
    )}>
      <div className="flex gap-5">
        <div className="w-24 h-24 bg-slate-100 rounded-2xl overflow-hidden flex-shrink-0 flex items-center justify-center border border-slate-200/50 group-hover:scale-[1.02] transition-transform duration-300">
          {report.imageUrl ? (
            <img src={report.imageUrl} alt="Report" className="w-full h-full object-cover" />
          ) : (
            <ImageIcon className="w-8 h-8 text-slate-300" />
          )}
        </div>
        
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex justify-between items-start mb-2 gap-3">
            <div className="flex flex-col gap-1 min-w-0">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                {report.priority === ReportPriority.CRITICAL && <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />}
                {report.category}
              </span>
              <h4 className="text-base font-bold text-slate-900 leading-tight line-clamp-1 group-hover:text-brand-orange transition-colors">
                {report.description}
              </h4>
            </div>
            <span className={cn(
              "px-2.5 py-1 rounded-lg text-[10px] font-bold border whitespace-nowrap",
              statusColors[report.status]
            )}>
              {statusText[report.status]}
            </span>
          </div>

          {isDelayed && (
            <div className="flex items-center gap-1.5 text-rose-500 text-[10px] mb-2 font-bold bg-rose-50 w-fit px-2 py-0.5 rounded-md">
              <AlertCircle className="w-3 h-3" /> بلاغ متأخر
            </div>
          )}
          
          {isResolved && report.resolvedImageUrl && (
            <div className="mt-2 mb-3 p-2 bg-emerald-50 rounded-2xl flex items-center gap-3 border border-emerald-100">
              <img src={report.resolvedImageUrl} className="w-12 h-12 rounded-xl object-cover border border-emerald-200" />
              <div className="flex flex-col">
                <span className="text-xs font-extrabold text-emerald-700">تم الإنجاز</span>
                <span className="text-[10px] text-emerald-600/70 font-medium tracking-tight">بناءً على طلب المواطن</span>
              </div>
            </div>
          )}

          <div className="flex justify-between items-center mt-auto pt-3 border-t border-slate-50">
            <div className="flex items-center gap-3 text-[11px] text-slate-400 font-semibold tracking-tight">
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3 opacity-70" />
                <span>{report.createdAt?.seconds ? new Date(report.createdAt.seconds * 1000).toLocaleDateString('ar-SA') : 'الآن'}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {!isResolved && (
                <button 
                  onClick={(e) => { e.stopPropagation(); onSupport(report.id); }}
                  className="flex items-center gap-1.5 text-brand-orange bg-brand-orange/5 hover:bg-brand-orange/10 px-3 py-1.5 rounded-xl font-extrabold text-[11px] transition-all active:scale-95"
                >
                  <ThumbsUp className="w-3.5 h-3.5" />
                  {report.supportCount || 0}
                </button>
              )}
              
              {isAuthority && !isResolved && (
                <button 
                  onClick={(e) => { e.stopPropagation(); setResolving(true); }}
                  className="flex items-center gap-1 bg-emerald-500 text-white font-bold text-[10px] px-2.5 py-1.5 rounded-xl hover:bg-emerald-600 transition-colors shadow-sm"
                >
                  إغلاق وتحقق
                </button>
              )}

              <div className="h-4 w-px bg-slate-100 mx-1" />

              <div className="flex items-center gap-1">
                <button onClick={(e) => {
                   e.stopPropagation();
                   if (navigator.share) {
                     navigator.share({ title: 'بلاغ بلّغ', text: report.description, url: window.location.href });
                   }
                }} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-all">
                  <Share2 className="w-4 h-4" />
                </button>
                {isMine && !isResolved && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); if (window.confirm('حذف البلاغ؟')) reportService.deleteReport(report.id); }} 
                    className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isRatingOpen && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="pt-4 mt-2 border-t border-slate-50 flex flex-col gap-3">
              <p className="text-xs font-bold text-slate-700">أضف تعليقك وتقييمك لعمل الجهة الخدمية</p>
              <input 
                type="text" 
                placeholder="اكتب تعليقك هنا..." 
                value={ratingInput}
                onChange={(e) => setRatingInput(e.target.value)}
                className="text-sm p-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:border-brand-orange transition-colors"
              />
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => {
                    reportService.rateReport(report.id, { score: 5, comment: ratingInput });
                    setIsRatingOpen(false);
                  }} 
                  className="flex-1 bg-brand-orange text-white text-xs py-2.5 rounded-xl font-bold active:scale-95 transition-all"
                >
                  إرسال التقييم
                </button>
                <button 
                  onClick={() => setIsRatingOpen(false)} 
                  className="px-4 py-2.5 bg-slate-100 text-slate-500 text-xs rounded-xl font-bold"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {resolving && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="pt-4 mt-2 border-t border-slate-50 flex flex-col gap-3">
              <p className="text-xs font-bold text-slate-700">إرفاق صورة بعد المعالجة وتأكيد الحل</p>
              <div className="flex gap-2">
                <button 
                  onClick={() => {
                    onResolve(report.id, "https://images.unsplash.com/photo-1574686020524-192a543666b3?auto=format&fit=crop&q=80&w=400");
                    setResolving(false);
                  }} 
                  className="flex-1 bg-emerald-500 text-white text-xs py-2.5 rounded-xl font-bold active:scale-95 transition-all"
                >
                  حفظ وتوثيق الحل
                </button>
                <button 
                  onClick={() => setResolving(false)} 
                  className="px-4 py-2.5 bg-slate-100 text-slate-500 text-xs rounded-xl font-bold"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CreateReportModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [step, setStep] = useState(1);
  const [recording, setRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [voiceBase64, setVoiceBase64] = useState<string | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [transcription, setTranscription] = useState('');
  const [extractedLocation, setExtractedLocation] = useState('');
  const [aiData, setAiData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

// Insert inside CreateReportModal just before startRecording
  const recognitionRef = useRef<any>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          setVoiceBase64(reader.result as string);
        };
      };

      mediaRecorder.start();
      setRecording(true);

      // Start Speech Recognition
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.lang = 'ar-YE'; // Yemeni Arabic
        recognition.interimResults = true;
        recognition.continuous = true;
        
        recognition.onresult = (event: any) => {
          let finalTranscript = '';
          for (let i = 0; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript + ' ';
            }
          }
          if (finalTranscript) setDescription(prev => prev + finalTranscript);
        };
        
        recognition.start();
        recognitionRef.current = recognition;
      }
    } catch(err) {
      console.error("Error accessing mic: ", err);
      setRecording(true);
      setTimeout(() => stopRecording(), 2000);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch(e) {}
    }
    setRecording(false);
    setStep(2);
  };

  const handleCapture = () => {
    // Simulated photo capture
    setPhoto("https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?auto=format&fit=crop&q=80&w=800"); // Garbage photo
    setStep(2);
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const aiResponse = await classifyReport(description, voiceBase64 || undefined, photo || undefined);
      setAiData(aiResponse);
      setTranscription(aiResponse.transcription || '');
      setExtractedLocation(aiResponse.extractedLocation || '');
      setStep(3); // Move to review step
    } catch (error) {
      console.error(error);
      alert("حدث خطأ أثناء معالجة البلاغ. يرجى المحاولة لاحقاً.");
    } finally {
      setLoading(false);
    }
  };

  const handleFinalSubmit = async () => {
    setLoading(true);
    try {
      const newReport: Partial<Report> = {
        category: aiData?.category as ReportCategory || ReportCategory.OTHER,
        description: aiData?.summary || description || transcription || "بدون وصف",
        priority: aiData?.priority as ReportPriority || ReportPriority.MEDIUM,
        imageUrl: photo || undefined,
        voiceUrl: audioUrl || undefined,
        location: { 
          lat: 15.3694 + (Math.random()*0.02 - 0.01), 
          lng: 44.1910 + (Math.random()*0.02 - 0.01), 
          address: extractedLocation || 'صنعاء - الروضة' 
        },
        neighborhoodId: 'sanaa_rawda',
        status: ReportStatus.PENDING
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

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white w-full max-w-xl rounded-3xl overflow-hidden shadow-2xl flex flex-col"
      >
        <div className="flex justify-between items-center p-6 border-b border-[#F0F0F0]">
          <h2 className="text-xl font-bold text-[#1A1A1A]">صوتك يوصل... حيّك يتحسن</h2>
          <button onClick={onClose} className="text-[#B2BEC3] hover:text-[#2D3436]">
            <Plus className="w-6 h-6 rotate-45" />
          </button>
        </div>

        <div className="p-6">
          {step === 1 ? (
             <div className="flex flex-col gap-6">
                <p className="text-[#636E72] text-sm text-center">صوّر المشكلة أو سجّل رسالة صوتية وسنتولى الباقي.</p>
                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={recording ? stopRecording : startRecording}
                    className={`flex flex-col items-center justify-center gap-4 p-8 rounded-3xl border-2 border-dashed transition-all ${recording ? 'bg-[#FFF3EE] border-[#FF6321] pulse-anim' : 'bg-[#FFF3EE] border-[#FF6321] hover:bg-[#FFE0D3]'}`}
                  >
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center text-white shadow-md ${recording ? 'bg-red-500 animate-pulse' : 'bg-[#FF6321]'}`}>
                      {recording ? <Square className="w-6 h-6 fill-current" /> : <Mic className="w-8 h-8" />}
                    </div>
                    <span className={`font-bold ${recording ? 'text-red-500' : 'text-[#FF6321]'}`}>
                      {recording ? 'إيقاف التسجيل' : 'تسجيل بلاغ صوتي'}
                    </span>
                  </button>
                  
                  <button onClick={handleCapture} className="flex flex-col items-center justify-center gap-4 p-8 rounded-3xl bg-[#E8F5E9] border-2 border-dashed border-[#2ECC71] hover:bg-[#C8E6C9] transition-all">
                    <div className="w-16 h-16 bg-[#2ECC71] rounded-full flex items-center justify-center text-white shadow-md">
                      <Camera className="w-8 h-8" />
                    </div>
                    <span className="font-bold text-[#2ECC71]">التقاط صورة</span>
                  </button>
                </div>
             </div>
          ) : (
            <div className="space-y-4">
              {photo && (
                <div className="relative h-40 rounded-xl overflow-hidden bg-gray-100">
                  <img src={photo} alt="" className="w-full h-full object-cover" />
                </div>
              )}
              {audioUrl && (
                <div className="bg-[#FAFAFA] border border-[#F0F0F0] rounded-xl p-4 flex items-center gap-4">
                  <button className="w-10 h-10 bg-[#FF6321] rounded-full flex items-center justify-center text-white">
                    <Play className="w-5 h-5 ml-1 fill-current" />
                  </button>
                  <div className="flex-1">
                    <div className="h-2 w-full bg-[#DFE6E9] rounded-full overflow-hidden">
                       <div className="h-full bg-[#FF6321] w-1/3"></div>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-[#636E72]">0:12</span>
                </div>
              )}
              
              <textarea 
                placeholder="تفاصيل إضافية (اختياري)... يمكن لـ AI كتابة ذلك عنك بناءً على الصوت/الصورة."
                className="w-full p-4 bg-[#F8F9FA] rounded-xl border border-[#E0E0E0] focus:border-[#FF6321] focus:ring-1 focus:ring-[#FF6321] outline-none text-sm text-[#2D3436] placeholder:text-[#B2BEC3] resize-none h-24"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />

              <button 
                onClick={handleSubmit} disabled={loading}
                className="w-full bg-[#FF6321] text-white py-4 rounded-xl font-bold text-lg hover:bg-[#E55A1F] transition-all flex items-center justify-center"
              >
                {loading ? <Activity className="w-6 h-6 animate-spin" /> : 'اعتماد البلاغ وإرساله'}
              </button>
            </div>
          )}
          {step === 3 && (
             <div className="flex flex-col gap-4">
                <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 mb-2">
                  <h4 className="font-bold text-blue-700 text-sm mb-2 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4" /> تم التعرف على البلاغ آلياً
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <p className="text-[10px] text-blue-500 font-bold uppercase">التقرير الصوتي</p>
                      <p className="text-sm text-blue-900 leading-relaxed">"{transcription || description}"</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white p-2 rounded-xl border border-blue-100">
                        <p className="text-[10px] text-blue-500 font-bold uppercase">الفئة</p>
                        <p className="text-xs font-bold text-blue-900">{aiData?.category}</p>
                      </div>
                      <div className="bg-white p-2 rounded-xl border border-blue-100">
                        <p className="text-[10px] text-blue-500 font-bold uppercase">الأولوية</p>
                        <p className="text-xs font-bold text-blue-900">{aiData?.priority}</p>
                      </div>
                    </div>
                    {extractedLocation && (
                      <div className="bg-white p-2 rounded-xl border border-blue-100">
                        <p className="text-[10px] text-blue-500 font-bold uppercase">الموقع المذكور</p>
                        <p className="text-xs font-bold text-blue-900">{extractedLocation}</p>
                      </div>
                    )}
                  </div>
                </div>

                <button 
                  onClick={handleFinalSubmit}
                  disabled={loading}
                  className="w-full bg-[#FF6321] text-white py-4 rounded-2xl font-bold text-lg shadow-lg shadow-[#FF6321]/20 hover:scale-[1.02] transition-all disabled:opacity-50"
                >
                  {loading ? 'جاري الإرسال...' : 'تأكيد وإرسال البلاغ'}
                </button>
                <button onClick={() => setStep(2)} className="text-sm text-gray-500 font-bold">تعديل البلاغ</button>
             </div>
          )}

          <div className="mt-8 pt-6 border-t border-[#F0F0F0] text-center">
             <p className="text-[#636E72] text-[10px] mb-4">يمكنك أيضاً البلاغ عبر القنوات البديلة (قريباً):</p>
             <div className="flex justify-center gap-4">
                <div className="flex flex-col items-center gap-1 opacity-50 grayscale hover:grayscale-0 hover:opacity-100 transition-all cursor-help" title="خدمة قادمة">
                  <div className="w-8 h-8 bg-[#25D366] rounded-full flex items-center justify-center text-white">
                    <MessageSquare className="w-4 h-4 fill-current" />
                  </div>
                  <span className="text-[9px] font-bold">واتساب</span>
                </div>
                <div className="flex flex-col items-center gap-1 opacity-50 grayscale">
                  <div className="w-8 h-8 bg-[#3498DB] rounded-full flex items-center justify-center text-white font-bold text-xs">SMS</div>
                  <span className="text-[9px] font-bold">رسائل نصية</span>
                </div>
                <div className="flex flex-col items-center gap-1 opacity-50 grayscale">
                  <div className="w-8 h-8 bg-[#9B59B6] rounded-full flex items-center justify-center text-white font-bold text-xs">*USSD</div>
                  <span className="text-[9px] font-bold">أكواد الاتصال</span>
                </div>
             </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// --- Views ---

function MapView({ reports }: { reports: Report[] }) {
  const position: [number, number] = [15.3694, 44.1910];

  const createCustomIcon = (status: ReportStatus) => {
    let color = '#ef4444'; // Red for Pending
    if (status === ReportStatus.IN_PROGRESS) color = '#f59e0b'; // Yellow/Orange
    if (status === ReportStatus.RESOLVED) color = '#22c55e'; // Green
    if (status === ReportStatus.ACKNOWLEDGED) color = '#3b82f6'; // Blue

    return L.divIcon({
      className: 'custom-div-icon',
      html: `<div style="background-color: ${color}; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.2);"></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7]
    });
  };

  return (
    <div className="bg-white rounded-3xl p-4 shadow-sm border border-[#E0E0E0] h-[600px] flex flex-col relative z-0">
      <div className="flex justify-between items-center mb-4 px-2">
        <h3 className="font-bold text-lg text-[#1A1A1A]">خريطة البلاغات في الحي</h3>
        <div className="flex gap-4 text-[10px] sm:text-xs font-medium text-[#636E72]">
          <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-red-500"></div> أحمر: مفتوح</span>
          <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-yellow-500"></div> أصفر: قيد العمل</span>
          <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-green-500"></div> أخضر: تم الحل</span>
        </div>
      </div>
      <div className="flex-1 rounded-2xl overflow-hidden relative z-0 border border-[#E0E0E0]">
        <MapContainer center={position} zoom={13} className="w-full h-full z-0">
          <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
          <MarkerClusterGroup chunkedLoading>
            {reports.map(r => (
              <Marker key={r.id} position={[r.location.lat, r.location.lng]} icon={createCustomIcon(r.status)}>
                <Popup className="font-sans" dir="rtl">
                  <div className="text-right p-1">
                    <div className="flex justify-between items-center mb-2">
                       <h4 className="font-bold text-[#FF6321] text-sm">{r.category}</h4>
                       <span className="text-[10px] text-gray-500">{r.status}</span>
                    </div>
                    <p className="text-xs text-[#2D3436] mb-2">{r.description}</p>
                    {r.imageUrl && <img src={r.imageUrl} className="w-full h-20 object-cover rounded-lg mb-2" />}
                    <div className="flex justify-between items-center text-[9px] text-gray-400">
                      <span>{r.location.address}</span>
                      <span className="font-bold text-orange-500">{r.supportCount} تأييد</span>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MarkerClusterGroup>
        </MapContainer>
      </div>
    </div>
  );
}

function NewsView({ onSelect }: { onSelect: (n: NewsItem) => void }) {
  const [filter, setFilter] = useState('all');

  const news: NewsItem[] = [
    { 
      id: '1',
      title: "حملة تنظيف كبرى في حي الروضة", 
      date: "منذ ساعتين", 
      type: "مشروع حي", 
      category: "project", 
      img: "https://images.unsplash.com/photo-1532996122724-e3c354a0b15f?auto=format&fit=crop&q=80&w=400",
      content: "بدأت اليوم حملة تنظيف واسعة النطاق في حي الروضة بمشاركة العشرات من المتطوعين من أهالي الحي وبالتنسيق مع صندوق النظافة والتحسين. تهدف الحملة إلى إزالة المخلفات المتراكمة في الشوارع الفرعية وتوعية السكان بأهمية الحفاظ على المظهر الجمالي للحي. وتأتي هذه الخطوة استجابة لعدة بلاغات تم تقديمها عبر منصة 'بلّغ'.",
      author: "لجنة حي الروضة",
      stats: { views: 450, hearts: 85 }
    },
    { 
      id: '2',
      title: "إصلاح خط المياه الرئيسي بالستين", 
      date: "أمس", 
      type: "قصة نجاح 'بلّغ'", 
      category: "success", 
      img: "https://images.unsplash.com/photo-1541888086925-920a0b63f538?auto=format&fit=crop&q=80&w=400",
      content: "أنهت الفرق الفنية بمؤسسة المياه إصلاح الكسر المفاجئ في الخط الرئيسي بشارع الستين بعد 48 ساعة من الإبلاغ عنه عبر المنصة. يذكر أن الكسر كان يتسبب في ضياع كميات كبيرة من المياه وتضرر الأسفلت في المنطقة المحيطة. نشكر سرعة استجابة الجهات المعنية وتفاعلهم مع صوت المواطن.",
      author: "مؤسسة المياه",
      stats: { views: 820, hearts: 120 }
    },
    { 
      id: '3',
      title: "مبادرة تشجير الشوارع الرئيسية", 
      date: "منذ 3 أيام", 
      type: "مبادرة", 
      category: "initiative", 
      img: "https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?auto=format&fit=crop&q=80&w=400",
      content: "بتمويل مجتمعي من خلال صندوق دعم الحي، تم البدء في مشروع تشجير الجزر الوسطية في الشوارع الرئيسية للحي. المرحلة الأولى تستهدف زراعة 200 شتلة من الأشجار المناسبة للمناخ المحلي. ندعو جميع السكان للمشاركة في العناية بهذه الأشجار لضمان نموها واستدامتها كجزء من المظهر الجمالي لمدينتنا.",
      author: "متطوعو الروضة",
      stats: { views: 310, hearts: 64 }
    }
  ];

  const filteredNews = filter === 'all' ? news : news.filter(n => n.category === filter);

  return (
    <div>
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        <button onClick={() => setFilter('all')} className={`px-4 py-1.5 rounded-full text-sm font-bold whitespace-nowrap ${filter === 'all' ? 'bg-[#FF6321] text-white' : 'bg-white border border-[#E0E0E0] text-[#636E72]'}`}>الكل</button>
        <button onClick={() => setFilter('project')} className={`px-4 py-1.5 rounded-full text-sm font-bold whitespace-nowrap ${filter === 'project' ? 'bg-[#FF6321] text-white' : 'bg-white border border-[#E0E0E0] text-[#636E72]'}`}>مشاريع</button>
        <button onClick={() => setFilter('success')} className={`px-4 py-1.5 rounded-full text-sm font-bold whitespace-nowrap ${filter === 'success' ? 'bg-[#FF6321] text-white' : 'bg-white border border-[#E0E0E0] text-[#636E72]'}`}>قصص نجاح</button>
        <button onClick={() => setFilter('initiative')} className={`px-4 py-1.5 rounded-full text-sm font-bold whitespace-nowrap ${filter === 'initiative' ? 'bg-[#FF6321] text-white' : 'bg-white border border-[#E0E0E0] text-[#636E72]'}`}>مبادرات</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredNews.map((item, i) => (
          <div 
            key={i} 
            onClick={() => onSelect(item)}
            className="bg-white rounded-3xl overflow-hidden shadow-sm border border-[#E0E0E0] group cursor-pointer hover:shadow-md transition-all"
          >
            <div className="h-48 overflow-hidden relative">
              <img src={item.img} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              <div className="absolute top-4 right-4 bg-white/90 backdrop-blur px-3 py-1 rounded-full text-xs font-bold text-[#FF6321]">{item.type}</div>
            </div>
            <div className="p-6">
              <h3 className="font-bold text-xl mb-2 text-[#1A1A1A]">{item.title}</h3>
              <p className="text-sm text-[#636E72] flex items-center gap-2">
                <Clock className="w-4 h-4" /> {item.date}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReportDetailsView({ report, onBack, onSupport, isAuthority, onResolve }: { report: Report; onBack: () => void; onSupport: (id: string) => void; isAuthority: boolean; onResolve: (id: string, img: string) => void }) {
  const statusColors = {
    [ReportStatus.PENDING]: 'bg-rose-50 text-rose-600 border-rose-100',
    [ReportStatus.ACKNOWLEDGED]: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    [ReportStatus.IN_PROGRESS]: 'bg-amber-50 text-amber-700 border-amber-100',
    [ReportStatus.RESOLVED]: 'bg-emerald-50 text-emerald-600 border-emerald-100'
  };

  const statusText = {
    [ReportStatus.PENDING]: 'جديد',
    [ReportStatus.ACKNOWLEDGED]: 'تم الاستلام',
    [ReportStatus.IN_PROGRESS]: 'جاري المعالجة',
    [ReportStatus.RESOLVED]: 'تم الحل'
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col gap-6">
      <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-bold transition-all w-fit">
        <ArrowRight className="w-5 h-5" /> عودة للقائمة
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="bg-white rounded-[2.5rem] overflow-hidden border border-slate-100 shadow-xl shadow-slate-200/40">
            <div className="h-[300px] sm:h-[400px] bg-slate-100 relative">
              {report.imageUrl ? (
                <img src={report.imageUrl} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-slate-300">
                  <ImageIcon className="w-20 h-20 mb-2" />
                  <span className="font-bold">بدون صورة مرفقة</span>
                </div>
              )}
              <div className="absolute top-6 right-6">
                <span className={cn("px-4 py-2 rounded-xl text-xs font-black border shadow-lg backdrop-blur-md", statusColors[report.status])}>
                  {statusText[report.status]}
                </span>
              </div>
            </div>

            <div className="p-8 md:p-10">
              <div className="flex flex-wrap items-center gap-3 mb-6">
                <span className="bg-brand-orange/10 text-brand-orange px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider">
                  {report.category}
                </span>
                <span className={cn(
                  "px-4 py-1.5 rounded-full text-xs font-black text-white",
                  report.priority === ReportPriority.CRITICAL ? "bg-rose-500" : 
                  report.priority === ReportPriority.HIGH ? "bg-brand-orange" : "bg-slate-400"
                )}>
                  أولوية {report.priority}
                </span>
              </div>

              <h1 className="text-3xl font-black text-slate-900 mb-6 leading-tight">
                {report.description}
              </h1>

              {report.voiceUrl && (
                <div className="mb-8 p-6 bg-slate-50 rounded-3xl border border-slate-100 flex items-center gap-6">
                  <button className="w-14 h-14 bg-brand-orange text-white rounded-full flex items-center justify-center shadow-lg shadow-brand-orange/30 hover:scale-105 transition-transform">
                    <Play className="w-6 h-6 ml-1 fill-current" />
                  </button>
                  <div className="flex-1">
                    <div className="flex justify-between text-xs font-bold text-slate-500 mb-2">
                       <span>التسجيل الصوتي للبلاغ</span>
                       <span>0:24</span>
                    </div>
                    <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                       <div className="h-full bg-brand-orange w-1/3"></div>
                    </div>
                  </div>
                </div>
              )}

              {report.status === ReportStatus.RESOLVED && report.resolvedImageUrl && (
                <div className="mt-8 p-10 bg-emerald-50 rounded-[2.5rem] border border-emerald-100 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-bl-full"></div>
                  <h3 className="text-2xl font-black text-emerald-900 mb-6 flex items-center gap-3">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                    تم إنجاز المهمة بنجاح
                  </h3>
                  <div className="aspect-video w-full rounded-2xl overflow-hidden shadow-lg border-4 border-white mb-6">
                     <img src={report.resolvedImageUrl} className="w-full h-full object-cover" />
                  </div>
                  <p className="text-emerald-700 font-bold leading-relaxed">
                    تمت معالجة المشكلة المذكورة في البلاغ من قبل الفرق الميدانية وتوثيق الحل بالصورة أعلاه. شكراً لمساهمتك في تحسين حيك.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-8">
          <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-xl shadow-slate-200/40">
             <h3 className="font-black text-xl text-slate-900 mb-6 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-brand-orange" />
                الموقع الجغرافي
             </h3>
             <div className="h-48 rounded-2xl overflow-hidden border border-slate-200 mb-4">
                <MapContainer center={[report.location.lat, report.location.lng]} zoom={15} className="w-full h-full z-0">
                  <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
                  <Marker position={[report.location.lat, report.location.lng]} />
                </MapContainer>
             </div>
             <p className="text-sm font-bold text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-100">
                {report.location.address || "العنوان غير محدد بدقة"}
             </p>
          </div>

          <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-xl shadow-slate-200/40">
             <h3 className="font-black text-xl text-slate-900 mb-6 flex items-center gap-2">
                <Activity className="w-5 h-5 text-brand-orange" />
                التفاعل المجتمعي
             </h3>
             <div className="flex flex-col gap-6">
                <div className="flex items-center justify-between p-4 bg-brand-orange/5 rounded-2xl border border-brand-orange/10">
                   <div className="flex flex-col">
                      <span className="text-2xl font-black text-brand-orange">{report.supportCount || 0}</span>
                      <span className="text-[10px] font-bold text-brand-orange/70">أصوات مؤيدة</span>
                   </div>
                   <button 
                     onClick={() => onSupport(report.id)}
                     className="bg-brand-orange text-white px-6 py-3 rounded-xl font-black text-sm shadow-lg shadow-brand-orange/20 hover:scale-105 active:scale-95 transition-all"
                   >
                     أنا أيضاً أعاني
                   </button>
                </div>

                <div className="space-y-4">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">التاريخ الزمني للبلاغ</p>
                   <div className="relative pl-6 space-y-6 before:content-[''] before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
                      <div className="relative flex gap-4">
                         <div className="absolute -left-[23px] w-3 h-3 rounded-full bg-brand-orange ring-4 ring-white"></div>
                         <div className="flex flex-col">
                            <span className="text-xs font-black text-slate-900">تم إنشاء البلاغ</span>
                            <span className="text-[10px] font-bold text-slate-400">{report.createdAt?.seconds ? new Date(report.createdAt.seconds * 1000).toLocaleString('ar-SA') : 'الآن'}</span>
                         </div>
                      </div>
                      {report.status !== ReportStatus.PENDING && (
                        <div className="relative flex gap-4">
                           <div className="absolute -left-[23px] w-3 h-3 rounded-full bg-brand-orange ring-4 ring-white"></div>
                           <div className="flex flex-col">
                              <span className="text-xs font-black text-slate-900">تم استلام البلاغ من الجهات المختصة</span>
                              <span className="text-[10px] font-bold text-slate-400">منذ يومين</span>
                           </div>
                        </div>
                      )}
                      {report.status === ReportStatus.RESOLVED && (
                        <div className="relative flex gap-4">
                           <div className="absolute -left-[23px] w-3 h-3 rounded-full bg-emerald-500 ring-4 ring-white"></div>
                           <div className="flex flex-col">
                              <span className="text-xs font-black text-emerald-600">تم إغلاق البلاغ بنجاح</span>
                              <span className="text-[10px] font-bold text-slate-400">اليوم</span>
                           </div>
                        </div>
                      )}
                   </div>
                </div>
             </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function NewsDetailsView({ news, onBack }: { news: NewsItem; onBack: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} className="max-w-4xl mx-auto flex flex-col gap-8">
      <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-bold transition-all w-fit">
        <ArrowRight className="w-5 h-5" /> عودة للأخبار
      </button>

      <div className="bg-white rounded-[3rem] overflow-hidden border border-slate-100 shadow-2xl shadow-slate-200/50">
        <div className="h-[400px] relative">
          <img src={news.img} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
          <div className="absolute bottom-10 inset-x-10">
             <span className="bg-brand-orange px-4 py-1.5 rounded-full text-white text-[10px] font-black uppercase tracking-widest mb-4 inline-block">
                {news.type}
             </span>
             <h1 className="text-4xl font-black text-white leading-tight">
                {news.title}
             </h1>
          </div>
        </div>

        <div className="p-10 md:p-14">
          <div className="flex items-center justify-between mb-10 pb-8 border-b border-slate-50">
             <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-brand-orange/10 flex items-center justify-center text-brand-orange">
                   <UserIcon className="w-6 h-6" />
                </div>
                <div className="flex flex-col">
                   <span className="text-sm font-black text-slate-900">{news.author}</span>
                   <span className="text-xs font-bold text-slate-400">ناشر الخبر</span>
                </div>
             </div>
             <div className="flex items-center gap-8">
                <div className="flex flex-col items-center">
                   <Calendar className="w-5 h-5 text-slate-300 mb-1" />
                   <span className="text-[10px] font-black text-slate-500">{news.date}</span>
                </div>
                <div className="flex flex-col items-center">
                   <Eye className="w-5 h-5 text-slate-300 mb-1" />
                   <span className="text-[10px] font-black text-slate-500">{news.stats?.views} مشاهدة</span>
                </div>
                <div className="flex flex-col items-center">
                   <Heart className="w-5 h-5 text-slate-300 mb-1" />
                   <span className="text-[10px] font-black text-slate-500">{news.stats?.hearts} إعجاب</span>
                </div>
             </div>
          </div>

          <div className="prose prose-slate max-w-none">
             <p className="text-xl text-slate-700 leading-relaxed font-medium mb-8">
                {news.content}
             </p>
             <p className="text-lg text-slate-600 leading-relaxed">
                هذا الخبر يعكس الجهود المستمرة لتحسين جودة الحياة في أحيائنا. نحن نشجع الجميع على الاستمرار في استخدام منصة "بلّغ" لإيصال أصواتهم والمساهمة في رصد المشاكل واقتراح الحلول.
             </p>
          </div>

          <div className="mt-14 pt-10 border-t border-slate-50 flex flex-wrap items-center justify-between gap-6">
             <div className="flex items-center gap-2">
                <button className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-brand-orange text-white font-black text-sm shadow-lg shadow-brand-orange/20 hover:scale-105 active:scale-95 transition-all">
                   <Heart className="w-5 h-5" /> دعم الخبر
                </button>
                <button className="w-12 h-12 rounded-2xl border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 transition-all">
                   <Share2 className="w-5 h-5" />
                </button>
             </div>
             
             <div className="flex items-center gap-4">
                <span className="text-xs font-bold text-slate-400">هل كان هذا الخبر مفيداً؟</span>
                <div className="flex gap-2">
                   <button className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">نعم</button>
                   <button className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center font-bold">لا</button>
                </div>
             </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function SupportView() {
  return (
    <div className="bg-white rounded-3xl p-8 shadow-sm border border-[#E0E0E0] max-w-3xl mx-auto">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-[#FF6321]/10 text-[#FF6321] rounded-full flex items-center justify-center mx-auto mb-4">
          <Heart className="w-8 h-8 fill-current" />
        </div>
        <h2 className="text-2xl font-bold text-[#1A1A1A] mb-2">الدعم المالي المجتمعي</h2>
        <p className="text-[#636E72]">ساهم بمبلغ بسيط لاستئجار معدات وصيانة الأعطال التي تتأخر البلدية في حلها. كل ريال يساهم في بناء حي أفضل.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 text-center border-y border-[#F0F0F0] py-6">
         <div>
            <p className="text-[#636E72] text-sm mb-1">المبلغ المجموع (هذا الشهر)</p>
            <p className="text-3xl font-black text-[#2ECC71]">12,500 <span className="text-lg">ريال</span></p>
         </div>
         <div className="border-x border-[#F0F0F0]">
            <p className="text-[#636E72] text-sm mb-1">تم إصلاح</p>
            <p className="text-3xl font-black text-[#1A1A1A]">14 <span className="text-lg">بلاغ</span></p>
         </div>
         <div>
            <p className="text-[#636E72] text-sm mb-1">الدعم المستمر (اشتراكات)</p>
            <p className="text-3xl font-black text-[#FF6321]">42 <span className="text-lg">شخص</span></p>
         </div>
      </div>

      <div className="space-y-6">
        <div>
           <div className="flex justify-between text-sm font-bold text-[#1A1A1A] mb-2">
             <span>مشروع إصلاح إنارة شارع الستين</span>
             <span>35,000 / 50,000 ريال</span>
           </div>
           <div className="h-4 w-full bg-[#DFE6E9] rounded-full overflow-hidden">
             <div className="h-full bg-[#2ECC71] w-[70%]"></div>
           </div>
        </div>
        
        <div>
           <div className="flex justify-between text-sm font-bold text-[#1A1A1A] mb-2">
             <span>صندوق الطوارئ (شفط مياه الأمطار)</span>
             <span>12,000 / 100,000 ريال</span>
           </div>
           <div className="h-4 w-full bg-[#DFE6E9] rounded-full overflow-hidden">
             <div className="h-full bg-[#FF6321] w-[12%]"></div>
           </div>
        </div>

        <h3 className="font-bold border-t border-[#F0F0F0] pt-6 mt-4">استقطاع شهري لحماية الحي:</h3>
        <div className="flex gap-4">
          {[500, 1000, 2000].map(amt => (
            <button key={amt} className="flex-1 py-4 rounded-xl border-2 border-[#E0E0E0] hover:border-[#FF6321] hover:bg-[#FF6321]/5 text-[#1A1A1A] font-bold text-lg transition-all focus:border-[#FF6321] focus:ring-1 focus:ring-[#FF6321]">
              {amt} ريال
            </button>
          ))}
        </div>
        <button className="w-full bg-[#FF6321] text-white py-4 rounded-xl font-bold text-lg hover:bg-[#E55A1F] transition-all shadow-md shadow-[#FF6321]/20 mt-4">
          تفعيل الدعم التلقائي
        </button>
      </div>
    </div>
  );
}

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('home');

  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null);

  // Filters
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        const userDoc = doc(db, 'users', u.uid);
        const snap = await getDoc(userDoc);
        let pData;
        if (!snap.exists()) {
          pData = {
            uid: u.uid,
            displayName: u.displayName || 'مستخدم',
            photoURL: u.photoURL || '',
            role: 'citizen',
            createdAt: new Date().toISOString()
          };
          await setDoc(userDoc, pData);
          setProfile(pData as UserProfile);
        } else {
          setProfile(snap.data() as UserProfile);
        }
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (user) {
      return reportService.subscribeToReports(setReports);
    }
  }, [user]);

  const handleResolve = async (reportId: string, resolvedImageUrl: string) => {
    try {
      const ref = doc(db, 'reports', reportId);
      const rSnap = await getDoc(ref);

      await updateDoc(ref, {
        status: ReportStatus.RESOLVED,
        resolvedImageUrl,
        updatedAt: serverTimestamp()
      });

      // Gamification: Award 50 points to the user who created the report
      if (rSnap.exists()) {
        const reporterId = rSnap.data().userId;
        if (reporterId) {
          const userRef = doc(db, 'users', reporterId);
          await updateDoc(userRef, {
            points: increment(50),
            tier: 'بطل مجتمعي'
          });
          
          if (reporterId === user.uid && profile) {
             setProfile({ ...profile, points: (profile.points || 0) + 50, tier: 'بطل مجتمعي' });
          }
        }
      }
    } catch(e) { console.error(e); }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F4F7F6] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#FF6321]/20 border-t-[#FF6321] rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#F4F7F6] font-sans text-[#2D3436] flex flex-col items-center justify-center p-6 text-center" dir="rtl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-md w-full bg-white p-10 rounded-3xl shadow-xl border border-[#E0E0E0] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#FF6321] rounded-bl-[100px] opacity-10 blur-2xl"></div>
          
          <div className="w-20 h-20 bg-[#FF6321] rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-lg shadow-[#FF6321]/30 rotate-12 relative z-10">
            <Bell className="w-10 h-10 text-white -rotate-12" />
          </div>
          <h1 className="text-3xl font-black mb-3 text-[#1A1A1A]">صوتك يوصل…</h1>
          <p className="text-[#636E72] mb-10 text-base leading-relaxed">
            منصة "بلّغ" المجتمعية تتيح لك الإبلاغ عن مشاكل حيك بالصورة والصوت وبدون تعقيد.
          </p>
          
          <button 
            onClick={() => signInWithPopup(auth, new GoogleAuthProvider())}
            className="w-full bg-[#FF6321] text-white py-4 rounded-xl font-bold text-lg hover:bg-[#E55A1F] transition-all shadow-md shadow-[#FF6321]/20 mb-4 flex items-center justify-center gap-2"
          >
            دخول بواسطة Google
          </button>
        </motion.div>
      </div>
    );
  }

  const isAuthority = profile?.role === 'authority';

  const filteredReports = reports.filter(r => {
    let match = true;
    if (filterCategory !== 'all' && r.category !== filterCategory) match = false;
    if (filterStatus !== 'all' && r.status !== filterStatus) match = false;
    if (filterPriority !== 'all' && r.priority !== filterPriority) match = false;
    return match;
  });

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-brand-orange/10 transition-colors duration-300" dir="rtl">
      <Header user={user} profile={profile} onSignOut={() => signOut(auth)} currentTab={tab} setTab={(t) => { setTab(t); setSelectedReport(null); setSelectedNews(null); }} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 pb-32">
        <AnimatePresence mode="wait">
          {tab === 'home' && (
            <motion.div key="home" initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} exit={{opacity:0}}>
              {selectedReport ? (
                <ReportDetailsView 
                  report={selectedReport} 
                  onBack={() => setSelectedReport(null)}
                  onSupport={(id) => { reportService.supportReport(id).catch(console.error); }}
                  isAuthority={isAuthority}
                  onResolve={handleResolve}
                />
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                  
                  <div className="lg:col-span-7 flex flex-col gap-6">
                    {/* Reporting Area */}
                    <div className="bg-white rounded-[2.5rem] p-8 md:p-10 shadow-xl shadow-slate-200/50 border border-slate-100 flex flex-col gap-6 relative overflow-hidden group">
                      <div className="absolute -right-20 -top-20 w-64 h-64 bg-brand-orange/5 rounded-full blur-3xl group-hover:bg-brand-orange/10 transition-colors duration-500"></div>
                      <div className="relative z-10">
                        <h2 className="text-2xl font-extrabold text-slate-900 mb-3 tracking-tight">صوتك يوصل... حيّك يتحسن</h2>
                        <p className="text-slate-500 text-base leading-relaxed max-w-md">
                          لديك مشكلة في الحي؟ التقط صورة أو سجل صوتك وسنتولى الباقي باستخدام تقنيات الذكاء الاصطناعي.
                        </p>
                      </div>
                      <button 
                        onClick={() => setShowModal(true)}
                        className="relative z-10 w-full py-6 border-2 border-dashed border-brand-orange/30 bg-brand-orange/5 text-brand-orange hover:bg-brand-orange/10 hover:border-brand-orange/50 rounded-[2rem] font-black text-xl flex items-center justify-center gap-4 transition-all duration-300 transform hover:scale-[1.01] active:scale-[0.99]"
                      >
                        <Plus className="w-8 h-8 p-1.5 border-2 border-current rounded-full" />
                        إنشاء بلاغ جديد
                      </button>
                    </div>
                    
                    {/* Embedded Map */}
                    <div className="hidden lg:block relative z-0">
                      <MapView reports={filteredReports} />
                    </div>
                  </div>

                  <div className="lg:col-span-5 bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 flex flex-col overflow-hidden max-h-[800px]">
                    <div className="p-6 border-b border-slate-100 bg-white/80 backdrop-blur-md sticky top-0 z-10">
                      <h3 className="font-extrabold text-xl text-slate-900 mb-4 tracking-tight text-right">آخر البلاغات بمنطقتك</h3>
                      <div className="flex gap-2 pb-1 overflow-x-auto no-scrollbar">
                        <select 
                          className="text-[11px] font-bold bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 outline-none text-slate-600 focus:border-brand-orange/30 transition-colors cursor-pointer appearance-none" 
                          value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}
                        >
                          <option value="all">كل الفئات</option>
                          {Object.values(ReportCategory).map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <select 
                          className="text-[11px] font-bold bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 outline-none text-slate-600 focus:border-brand-orange/30 transition-colors cursor-pointer appearance-none"
                          value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
                        >
                          <option value="all">كل الحالات</option>
                          {Object.values(ReportStatus).map(s => <option key={s} value={s}>{s === ReportStatus.PENDING ? 'مفتوح' : s === ReportStatus.RESOLVED ? 'تمت المعالجة' : s}</option>)}
                        </select>
                      </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5 bg-slate-50/30">
                      {filteredReports.length === 0 ? (
                        <p className="text-center text-[#B2BEC3] py-10">لا توجد بلاغات تطابق البحث...</p>
                      ) : (
                        filteredReports.map(report => (
                          <ReportCard 
                            key={report.id} 
                            report={report as Report} 
                            onSupport={(id) => { reportService.supportReport(id).catch(console.error); }} 
                            isAuthority={isAuthority}
                            onResolve={handleResolve}
                            onClick={setSelectedReport}
                          />
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {tab === 'map' && (
            <motion.div key="map" initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} exit={{opacity:0}}>
              {selectedReport ? (
                 <ReportDetailsView 
                   report={selectedReport} 
                   onBack={() => setSelectedReport(null)}
                   onSupport={(id) => { reportService.supportReport(id).catch(console.error); }}
                   isAuthority={isAuthority}
                   onResolve={handleResolve}
                 />
              ) : (
                <>
                  <div className="flex gap-2 mb-4">
                    <select 
                      className="text-sm bg-white border border-[#E0E0E0] rounded-xl px-4 py-2 outline-none text-[#2D3436]" 
                      value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}
                    >
                      <option value="all">كل الفئات</option>
                      {Object.values(ReportCategory).map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <select 
                      className="text-sm bg-white border border-[#E0E0E0] rounded-xl px-4 py-2 outline-none text-[#2D3436]"
                      value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
                    >
                      <option value="all">كل الحالات</option>
                      {Object.values(ReportStatus).map(s => <option key={s} value={s}>{s === ReportStatus.PENDING ? 'مفتوح' : s === ReportStatus.RESOLVED ? 'تمت المعالجة' : s}</option>)}
                    </select>
                  </div>
                  <MapView reports={filteredReports} />
                </>
              )}
            </motion.div>
          )}

          {tab === 'news' && (
            <motion.div key="news" initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} exit={{opacity:0}}>
              {selectedNews ? (
                <NewsDetailsView news={selectedNews} onBack={() => setSelectedNews(null)} />
              ) : (
                <>
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold text-[#1A1A1A]">أخبار وتحديثات المشاريع</h2>
                    <p className="text-[#636E72] mt-1">تابع إنجازات حيك ومبادرات البلدية والمجتمع.</p>
                  </div>
                  <NewsView onSelect={setSelectedNews} />
                </>
              )}
            </motion.div>
          )}

          {tab === 'support' && (
            <motion.div key="support" initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} exit={{opacity:0}}>
              <SupportView />
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      {/* Mobile Sticky Nav */}
      <nav className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-lg px-6 py-3 rounded-2xl flex gap-10 shadow-2xl shadow-slate-200/50 border border-slate-200/60 z-50">
        {[
          { id: 'home', icon: <Activity className="w-6 h-6" />, label: 'الرئيسية' },
          { id: 'map', icon: <MapIcon className="w-6 h-6" />, label: 'الخريطة' },
          { id: 'support', icon: <Heart className="w-6 h-6" />, label: 'الدعم' }
        ].map(item => (
          <button 
            key={item.id} 
            onClick={() => setTab(item.id)}
            className={cn(
              "flex flex-col items-center gap-1 transition-all duration-300",
              tab === item.id ? "text-brand-orange scale-110" : "text-slate-400 hover:text-slate-600"
            )}
          >
            {item.icon}
            <span className="text-[10px] font-bold tracking-tight">{item.label}</span>
          </button>
        ))}
      </nav>

      <AnimatePresence>
        {showModal && (
          <CreateReportModal onClose={() => setShowModal(false)} onCreated={() => {}} />
        )}
      </AnimatePresence>
      <style dangerouslySetInnerHTML={{__html: `
        .leaflet-container { font-family: 'Inter', sans-serif !important; z-index: 10 !important; }
      `}} />
    </div>
  );
}
