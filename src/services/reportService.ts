import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  serverTimestamp,
  increment,
  addDoc
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Report, ReportStatus, ReportCategory, ReportPriority } from '../types';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const reportService = {
  async createReport(data: Partial<Report>) {
    const reportsCol = collection(db, 'reports');
    try {
      const docRef = await addDoc(reportsCol, {
        ...data,
        userId: auth.currentUser?.uid,
        status: ReportStatus.PENDING,
        supportCount: 0,
        createdAt: serverTimestamp(),
      });
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'reports');
    }
  },

  async getReports(neighborhoodId?: string) {
    const reportsCol = collection(db, 'reports');
    let q = query(reportsCol, orderBy('createdAt', 'desc'));
    
    if (neighborhoodId) {
      q = query(reportsCol, where('neighborhoodId', '==', neighborhoodId), orderBy('createdAt', 'desc'));
    }

    try {
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Report));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'reports');
    }
  },

  subscribeToReports(callback: (reports: Report[]) => void, neighborhoodId?: string) {
    const reportsCol = collection(db, 'reports');
    let q = query(reportsCol, orderBy('createdAt', 'desc'));
    
    if (neighborhoodId) {
      q = query(reportsCol, where('neighborhoodId', '==', neighborhoodId), orderBy('createdAt', 'desc'));
    }

    return onSnapshot(q, (snapshot) => {
      const reports = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Report));
      callback(reports);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'reports');
    });
  },

  async supportReport(reportId: string) {
    const reportRef = doc(db, 'reports', reportId);
    const supportRef = doc(db, `reports/${reportId}/supports`, auth.currentUser?.uid || 'anon');
    
    try {
      await setDoc(supportRef, {
        userId: auth.currentUser?.uid,
        reportId,
        createdAt: serverTimestamp()
      });
      await updateDoc(reportRef, {
        supportCount: increment(1),
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `reports/${reportId}/supports`);
    }
  },

  async deleteReport(reportId: string) {
    const reportRef = doc(db, 'reports', reportId);
    try {
      // In a real app with strict rules, we might need a status change instead of hard delete,
      // but let's assume citizens can delete their own pending reports.
      const snap = await getDoc(reportRef);
      if (snap.exists() && snap.data().userId === auth.currentUser?.uid) {
         // Using update status to deleted instead of hard delete for history?
         // We will just hard delete for now if standard rules allow it.
         // Actually, rules don't allow delete right now. So let's soft-delete by unpublishing or ignore.
         // To comply with our rules (no delete rule written for reports), we'll just throw an alert for now.
         console.log("Delete not permitted by rules yet. Mocking delete.");
         alert("ستتم إزالة البلاغ قريباً (محاكاة)");
      }
    } catch (error) {
      console.error(error);
    }
  },

  async rateReport(reportId: string, ratingData: any) {
    const reportRef = doc(db, 'reports', reportId);
    try {
      await updateDoc(reportRef, {
        rating: ratingData,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `reports/${reportId}`);
    }
  },

  async seedDemoData() {
    const demoReports: Partial<Report>[] = [
      {
        category: ReportCategory.POTHOLE,
        description: "حفرة عميقة في شارع الستين تسبب أضرار للسيارات ويرجى ردمها بأسرع وقت.",
        priority: ReportPriority.HIGH,
        location: { lat: 15.3694, lng: 44.1910, address: 'صنعاء - الستين' },
        neighborhoodId: 'sanaa_central',
        imageUrl: "https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?auto=format&fit=crop&q=80&w=800",
        status: ReportStatus.PENDING,
      },
      {
        category: ReportCategory.GARBAGE,
        description: "تراكم كبير للقمامة خلف مدرسة القدس منذ أسبوع مما يسبب روائح كريهة.",
        priority: ReportPriority.MEDIUM,
        location: { lat: 15.3720, lng: 44.1950, address: 'صنعاء - الروضة' },
        neighborhoodId: 'sanaa_rawda',
        imageUrl: "https://images.unsplash.com/photo-1532996122724-e3c354a0b15f?auto=format&fit=crop&q=80&w=400",
        status: ReportStatus.ACKNOWLEDGED,
      },
      {
        category: ReportCategory.LIGHTING,
        description: "انقطاع الإنارة في شارع الجامعة، الشارع مظلم بالكامل منذ عدة أيام.",
        priority: ReportPriority.CRITICAL,
        location: { lat: 15.3650, lng: 44.1850, address: 'صنعاء - الجامعة' },
        neighborhoodId: 'sanaa_university',
        status: ReportStatus.IN_PROGRESS,
      },
      {
        category: ReportCategory.SEWAGE,
        description: "طفح مجاري مستمر في الحارة، الروائح مزعجة جداً والمياه تغمر الشارع.",
        priority: ReportPriority.HIGH,
        location: { lat: 15.3750, lng: 44.1900, address: 'صنعاء - الحصبة' },
        neighborhoodId: 'sanaa_hasaba',
        status: ReportStatus.RESOLVED,
        resolvedImageUrl: "https://images.unsplash.com/photo-1532996122724-e3c354a0b15f?auto=format&fit=crop&q=80&w=400"
      }
    ];

    for (const report of demoReports) {
      const reportsCol = collection(db, 'reports');
      try {
        await addDoc(reportsCol, {
          ...report,
          userId: auth.currentUser?.uid,
          supportCount: Math.floor(Math.random() * 20),
          createdAt: serverTimestamp(),
        });
      } catch (error) {
        console.error("Error seeding report", error);
      }
    }
  }
};
