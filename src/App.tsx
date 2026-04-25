import { useState, useEffect, useRef } from 'react';
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
  Star
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db } from './lib/firebase.ts';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut 
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, increment } from 'firebase/firestore';
import { Report, UserProfile, ReportStatus, ReportPriority, ReportCategory } from './types.ts';
import { reportService } from './services/reportService.ts';
import { classifyReport } from './services/geminiService.ts';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix leaflet icons
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

L.Icon.Default.mergeOptions({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
});

// --- Components ---

function Header({ user, onSignOut, currentTab, setTab }: { user: any; onSignOut: () => void; currentTab: string, setTab: (t: string) => void }) {
  return (
    <nav className="bg-white border-b border-[#E0E0E0] px-4 md:px-8 py-4 flex flex-col md:flex-row justify-between items-center gap-4 sticky top-0 z-40">
      <div className="flex items-center w-full md:w-auto justify-between md:justify-start gap-6">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => setTab('home')}>
          <div className="w-10 h-10 bg-[#FF6321] rounded-xl flex items-center justify-center shadow-sm">
            <Bell className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1A1A1A]">بلّغ</h1>
        </div>
        
        {user && (
          <div className="hidden md:flex gap-6 text-sm font-medium text-[#636E72]">
            <button onClick={() => setTab('home')} className={`${currentTab === 'home' ? 'text-[#FF6321] border-b-2 border-[#FF6321]' : 'hover:text-[#2D3436]'} pb-1 transition-colors`}>الرئيسية</button>
            <button onClick={() => setTab('map')} className={`${currentTab === 'map' ? 'text-[#FF6321] border-b-2 border-[#FF6321]' : 'hover:text-[#2D3436]'} pb-1 transition-colors`}>خريطة المشاكل</button>
            <button onClick={() => setTab('news')} className={`${currentTab === 'news' ? 'text-[#FF6321] border-b-2 border-[#FF6321]' : 'hover:text-[#2D3436]'} pb-1 transition-colors`}>الأخبار</button>
            <button onClick={() => setTab('support')} className={`${currentTab === 'support' ? 'text-[#FF6321] border-b-2 border-[#FF6321]' : 'hover:text-[#2D3436]'} pb-1 transition-colors`}>الدعم المجتمعي</button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
        {user ? (
          <>
            <div className="bg-[#E1F5FE] text-[#0288D1] px-4 py-1.5 rounded-full text-xs font-bold hidden sm:block">
              حي الروضة: استجابة 92%
            </div>
            <div className="flex items-center gap-3">
              <button onClick={onSignOut} className="text-[#636E72] hover:text-[#FF6321]">
                <LogOut className="w-5 h-5" />
              </button>
              <img src={user.photoURL || ''} alt="" className="w-10 h-10 rounded-full border-2 border-white shadow-sm bg-[#DFE6E9]" />
            </div>
          </>
        ) : (
          <button 
            onClick={() => signInWithPopup(auth, new GoogleAuthProvider())}
            className="bg-[#FF6321] text-white px-5 py-2.5 rounded-full text-sm font-bold hover:bg-[#E55A1F] transition-all shadow-sm"
          >
            تسجيل الدخول
          </button>
        )}
      </div>
    </nav>
  );
}

