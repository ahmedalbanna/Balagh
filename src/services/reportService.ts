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
  }
};