function ReportCard({ report, onSupport, isAuthority, onResolve }: { report: Report; onSupport: (id: string) => void; isAuthority: boolean; onResolve: (id: string, img: string) => void }) {
  const [resolving, setResolving] = useState(false);
  const [rating, setRating] = useState(0);

  const statusColors = {
    [ReportStatus.PENDING]: 'bg-gray-100 text-gray-600',
    [ReportStatus.ACKNOWLEDGED]: 'bg-blue-50 text-blue-600',
    [ReportStatus.IN_PROGRESS]: 'bg-yellow-100 text-yellow-700',
    [ReportStatus.RESOLVED]: 'bg-[#E8F5E9] text-[#2ECC71]'
  };

  const statusText = {
    [ReportStatus.PENDING]: 'مفتوح',
    [ReportStatus.ACKNOWLEDGED]: 'تم الاستلام',
    [ReportStatus.IN_PROGRESS]: 'قيد العمل',
    [ReportStatus.RESOLVED]: 'تمت المعالجة'
  };

  const isResolved = report.status === ReportStatus.RESOLVED;

  // Rating UI for current user if it's their report
  const isMine = report.userId === auth.currentUser?.uid;

  const handleResolveSubmit = () => {
    // Mock image for now
    onResolve(report.id, "https://images.unsplash.com/photo-1574686020524-192a543666b3?auto=format&fit=crop&q=80&w=400");
    setResolving(false);
  };

  return (
    <div className={`p-5 rounded-2xl bg-[#FAFAFA] border border-[#F0F0F0] flex gap-4 transition-all hover:shadow-sm ${isResolved ? 'opacity-80' : ''}`}>
      <div className="w-20 h-20 bg-[#DFE6E9] rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center">
        {report.imageUrl ? (
          <img src={report.imageUrl} alt="Report" className="w-full h-full object-cover" />
        ) : (
          <ImageIcon className="w-8 h-8 text-[#BDC3C7]" />
        )}
      </div>
      
      <div className="flex-1 flex flex-col justify-between">
        <div>
          <div className="flex justify-between items-start mb-1">
            <span className="text-xs font-bold text-[#636E72] flex items-center gap-1">
              {report.priority === ReportPriority.CRITICAL && <AlertCircle className="w-3 h-3 text-red-500" />}
              {report.category}
            </span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${statusColors[report.status]}`}>
              {statusText[report.status]}
            </span>
          </div>
          <p className="text-sm font-bold text-[#2D3436] line-clamp-2 leading-relaxed">{report.description}</p>
        </div>
        
        {isResolved && report.resolvedImageUrl && (
          <div className="mt-2 mb-2 p-2 bg-[#E8F5E9] rounded-lg flex items-center gap-2">
            <img src={report.resolvedImageUrl} className="w-10 h-10 rounded object-cover" />
            <span className="text-xs font-bold text-[#2ECC71]">تمت المعالجة من قبل البلدية</span>
          </div>
        )}

        <div className="flex justify-between items-center mt-3">
          <div className="flex items-center gap-2 text-[10px] sm:text-xs text-[#B2BEC3] font-medium">
            <Clock className="w-3 h-3" />
            <span>{report.createdAt?.seconds ? new Date(report.createdAt.seconds * 1000).toLocaleDateString('ar-SA') : 'الآن'}</span>
          </div>
          <div className="flex gap-2">
            {!isResolved && (
              <button 
                onClick={() => onSupport(report.id)}
                className="flex items-center gap-1 text-[#FF6321] font-bold text-xs hover:bg-[#FF6321]/10 px-2 py-1 rounded transition-colors"
              >
                <ThumbsUp className="w-3 h-3" />
                {report.supportCount || 0} تأييد
              </button>
            )}
            
            {isAuthority && !isResolved && (
              <button 
                onClick={() => setResolving(true)}
                className="flex items-center gap-1 bg-[#2ECC71] text-white font-bold text-xs px-2 py-1 rounded hover:bg-[#27ae60] transition-colors"
              >
                <ShieldCheck className="w-3 h-3" /> إغلاق وتوثيق
              </button>
            )}
            
            {isResolved && isMine && (
               <button 
                onClick={() => alert("جاري تسجيل تقييمك الصوتي...")}
                className="flex items-center gap-1 bg-[#F4F7F6] text-[#FF6321] border border-[#FF6321]/20 font-bold text-xs px-2 py-1 rounded hover:bg-[#FF6321]/10 transition-colors"
               >
                 <Mic className="w-3 h-3" /> تقييم بالصوت
               </button>
            )}
          </div>
        </div>

        {resolving && (
          <div className="mt-3 p-3 bg-white border border-[#E0E0E0] rounded-xl flex flex-col gap-2">
            <p className="text-xs font-bold text-[#2D3436]">إرفاق صورة بعد المعالجة</p>
            <div className="flex gap-2">
              <button onClick={handleResolveSubmit} className="flex-1 bg-[#FF6321] text-white text-xs py-1.5 rounded-lg font-bold">حفظ</button>
              <button onClick={() => setResolving(false)} className="flex-1 bg-gray-100 text-gray-600 text-xs py-1.5 rounded-lg font-bold">إلغاء</button>
            </div>
          </div>
        )}
      </div>
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
      const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
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
      
      const newReport: Partial<Report> = {
        category: aiResponse.category as ReportCategory || ReportCategory.OTHER,
        description: aiResponse.summary || description || "بدون وصف",
        priority: aiResponse.priority as ReportPriority || ReportPriority.MEDIUM,
        imageUrl: photo || undefined,
        voiceUrl: audioUrl || undefined, // In real app, upload this to Storage first
        location: { lat: 15.3694 + (Math.random()*0.02 - 0.01), lng: 44.1910 + (Math.random()*0.02 - 0.01), address: 'صنعاء - الروضة' },
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
        </div>
      </motion.div>
    </div>
  );
}

// --- Views ---

function MapView({ reports }: { reports: Report[] }) {
  // Center roughly on Sanaa
  const position: [number, number] = [15.3694, 44.1910];

  const getMarkerColor = (status: ReportStatus) => {
    switch(status) {
      case ReportStatus.RESOLVED: return 120; // Green hue
      case ReportStatus.IN_PROGRESS: return 60; // Yellow hue
      default: return 0; // Red hue
    }
  };

  return (
    <div className="bg-white rounded-3xl p-4 shadow-sm border border-[#E0E0E0] h-[600px] flex flex-col relative z-0">
      <div className="flex justify-between items-center mb-4 px-2">
        <h3 className="font-bold text-lg text-[#1A1A1A]">خريطة البلاغات</h3>
        <div className="flex gap-4 text-xs font-medium text-[#636E72]">
          <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-red-500"></div> جديد/مفتوح</span>
          <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-yellow-500"></div> جاري العمل</span>
          <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-green-500"></div> تم الحل</span>
        </div>
      </div>
      <div className="flex-1 rounded-2xl overflow-hidden relative z-0 border border-[#E0E0E0]">
        <MapContainer center={position} zoom={13} className="w-full h-full z-0">
          <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
          {reports.map(r => (
            <Marker key={r.id} position={[r.location.lat, r.location.lng]}>
              <Popup className="font-sans" dir="rtl">
                <div className="text-right">
                  <h4 className="font-bold text-[#FF6321]">{r.category}</h4>
                  <p className="text-xs text-[#2D3436] mt-1">{r.description}</p>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}

function NewsView() {
  const news = [
    { title: "حملة تنظيف كبرى في حي الروضة", date: "منذ ساعتين", type: "مشروع حي", img: "https://images.unsplash.com/photo-1532996122724-e3c354a0b15f?auto=format&fit=crop&q=80&w=400" },
    { title: "إصلاح خط المياه الرئيسي بالستين", date: "أمس", type: "قصة نجاح 'بلّغ'", img: "https://images.unsplash.com/photo-1541888086925-920a0b63f538?auto=format&fit=crop&q=80&w=400" }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {news.map((item, i) => (
        <div key={i} className="bg-white rounded-3xl overflow-hidden shadow-sm border border-[#E0E0E0] group cursor-pointer hover:shadow-md transition-all">
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

      <div className="space-y-4">
        <h3 className="font-bold">استقطاع شهري لحماية الحي:</h3>
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
      await updateDoc(ref, {
        status: ReportStatus.RESOLVED,
        resolvedImageUrl,
        updatedAt: new Date()
      });
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

  return (
    <div className="min-h-screen bg-[#F4F7F6] font-sans text-[#2D3436]" dir="rtl">
      <Header user={user} onSignOut={() => signOut(auth)} currentTab={tab} setTab={setTab} />

      <main className="max-w-[1024px] mx-auto p-4 md:p-8 pb-32">
        <AnimatePresence mode="wait">
          {tab === 'home' && (
            <motion.div key="home" initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} exit={{opacity:0}}>
              {/* Main Dashboard Layout from Mockup */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                
                <div className="lg:col-span-7 flex flex-col gap-6">
                  {/* Reporting Area */}
                  <div className="bg-white rounded-3xl p-8 shadow-sm border border-[#E0E0E0] flex flex-col gap-6 relative overflow-hidden">
                    <div className="absolute -right-10 -top-10 w-40 h-40 bg-[#FF6321]/5 rounded-full blur-3xl"></div>
                    <div>
                      <h2 className="text-xl font-bold text-[#1A1A1A] mb-2">صوتك يوصل... حيّك يتحسن</h2>
                      <p className="text-[#636E72] text-sm">لديك مشكلة في الحي؟ اضغط أدناه وبلّغ.</p>
                    </div>
                    <button 
                      onClick={() => setShowModal(true)}
                      className="w-full py-5 border-2 border-dashed border-[#FF6321] bg-[#FF6321]/5 text-[#FF6321] hover:bg-[#FF6321]/10 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 transition-colors"
                    >
                      <Plus className="w-6 h-6 border-2 border-current rounded-full" />
                      إنشاء بلاغ جديد
                    </button>
                  </div>
                  
                  {/* Embedded Map */}
                  <div className="hidden lg:block relative z-0">
                    <MapView reports={reports} />
                  </div>
                </div>

                <div className="lg:col-span-5 bg-white rounded-3xl shadow-sm border border-[#E0E0E0] flex flex-col overflow-hidden max-h-[800px]">
                  <div className="p-6 border-b border-[#F0F0F0] flex justify-between items-center bg-white sticky top-0 z-10">
                    <h3 className="font-bold text-lg text-[#1A1A1A]">آخر البلاغات بمنطقتك</h3>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 bg-[#F4F7F6]/30">
                    {reports.length === 0 ? (
                      <p className="text-center text-[#B2BEC3] py-10">لا توجد بلاغات...</p>
                    ) : (
                      reports.map(report => (
                        <ReportCard 
                          key={report.id} 
                          report={report} 
                          onSupport={(id) => reportService.supportReport(id)} 
                          isAuthority={isAuthority}
                          onResolve={handleResolve}
                        />
                      ))
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {tab === 'map' && (
            <motion.div key="map" initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} exit={{opacity:0}}>
              <MapView reports={reports} />
            </motion.div>
          )}

          {tab === 'news' && (
            <motion.div key="news" initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} exit={{opacity:0}}>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-[#1A1A1A]">أخبار وتحديثات المشاريع</h2>
                <p className="text-[#636E72] mt-1">تابع إنجازات حيك ومبادرات البلدية والمجتمع.</p>
              </div>
              <NewsView />
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
      <nav className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 bg-white px-6 py-3 rounded-full flex gap-8 shadow-xl border border-[#E0E0E0] z-40">
        {[
          { id: 'home', icon: <Activity className="w-6 h-6" /> },
          { id: 'map', icon: <MapIcon className="w-6 h-6" /> },
          { id: 'support', icon: <Heart className="w-6 h-6" /> }
        ].map(item => (
          <button 
            key={item.id} 
            onClick={() => setTab(item.id)}
            className={`transition-colors ${tab === item.id ? 'text-[#FF6321] scale-110' : 'text-[#B2BEC3]'}`}
          >
            {item.icon}
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
