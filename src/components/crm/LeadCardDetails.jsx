import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  X, User, Building, Phone, Mail, Link, FileText, 
  Trash2, Play, Check, Calculator, MapPin, 
  FileSpreadsheet, Sparkles, Printer, Save, Clock,
  Music, Volume2, RefreshCw, CheckCircle2, AlertCircle, Loader2, Truck,
  PhoneCall, Mic, Square, Radio, RotateCcw, Receipt
} from 'lucide-react';
import { toast } from '../../utils/toast';
import { calculateCost, determineTier } from '../../services/pricingEngine';
import { extractCallScope } from '../../services/gemini';
import { validatePhone, validateEmail, formatPhone, sanitizeTechnicalScope, stripEmojis } from '../../utils/validation';
import Card from '../common/Card';
import { 
  DetailModalLayout, 
  DetailModalHeader, 
  DetailModalContent, 
  DetailModalSidebar, 
  DetailFieldGroup, 
  DetailCustomerCard, 
  DetailModalFooter,
  StatusBadge 
} from '../common/ui';
import QuotationBuilder from './QuotationBuilder';
import { downsampleAudio } from '../../utils/audioProcessing';
import { toDateObj } from '../../utils/dateUtils';
import { buildInvoiceHtml, openInvoicePrintWindow } from '../../utils/invoiceTemplate';
import { buildReceiptHtml } from '../../utils/receiptTemplate';

export default function LeadCardDetails({ 
  lead, 
  onClose, 
  onSave, 
  onSaveInvoice, 
  onMarkInvoicePaid,
  onConvert,
  partners = [], 
  customers = [],
  currentUser,
  allQuotations = [],
  isDeal = false,
  logisticsJobs = [],
  onCreateLogistics,
  invoices = [],
  receipts = [],
  onGenerateReceipt
}) {
  const defaultFormData = {
    name: lead.name || '',
    phone: lead.phone || '',
    email: lead.email || '',
    company: lead.company || '',
    source: lead.source || 'Manual',
    agentId: lead.agentId || '',
    jobScope: lead.jobScope || '',
    deliveryLocation: lead.deliveryLocation || '',
    value: lead.value || 0,
    totalSqFt: lead.totalSqFt || 0,
    pricingMetadata: lead.pricingMetadata || null,
  };
  const [formData, setFormData] = useState(defaultFormData);
  const [initialDataStr] = useState(JSON.stringify(defaultFormData));
  const [isDirty, setIsDirty] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  useEffect(() => {
    setIsDirty(JSON.stringify(formData) !== initialDataStr);
  }, [formData, initialDataStr]);

  // Advance and Final are tracked as two independent invoice documents, each
  // with its own live Firestore status — never a single cached boolean on the
  // lead, which is exactly what let marking one accidentally mark both.
  // A Lead converted to a Deal gets a brand new id — matching must work from
  // BOTH sides of that split: from the Deal's own card (which knows the
  // original lead via originalLeadId), and from the ORIGINAL LEAD's own card
  // (which only knows the deal it became via convertedDealId — the Final
  // invoice is typically created later, under the Deal's id, so viewing from
  // the Lead's side needs this forward pointer or it never finds it).
  const relatedRecordIds = useMemo(
    () => [lead.id, lead.originalLeadId, lead.convertedDealId].filter(Boolean),
    [lead.id, lead.originalLeadId, lead.convertedDealId]
  );
  // A lead/deal used for repeated testing or re-quoting can end up with
  // MORE THAN ONE Advance (or Final) invoice on file — nothing here (or
  // anywhere else this session) prevents creating a second one. .find()
  // returns whichever happens to be first in Firestore's snapshot order,
  // which is not guaranteed to be creation order — that's exactly what let
  // a stale, previously-generated invoice number print instead of the
  // one just created. Always take the most recently created match.
  const latestByCreatedAt = (candidates) => {
    if (candidates.length <= 1) return candidates[0] || null;
    return candidates.reduce((latest, inv) => {
      if (!latest) return inv;
      const latestTime = toDateObj(latest.createdAt)?.getTime() ?? -Infinity;
      const invTime = toDateObj(inv.createdAt)?.getTime() ?? -Infinity;
      return invTime > latestTime ? inv : latest;
    }, null);
  };
  const advanceInvoice = useMemo(
    () => latestByCreatedAt(invoices.filter(inv => relatedRecordIds.includes(inv.leadId) && inv.type !== 'Final')),
    [invoices, relatedRecordIds]
  );
  const finalInvoice = useMemo(
    () => latestByCreatedAt(invoices.filter(inv => relatedRecordIds.includes(inv.leadId) && inv.type === 'Final')),
    [invoices, relatedRecordIds]
  );
  const advanceReceipt = useMemo(
    () => receipts.find(r => r.invoiceId === (advanceInvoice?.id || advanceInvoice?._firestoreId)) || null,
    [receipts, advanceInvoice]
  );
  const finalReceipt = useMemo(
    () => receipts.find(r => r.invoiceId === (finalInvoice?.id || finalInvoice?._firestoreId)) || null,
    [receipts, finalInvoice]
  );

  // UI state
  const [convertError, setConvertError] = useState('');
  const [receiptFormFor, setReceiptFormFor] = useState(null); // 'advance' | 'final' | null
  const [receiptFormData, setReceiptFormData] = useState({ amountReceived: 0, paymentMethod: 'Cash', date: new Date().toISOString().split('T')[0] });
  const [isGeneratingReceipt, setIsGeneratingReceipt] = useState(false);

  const openReceiptForm = (kind, invoice) => {
    setReceiptFormFor(kind);
    setReceiptFormData({
      amountReceived: Number(invoice?.amount) || 0,
      paymentMethod: 'Cash',
      date: new Date().toISOString().split('T')[0],
    });
  };

  const submitReceiptForm = async (invoice) => {
    if (!onGenerateReceipt || !invoice) return;
    setIsGeneratingReceipt(true);
    try {
      await onGenerateReceipt(invoice, receiptFormData);
      setReceiptFormFor(null);
    } finally {
      setIsGeneratingReceipt(false);
    }
  };

  // AI Call Recording Analyzer states
  const [audioFile, setAudioFile] = useState(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState('idle'); // 'idle' | 'reading' | 'validating' | 'compressing' | 'ready' | 'error'
  const [uploadStageText, setUploadStageText] = useState('');
  const [preparedAudioData, setPreparedAudioData] = useState(null);
  const [isAnalyzingAudio, setIsAnalyzingAudio] = useState(false);
  const [audioAnalysisStage, setAudioAnalysisStage] = useState('');
  const [audioAnalysisResult, setAudioAnalysisResult] = useState('');
  const [audioError, setAudioError] = useState('');
  const fileInputRef = useRef(null);

  // Clean up object URLs on component unmount
  useEffect(() => {
    return () => {
      if (audioPreviewUrl) {
        URL.revokeObjectURL(audioPreviewUrl);
      }
    };
  }, [audioPreviewUrl]);

  // Live Call Recording State (In-Browser Web MediaStream)
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const mediaStreamRef = useRef(null);

  const formatTimer = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handlePhoneLinkCall = (e) => {
    if (!formData.phone) {
      if (e) e.preventDefault();
      toast.error('Please enter a contact number first.');
      return;
    }
    const cleanPhone = formData.phone.replace(/[^0-9+]/g, '');
    toast.success(`Opening Windows Phone Link for ${cleanPhone}...`);
    window.location.href = `tel:${cleanPhone}`;
  };

  const startCallRecording = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast.error('Microphone recording is not supported in this browser.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      mediaStreamRef.current = stream;

      let mimeType = 'audio/webm';
      if (typeof MediaRecorder !== 'undefined') {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          mimeType = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
          mimeType = 'audio/ogg';
        }
      }

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const leadCleanName = (formData.name || 'Lead').replace(/[^a-zA-Z0-9]/g, '_');
        const filename = `Call_${leadCleanName}_${Date.now()}.webm`;
        const recordedFile = new File([audioBlob], filename, { type: audioBlob.type });

        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach(track => track.stop());
          mediaStreamRef.current = null;
        }

        toast.success(`Call recording captured! Preparing AI analysis...`);
        await processAudioFile(recordedFile);
      };

      recorder.start(500);
      setIsRecording(true);
      setRecordingSeconds(0);

      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);

      toast.success('Live call recording started');
    } catch (err) {
      console.error('Failed to start audio recording:', err);
      toast.error('Microphone permission denied: ' + (err.message || 'Check browser settings.'));
    }
  };

  const stopCallRecording = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const cancelCallRecording = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setRecordingSeconds(0);
    toast.info('Recording cancelled');
  };

  // Shared audio processor for both file drops and live microphone recordings
  const processAudioFile = async (file) => {
    if (!file) return;

    if (audioPreviewUrl) {
      URL.revokeObjectURL(audioPreviewUrl);
      setAudioPreviewUrl(null);
    }
    setAudioFile(file);
    setAudioAnalysisResult('');
    setAudioError('');
    setPreparedAudioData(null);
    setUploadProgress(10);
    setUploadStage('reading');
    setUploadStageText('Reading audio data...');

    try {
      const previewUrl = URL.createObjectURL(file);
      setAudioPreviewUrl(previewUrl);

      const EXTENSION_MIME_MAP = {
        mp3: 'audio/mpeg',
        m4a: 'audio/mp4',
        wav: 'audio/wav',
        ogg: 'audio/ogg',
        webm: 'audio/webm',
        aac: 'audio/aac',
        flac: 'audio/flac',
      };
      const ext = (file.name || '').split('.').pop()?.toLowerCase();
      const detectedMime = file.type || EXTENSION_MIME_MAP[ext] || 'audio/webm';

      const COMPRESSED_FORMATS = ['mp3', 'm4a', 'aac', 'ogg', 'webm'];
      const isAlreadyCompressed = COMPRESSED_FORMATS.includes(ext) || (file.type && !file.type.includes('wav'));
      const MAX_PAYLOAD_RAW_SIZE = 3.2 * 1024 * 1024;

      setUploadProgress(35);
      setUploadStage('validating');
      setUploadStageText(`Validated format (${ext?.toUpperCase() || 'Audio'}) • Checking payload...`);

      await new Promise(r => setTimeout(r, 150));

      let processedBlob = file;
      let finalMime = detectedMime;
      let isCompressed = false;

      if (!isAlreadyCompressed && file.size > MAX_PAYLOAD_RAW_SIZE) {
        setUploadProgress(60);
        setUploadStage('compressing');
        setUploadStageText(`Optimizing audio (${(file.size / 1024 / 1024).toFixed(1)}MB)...`);
        
        try {
          processedBlob = await downsampleAudio(file);
          finalMime = 'audio/wav';
          isCompressed = true;
          setUploadProgress(80);
          setUploadStageText(`Optimized to 8kHz WAV speech standard`);
        } catch (dsErr) {
          console.warn('Downsampling fallback:', dsErr);
          processedBlob = file;
          finalMime = detectedMime;
        }
      } else {
        setUploadProgress(80);
        setUploadStageText(isAlreadyCompressed 
          ? `Preserving compressed stream (${(file.size / 1024 / 1024).toFixed(2)} MB ${ext?.toUpperCase() || 'Audio'})` 
          : 'Audio size verified • Encoding payload...');
      }

      await new Promise(r => setTimeout(r, 100));

      const reader = new FileReader();
      const base64Promise = new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
      });
      reader.readAsDataURL(processedBlob);
      const base64Data = await base64Promise;

      setPreparedAudioData({
        base64Data,
        mimeType: finalMime,
        originalSizeMB: (file.size / 1024 / 1024).toFixed(2),
        finalSizeMB: (processedBlob.size / 1024 / 1024).toFixed(2),
        isCompressed,
        fileName: file.name,
        formatLabel: ext?.toUpperCase() || 'AUDIO'
      });

      setUploadProgress(100);
      setUploadStage('ready');
      setUploadStageText('Audio ready for AI extraction');
      toast.success('Audio prepared & ready for Gemini analysis');
    } catch (err) {
      console.error('Audio ingestion failed:', err);
      setUploadStage('error');
      setUploadStageText('Failed to process audio');
      setAudioError(err.message || 'Failed to read audio data.');
    }
  };

  // Cost calculator fields
  const [calcLength, setCalcLength] = useState(0);
  const [calcHeight, setCalcHeight] = useState(0);
  const [calcSqFt, setCalcSqFt] = useState(0);
  const [calcTier, setCalcTier] = useState('0-50');
  const [dimensionsLocked, setDimensionsLocked] = useState(!!lead.pricingMetadata);

  // Initialize dimensions from pricingMetadata if available
  useEffect(() => {
    if (lead.pricingMetadata && lead.pricingMetadata.dimensions) {
      setCalcLength(lead.pricingMetadata.dimensions.length || 0);
      setCalcHeight(lead.pricingMetadata.dimensions.height || 0);
    }
  }, [lead.pricingMetadata]);

  // Customer cross-check popup/alert state
  const [matchedCustomer, setMatchedCustomer] = useState(null);

  // Keep track of calculated sqft
  useEffect(() => {
    const sqft = Math.max(0, calcLength * calcHeight);
    setCalcSqFt(sqft);
    if (sqft > 0) {
      setCalcTier(determineTier(sqft));
    }
  }, [calcLength, calcHeight]);

  const activePricing = useMemo(() => {
    if (calcSqFt > 0) {
      return calculateCost(calcTier, calcSqFt);
    }
    return null;
  }, [calcTier, calcSqFt]);

  const applyPricingToLead = () => {
    if (activePricing) {
      const fixedValue = Number(activePricing.finalAmount.toFixed(2));
      setFormData(prev => ({
        ...prev,
        value: fixedValue,
        totalSqFt: calcSqFt,
        pricingMetadata: {
          ...activePricing,
          finalAmount: fixedValue,
          dimensions: { length: calcLength, height: calcHeight }
        }
      }));
      setDimensionsLocked(true);
    }
  };

    // Enforce +94 country code on phone number input
  const handlePhoneChange = (val) => {
    const formatted = formatPhone(val);
    setFormData(prev => ({ ...prev, phone: formatted }));

    // Limit digits for cross-check
    const digitsOnly = formatted.substring(3).replace(/\s+/g, '');

    // Database cross-checking: Check if contact number exists in customers database
    if (digitsOnly.length >= 9) {
      const match = customers.find(c => {
        const cPhone = c.phone?.replace(/[^\d+]/g, '');
        const targetPhone = formatted.replace(/\s+/g, '');
        return cPhone === targetPhone || (cPhone?.endsWith(digitsOnly));
      });
      if (match) {
        setMatchedCustomer(match);
      } else {
        setMatchedCustomer(null);
      }
    } else {
      setMatchedCustomer(null);
    }
  };

  const autofillCustomerDetails = () => {
    if (matchedCustomer) {
      setFormData(prev => ({
        ...prev,
        name: matchedCustomer.name || prev.name,
        company: matchedCustomer.businessName || prev.company,
        email: matchedCustomer.email || prev.email,
      }));
      setMatchedCustomer(null); // Clear prompt
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const updated = { ...prev, [name]: value };
      // Clear agent selection if source is not Referral
      if (name === 'source' && value !== 'Referral') {
        updated.agentId = '';
      }
      return updated;
    });
  };

  const handleAudioFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Reset previous audio state
    if (audioPreviewUrl) {
      URL.revokeObjectURL(audioPreviewUrl);
      setAudioPreviewUrl(null);
    }
    setAudioFile(file);
    setAudioAnalysisResult('');
    setAudioError('');
    setPreparedAudioData(null);
    setUploadProgress(10);
    setUploadStage('reading');
    setUploadStageText('Reading audio file...');

    try {
      // Step 1: Create local preview URL for immediate in-modal playback
      const previewUrl = URL.createObjectURL(file);
      setAudioPreviewUrl(previewUrl);

      // Step 2: Validate audio extension and MIME
      const EXTENSION_MIME_MAP = {
        mp3: 'audio/mpeg',
        m4a: 'audio/mp4',
        wav: 'audio/wav',
        ogg: 'audio/ogg',
        webm: 'audio/webm',
        aac: 'audio/aac',
        flac: 'audio/flac',
      };
      const ext = (file.name || '').split('.').pop()?.toLowerCase();
      const detectedMime = file.type || EXTENSION_MIME_MAP[ext] || 'audio/mpeg';

      // CRITICAL FIX: If the file is already a compressed format (MP3, M4A, AAC, OGG, WEBM)
      // and under 3.2MB, NEVER decode it to uncompressed WAV (which expands 2.8MB MP3 to 10.2MB WAV).
      // Keep it in its original compressed stream!
      const COMPRESSED_FORMATS = ['mp3', 'm4a', 'aac', 'ogg', 'webm'];
      const isAlreadyCompressed = COMPRESSED_FORMATS.includes(ext) || (file.type && !file.type.includes('wav'));
      const MAX_PAYLOAD_RAW_SIZE = 3.2 * 1024 * 1024; // 3.2MB (translates to ~4.2MB Base64, fitting under Vercel's 4.5MB limit)

      setUploadProgress(35);
      setUploadStage('validating');
      setUploadStageText(`Validated format (${ext?.toUpperCase() || 'Audio'}) • Checking payload size...`);

      // Micro-pause for smooth visual perception
      await new Promise(r => setTimeout(r, 200));

      let processedBlob = file;
      let finalMime = detectedMime;
      let isCompressed = false;

      if (!isAlreadyCompressed && file.size > MAX_PAYLOAD_RAW_SIZE) {
        // Large uncompressed WAV file: downsample to 8kHz mono WAV (telecom speech standard)
        setUploadProgress(60);
        setUploadStage('compressing');
        setUploadStageText(`Optimizing uncompressed WAV audio (${(file.size / 1024 / 1024).toFixed(1)}MB)...`);
        
        try {
          processedBlob = await downsampleAudio(file);
          finalMime = 'audio/wav';
          isCompressed = true;
          setUploadProgress(80);
          setUploadStageText(`Optimized ${(file.size / 1024 / 1024).toFixed(1)}MB → ${(processedBlob.size / 1024 / 1024).toFixed(1)}MB (WAV)`);
        } catch (dsErr) {
          console.warn('Downsampling fallback to original file:', dsErr);
          processedBlob = file;
          finalMime = detectedMime;
        }
      } else {
        setUploadProgress(80);
        setUploadStageText(isAlreadyCompressed 
          ? `Preserving compressed stream (${(file.size / 1024 / 1024).toFixed(2)} MB ${ext?.toUpperCase() || 'Audio'})` 
          : 'Audio size verified • Encoding payload...');
      }

      await new Promise(r => setTimeout(r, 150));

      // Step 4: Convert to Base64
      const reader = new FileReader();
      const base64Promise = new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
      });
      reader.readAsDataURL(processedBlob);
      const base64Data = await base64Promise;

      // Step 5: Ready
      setPreparedAudioData({
        base64Data,
        mimeType: finalMime,
        originalSizeMB: (file.size / 1024 / 1024).toFixed(2),
        finalSizeMB: (processedBlob.size / 1024 / 1024).toFixed(2),
        isCompressed,
        fileName: file.name,
        formatLabel: ext?.toUpperCase() || 'AUDIO'
      });

      setUploadProgress(100);
      setUploadStage('ready');
      setUploadStageText('Audio ready for AI extraction');
      toast.success('Audio file verified & ready for analysis');
    } catch (err) {
      console.error('Audio ingestion failed:', err);
      setUploadStage('error');
      setUploadStageText('Failed to process audio file');
      setAudioError(err.message || 'Failed to read audio file.');
    }
  };

  const resetAudioFile = (e) => {
    if (e) e.stopPropagation();
    if (audioPreviewUrl) {
      URL.revokeObjectURL(audioPreviewUrl);
      setAudioPreviewUrl(null);
    }
    setAudioFile(null);
    setPreparedAudioData(null);
    setUploadProgress(0);
    setUploadStage('idle');
    setUploadStageText('');
    setAudioAnalysisResult('');
    setAudioError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Call analyzer with simple words & emojis requirement
  const analyzeCallRecording = async () => {
    if (!preparedAudioData || uploadStage !== 'ready') {
      toast.error('Please wait for the audio file to finish preparing.');
      return;
    }

    setIsAnalyzingAudio(true);
    setAudioError('');
    setAudioAnalysisResult('');
    setAudioAnalysisStage('Dispatching audio payload to Gemini AI...');

    try {
      const clientInfo = { name: formData.name, company: formData.company };
      
      // Prompt for clean, professional technical engineering specification
      const instructions = `
        Use formal, professional, engineering and fabrication terminology.
        STRICT REQUIREMENT: Do NOT use any emojis, pictographs, or casual icons.
        Format specifications with clear technical bullet points (e.g. Dimensions, Steel Gauge, Material Type, Finish, Timeline).
      `;
      
      setAudioAnalysisStage('Gemini AI is transcribing Sinhala/English speech & extracting specs...');
      const result = await extractCallScope(
        preparedAudioData.base64Data, 
        preparedAudioData.mimeType, 
        instructions, 
        clientInfo
      );

      if (result && result.scope) {
        result.scope = sanitizeTechnicalScope(result.scope);
      }
      setAudioAnalysisResult(result);
      toast.success('AI extracted engineering scope successfully!');
    } catch (err) {
      setAudioError(err.message || 'Failed to analyze audio recording.');
    } finally {
      setIsAnalyzingAudio(false);
      setAudioAnalysisStage('');
    }
  };

  const applyAudioAnalysisToScope = () => {
    if (!audioAnalysisResult) return;
    
    setFormData(prev => ({ 
      ...prev, 
      jobScope: sanitizeTechnicalScope(audioAnalysisResult.scope || prev.jobScope),
      name: audioAnalysisResult.clientName || prev.name,
      phone: audioAnalysisResult.clientContact || prev.phone,
      email: audioAnalysisResult.clientEmail || prev.email,
      deliveryLocation: audioAnalysisResult.deliveryLocation || prev.deliveryLocation,
    }));

    if (audioAnalysisResult.frameHeight !== undefined && !isNaN(Number(audioAnalysisResult.frameHeight))) {
      setCalcHeight(Number(audioAnalysisResult.frameHeight));
    }
    if (audioAnalysisResult.frameWidth !== undefined && !isNaN(Number(audioAnalysisResult.frameWidth))) {
      setCalcLength(Number(audioAnalysisResult.frameWidth));
    }
    
    // Automatically perform cross-check on extracted phone
    if (audioAnalysisResult.clientContact) {
      const formattedPhone = audioAnalysisResult.clientContact.startsWith('+94') 
        ? audioAnalysisResult.clientContact 
        : '+94' + audioAnalysisResult.clientContact.replace(/[^\d]/g, '').slice(-9);
      handlePhoneChange(formattedPhone);
    }
    
    setAudioAnalysisResult('');
    setAudioFile(null);
  };

  // Redesigned Print Invoice PDF Styling (Clean, Premium, Modern, Matching Both 75% Advance and 25% Final)
  const printInvoice = (invoiceType = 'Advance') => {
    const isFinal = invoiceType === 'Final';

    // Print the REAL persisted invoice's own fields whenever one exists, so
    // the document always matches what's saved in Firestore and shown in the
    // Invoices module — never mint independent numbers/amounts here. Only
    // before the invoice has actually been converted/saved (via the
    // Line-Item Quote panel) does this fall back to computed draft values,
    // clearly marked with a DRAFT- id that's never mistaken for a real one.
    const realInvoice = isFinal ? finalInvoice : advanceInvoice;
    const totalVal = Number(formData.value || lead.value || 0);
    const advanceAmount = totalVal * 0.75;
    const balanceAmount = totalVal * 0.25;
    const invoiceAmount = isFinal ? balanceAmount : advanceAmount;

    // Same "pick the newest, not just the first array match" fix as
    // advanceInvoice/finalInvoice above — multiple quote versions can exist
    // for the same lead, and .find() isn't guaranteed to land on the latest.
    const matchingQuotes = (allQuotations || []).filter(q => relatedRecordIds.includes(q.leadId) || q.leadId === lead._firestoreId);
    const activeQuote = matchingQuotes.length <= 1
      ? (matchingQuotes[0] || null)
      : matchingQuotes.reduce((latest, q) => (Number(q.version) || 0) > (Number(latest.version) || 0) ? q : latest);
    const lineItemsToPrint = activeQuote?.lineItems && activeQuote.lineItems.length > 0 ? activeQuote.lineItems : null;

    const invoiceForPrint = {
      id: realInvoice?.id || realInvoice?._firestoreId || `DRAFT-${isFinal ? 'FINAL' : 'ADVANCE'}`,
      type: isFinal ? 'Final' : 'Advance',
      status: realInvoice?.status,
      date: realInvoice?.date,
      dueDate: realInvoice?.dueDate,
      amount: realInvoice?.amount ?? invoiceAmount,
      totalValue: realInvoice?.totalValue ?? totalVal,
      lineItems: lineItemsToPrint || realInvoice?.lineItems,
      aiDraft: realInvoice?.aiDraft || `Scope: ${formData.jobScope || 'Custom metal framing work'}`,
      customerName: formData.name,
      company: formData.company,
      linkedJobNo: realInvoice?.linkedJobNo,
    };

    const html = buildInvoiceHtml({ invoice: invoiceForPrint, customerPhone: formData.phone });
    openInvoicePrintWindow(html);
  };

  const printReceipt = (receipt) => {
    if (!receipt) return;
    const html = buildReceiptHtml(receipt);
    openInvoicePrintWindow(html);
  };

  const handleConvertClick = () => {
    const missing = [];
    if (!formData.name) missing.push('Name');
    if (!formData.phone) missing.push('Phone');
    if (!formData.jobScope) missing.push('Job Scope');
    if (!formData.value) missing.push('Quoted Value');

    if (missing.length > 0) {
      setConvertError(`Missing required fields: ${missing.join(', ')}`);
      return;
    }

    if (formData.phone && !validatePhone(formData.phone)) {
      setConvertError(`Invalid phone format. Please use +947X XXXX XXX`);
      return;
    }

    if (formData.email && !validateEmail(formData.email)) {
      setConvertError(`Invalid email format.`);
      return;
    }

    setConvertError('');
    if (onConvert) {
      onConvert({
        ...lead,
        ...formData
      });
    }
  };

  const handleSaveLead = (extraUpdates = null) => {
    // Prevent React SyntheticEvents from polluting the state
    const updatesToApply = (extraUpdates && !extraUpdates.nativeEvent) ? extraUpdates : formData;

    // If Referral and no Agent selected, warn user
    if (updatesToApply.source === 'Referral' && !updatesToApply.agentId) {
      toast.error('Please assign an agent since the Lead Source is Referral.');
      return;
    }

    if (updatesToApply.phone && !validatePhone(updatesToApply.phone)) {
      toast.error('Invalid phone format. Please use +947X XXXX XXX');
      return;
    }

    if (updatesToApply.email && !validateEmail(updatesToApply.email)) {
      toast.error('Invalid email format.');
      return;
    }

    onSave({
      ...lead,
      ...updatesToApply
    });
    toast.success('Lead details saved');
  };

  const handleClose = () => {
    if (isDirty) {
      setShowCloseConfirm(true);
    } else {
      onClose();
    }
  };

  return (
    <DetailModalLayout isOpen={true} onClose={handleClose} ariaLabel="Lead and Deal Pipeline Inspector">
      {showCloseConfirm && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-surface-container p-6 rounded-2xl shadow-[0_10px_40px_rgba(0,218,243,0.2)] max-w-sm w-full border border-outline-variant">
            <h3 className="text-lg font-bold text-on-surface mb-2">Unsaved Changes</h3>
            <p className="text-sm text-on-surface-variant mb-6">You have unsaved changes. Do you want to save before leaving?</p>
            <div className="flex space-x-3">
              <button 
                onClick={() => { setShowCloseConfirm(false); onClose(); }}
                className="flex-1 py-2 bg-surface-container hover:bg-surface-container-high text-on-surface font-bold text-sm rounded-lg transition-colors"
              >
                Discard and Close
              </button>
              <button 
                onClick={() => { setShowCloseConfirm(false); handleSaveLead(); onClose(); }}
                className="flex-1 py-2 bg-primary text-on-primary hover:bg-primary/80 font-bold text-sm rounded-lg transition-colors shadow-[0_0_15px_rgba(0,218,243,0.15)] hover:shadow-[0_0_20px_rgba(0,218,243,0.3)]"
              >
                Save and Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Universal Header */}
      <DetailModalHeader
        title={formData.name || 'New Lead'}
        id={lead.id}
        badge={
          <StatusBadge status={lead.stage || 'Draft'} size="sm" />
        }
        subtitle={
          <>
            <span>Source: <strong className="text-on-surface">{formData.source || 'Manual'}</strong></span>
            <span>•</span>
            <span>Pipeline: <strong className="text-primary">{lead.isDeal ? "Deals" : "Leads"}</strong></span>
          </>
        }
        onClose={handleClose}
      />

      {/* Content Body — Smooth unified vertical scroll, no horizontal slider */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col lg:flex-row custom-scrollbar">
        
        {/* ── LEFT COLUMN (Primary Operational Flow) ─────────────────────────────────── */}
        <DetailModalContent className="space-y-6">
          
          {/* 1. Client Profile Details */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-on-surface uppercase tracking-widest flex items-center pb-2 border-b border-outline">
              <User size={14} className="mr-2 text-primary" />
              Client Profile Details
            </h3>

            {/* Inline Cross-Checking autofill prompt */}
            {matchedCustomer && (
              <div className="p-4 bg-primary/10 rounded-2xl border border-primary/30 flex items-center justify-between shadow-[0_4px_20px_rgba(0,218,243,0.05)] animate-bounce">
                <div>
                  <p className="text-xs font-bold text-yellow-500">Existing Customer Found in Database!</p>
                  <p className="text-[10px] text-primary mt-0.5">Matched profile: {matchedCustomer.name} {matchedCustomer.businessName ? `(${matchedCustomer.businessName})` : ''}</p>
                </div>
                <button 
                  onClick={autofillCustomerDetails}
                  className="px-3 py-1.5 bg-yellow-500/20 text-yellow-500 hover:bg-yellow-500/30 rounded-lg text-[10px] font-bold shadow-[0_4px_20px_rgba(0,218,243,0.05)]"
                >
                  Auto-Fill Profile
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Row 1, Col 1: Full Name */}
              <div>
                <label className="block text-xs uppercase font-bold text-on-surface mb-1.5 tracking-wider">Full Name</label>
                <div className="relative">
                  <User size={14} className="absolute left-3.5 top-3 text-on-surface-variant" />
                  <input 
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="w-full pl-9 pr-4 py-2.5 bg-surface-container-highest/60 border border-outline rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder="e.g. Amal Silva"
                  />
                </div>
              </div>

              {/* Row 1, Col 2: Contact Number + Inline Quick Action Pills */}
              <div>
                <label className="block text-xs uppercase font-bold text-on-surface mb-1.5 tracking-wider">Contact Number</label>
                <div className="flex bg-surface-container-highest/60 border border-outline rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-primary/50">
                  <div className="flex items-center px-3 bg-surface-container border-r border-outline-variant text-sm font-bold text-on-surface-variant select-none">
                    <Phone size={14} className="mr-1.5 text-on-surface-variant" />
                    +94
                  </div>
                  <input 
                    type="text"
                    name="phone"
                    value={formData.phone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    className="w-full px-3 py-2.5 bg-transparent text-sm focus:outline-none"
                    placeholder="+94 7X XXX XXXX"
                  />
                </div>

                {/* Compact Action Pills right under phone input */}
                <div className="flex items-center gap-1.5 mt-2">
                  <button
                    type="button"
                    onClick={handlePhoneLinkCall}
                    disabled={!formData.phone}
                    className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1 shadow-sm active:scale-95 ${
                      formData.phone
                        ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/30 cursor-pointer'
                        : 'bg-surface-container text-on-surface-variant/40 border border-outline-variant/40 cursor-not-allowed opacity-60'
                    }`}
                    title={formData.phone ? `Open Windows Phone Link for ${formData.phone}` : 'Enter contact number first'}
                  >
                    <PhoneCall size={12} className={formData.phone ? 'text-emerald-400' : 'text-on-surface-variant/40'} />
                    <span className="truncate">Call via Phone Link</span>
                  </button>

                  {!isRecording ? (
                    <button
                      type="button"
                      onClick={startCallRecording}
                      className="flex-1 py-1.5 px-2 bg-primary/15 text-primary hover:bg-primary/25 border border-primary/30 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1 shadow-sm active:scale-95 cursor-pointer"
                      title="Record this conversation directly in browser"
                    >
                      <Mic size={12} className="text-primary" />
                      <span className="truncate">Record Live Call</span>
                    </button>
                  ) : (
                    <div className="flex-1 flex items-center justify-between gap-1 bg-error/15 border border-error/40 px-2 py-1 rounded-lg">
                      <div className="flex items-center gap-1 min-w-0">
                        <span className="flex h-2 w-2 relative flex-shrink-0">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-error opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-error"></span>
                        </span>
                        <span className="text-[11px] font-mono font-black text-error truncate">
                          {formatTimer(recordingSeconds)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          type="button"
                          onClick={stopCallRecording}
                          className="px-1.5 py-0.5 bg-error text-on-error hover:bg-error/90 rounded text-[9px] font-bold transition-all flex items-center gap-0.5 shadow-sm active:scale-95 cursor-pointer"
                          title="Stop recording and prepare AI analysis"
                        >
                          <Square size={8} /> Stop
                        </button>
                        <button
                          type="button"
                          onClick={cancelCallRecording}
                          className="p-0.5 text-on-surface-variant hover:text-error rounded transition-colors cursor-pointer"
                          title="Cancel Recording"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Row 2, Col 1: Company / Business */}
              <div>
                <label className="block text-xs uppercase font-bold text-on-surface mb-1.5 tracking-wider">Company / Business</label>
                <div className="relative">
                  <Building size={14} className="absolute left-3.5 top-3 text-on-surface-variant" />
                  <input 
                    type="text"
                    name="company"
                    value={formData.company}
                    onChange={handleInputChange}
                    className="w-full pl-9 pr-4 py-2.5 bg-surface-container-highest/60 border border-outline rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder="e.g. Silva Art Printers"
                  />
                </div>
              </div>

              {/* Row 2, Col 2: Email Address */}
              <div>
                <label className="block text-xs uppercase font-bold text-on-surface mb-1.5 tracking-wider">Email Address</label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3.5 top-3 text-on-surface-variant" />
                  <input 
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full pl-9 pr-4 py-2.5 bg-surface-container-highest/60 border border-outline rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder="example@test.com"
                  />
                </div>
              </div>

              {/* Row 3, Col 1: Lead Source */}
              <div>
                <label className="block text-[9px] uppercase font-bold text-on-surface-variant mb-1.5 tracking-widest">Lead Source</label>
                <select 
                  name="source"
                  value={formData.source}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 bg-surface-container-low border border-outline-variant rounded-xl text-sm font-semibold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 appearance-none bg-no-repeat bg-[right_1rem_center] bg-[length:1em_1em] [&>option]:bg-surface-container-high [&>option]:text-on-surface"
                  style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2300daf3'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")` }}
                >
                  <option value="Manual">Manual Entry</option>
                  <option value="Referral">Referral (Commission Agent)</option>
                  <option value="Social Media">Social Media</option>
                  <option value="Website">Website</option>
                  <option value="Walk-in">Walk-in</option>
                </select>
              </div>

              {/* Row 3, Col 2: Assigned Agent (paired with Lead Source) */}
              <div>
                <label className={`block text-[9px] uppercase font-bold mb-1.5 tracking-widest ${formData.source === 'Referral' ? 'text-primary' : 'text-on-surface-variant'}`}>
                  Assigned Agent {formData.source === 'Referral' && '— REQUIRED'}
                </label>
                <select 
                  name="agentId"
                  value={formData.agentId}
                  onChange={handleInputChange}
                  disabled={formData.source !== 'Referral'}
                  className={`w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 appearance-none bg-no-repeat bg-[right_1rem_center] bg-[length:1em_1em] [&>option]:bg-surface-container-high [&>option]:text-on-surface ${
                    formData.source === 'Referral'
                      ? 'bg-surface-container-low border-primary/50 font-bold text-on-surface shadow-[0_0_15px_rgba(0,218,243,0.1)]'
                      : 'bg-surface-container/40 border-outline-variant/60 text-on-surface-variant cursor-not-allowed opacity-60'
                  }`}
                  style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2300daf3'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")` }}
                >
                  <option value="">Select Agent / Partner...</option>
                  {partners.map(p => (
                    <option key={p.partnerId || p.id} value={p.partnerId || p.id}>
                      {p.name} ({p.partnerId || p.id} - {p.type || 'Partner'})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* 2. Automated Pricing Engine */}
          <div className="p-5 bg-violet-500/10 rounded-2xl border border-violet-500/30 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-violet-600 text-white rounded-xl shadow-md">
                  <Calculator size={16} />
                </div>
                <div>
                  <h3 className="font-extrabold text-on-surface text-xs uppercase tracking-tight">Automated Pricing Engine</h3>
                  <p className="text-[10px] text-on-surface-variant font-medium">Input dimensions to auto-calculate price brackets & tiers</p>
                </div>
              </div>
              {calcSqFt > 0 && activePricing && (
                <div className="flex items-center space-x-2">
                  {dimensionsLocked && currentUser?.role === 'Admin' && (
                    <button onClick={() => setDimensionsLocked(false)} className="text-[10px] font-bold text-violet-400 bg-violet-500/10 px-2 py-1 rounded-md hover:bg-violet-500/20 border border-violet-500/30">
                      Unlock Dims
                    </button>
                  )}
                  <span className="px-2.5 py-1 bg-violet-500/15 text-violet-400 border border-violet-500/30 rounded-full text-[10px] font-bold">
                    Tier: {activePricing.tierInfo.range}
                  </span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs uppercase font-bold text-on-surface mb-1.5 tracking-wider">Length (ft)</label>
                <input 
                  type="number"
                  value={calcLength || ''}
                  onChange={(e) => setCalcLength(Number(e.target.value))}
                  disabled={dimensionsLocked && currentUser?.role !== 'Admin'}
                  className={`w-full px-4 py-2.5 bg-surface-container-highest/60 border border-outline rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-violet-500/50 ${dimensionsLocked && currentUser?.role !== 'Admin' ? 'opacity-60 cursor-not-allowed bg-surface-container-low' : ''}`}
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-xs uppercase font-bold text-on-surface mb-1.5 tracking-wider">Height (ft)</label>
                <input 
                  type="number"
                  value={calcHeight || ''}
                  onChange={(e) => setCalcHeight(Number(e.target.value))}
                  className="w-full px-4 py-2.5 bg-surface-container-highest/60 border border-outline rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                  placeholder="0"
                />
              </div>
            </div>

            {calcSqFt > 0 && activePricing && (
              <div className="bg-surface-container-low p-4 rounded-xl border border-violet-500/20 flex items-center justify-between shadow-inner">
                <div className="text-left">
                  <p className="text-[9px] uppercase font-bold text-on-surface-variant tracking-wider">Total Area & Rate per SqFt</p>
                  <p className="text-xs font-bold text-on-surface mt-0.5">
                    {calcSqFt} SQFT @ LKR {activePricing.finalAmountPerSq.toFixed(2)}/SqFt
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] uppercase font-bold text-violet-400 tracking-wider">Calculated Final Amount</p>
                  <p className="text-base font-black text-violet-400 font-mono">LKR {activePricing.finalAmount.toLocaleString()}</p>
                </div>
              </div>
            )}

            {calcSqFt > 0 && (
              <button 
                onClick={applyPricingToLead}
                className="w-full py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold text-xs shadow-md transition-all active:scale-[0.98]"
              >
                Apply Calculator Results to Lead Quotation
              </button>
            )}
          </div>

          {/* 3. AI Call Recording Analyzer */}
          <div className="p-5 bg-error/10 rounded-2xl border border-error/30 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-error text-on-error rounded-xl shadow-md">
                  <Sparkles size={16} />
                </div>
                <div>
                  <h3 className="font-extrabold text-on-surface text-xs uppercase tracking-tight">AI Call Recording Analyzer</h3>
                  <p className="text-[10px] text-on-surface-variant font-medium">Extract simple, visual scope drafts from caller recordings</p>
                </div>
              </div>
              {audioFile && (
                <button 
                  onClick={resetAudioFile}
                  className="text-[10px] font-bold text-on-surface-variant hover:text-error flex items-center gap-1 px-2.5 py-1 bg-surface-container rounded-lg border border-outline transition-colors"
                  title="Change / Remove Audio File"
                >
                  <RefreshCw size={10} /> Replace File
                </button>
              )}
            </div>

            <input 
              ref={fileInputRef}
              type="file"
              accept="audio/*,.mp3,.wav,.m4a,.ogg,.webm,.aac,.flac"
              onChange={handleAudioFileChange}
              className="hidden"
            />

            {!audioFile ? (
              /* Empty Dropzone State with Dual Upload / Live Recording options */
              <div className="space-y-3">
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-error/30 rounded-xl p-5 flex flex-col items-center justify-center cursor-pointer hover:bg-error/15 hover:border-error/50 transition-all group"
                >
                  <div className="text-center space-y-1.5">
                    <div className="w-9 h-9 rounded-xl bg-error/15 text-error flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                      <Music size={18} />
                    </div>
                    <p className="text-xs font-bold text-on-surface group-hover:text-error transition-colors">Attach telephone call recording file</p>
                    <p className="text-[10px] text-on-surface-variant">Supports MP3, WAV, M4A, OGG, AAC up to 25MB • Auto-optimized</p>
                  </div>
                </div>

                {/* Live Mic Recorder alternative button */}
                <div className="flex items-center justify-between p-3 bg-surface-container-low rounded-xl border border-outline-variant">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-primary/15 text-primary rounded-lg">
                      <Mic size={14} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-on-surface">Or record call live right now</p>
                      <p className="text-[9px] text-on-surface-variant">Captures conversation audio directly through your browser microphone</p>
                    </div>
                  </div>

                  {!isRecording ? (
                    <button
                      type="button"
                      onClick={startCallRecording}
                      className="px-3 py-1.5 bg-primary text-on-primary hover:bg-primary/90 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
                    >
                      <Mic size={12} />
                      <span>Start Recording</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-black text-error animate-pulse">
                        REC {formatTimer(recordingSeconds)}
                      </span>
                      <button
                        type="button"
                        onClick={stopCallRecording}
                        className="px-2.5 py-1 bg-error text-on-error hover:bg-error/90 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 shadow-sm active:scale-95 cursor-pointer"
                      >
                        <Square size={9} /> Stop
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* File Ingestion & Preparation Stage */
              <div className="p-4 bg-surface-container-low rounded-xl border border-outline-variant space-y-3">
                {/* File Info Bar */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="p-1.5 bg-error/15 text-error rounded-lg flex-shrink-0">
                      <Volume2 size={14} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-on-surface truncate">{audioFile.name}</p>
                      <p className="text-[9px] text-on-surface-variant font-mono">
                        {preparedAudioData?.isCompressed ? (
                          <>
                            Original: {(audioFile.size / 1024 / 1024).toFixed(2)} MB
                            <span className="text-primary font-bold ml-1.5">
                              → Optimized: {preparedAudioData.finalSizeMB} MB (8kHz WAV)
                            </span>
                          </>
                        ) : (
                          <span className="text-emerald-400 font-semibold">
                            {(audioFile.size / 1024 / 1024).toFixed(2)} MB ({preparedAudioData?.formatLabel || 'Audio'} Native Stream)
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  {uploadStage === 'ready' && (
                    <span className="flex-shrink-0 inline-flex items-center gap-1 text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
                      <CheckCircle2 size={10} /> Ready
                    </span>
                  )}
                </div>

                {/* Upload & Compression Progress Bar */}
                {uploadStage !== 'ready' && uploadStage !== 'error' && (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between text-[10px] font-bold">
                      <span className="text-on-surface-variant flex items-center gap-1.5">
                        <Loader2 size={10} className="animate-spin text-error" />
                        {uploadStageText}
                      </span>
                      <span className="text-error font-mono">{uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-surface-container h-2 rounded-full overflow-hidden border border-outline">
                      <div 
                        className="bg-gradient-to-r from-error to-primary h-full transition-all duration-300 ease-out rounded-full"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Audio Preview Player */}
                {uploadStage === 'ready' && audioPreviewUrl && (
                  <div className="pt-1">
                    <p className="text-[9px] uppercase font-bold text-on-surface-variant mb-1 tracking-widest flex items-center gap-1">
                      <Play size={10} /> Call Recording Audio Preview:
                    </p>
                    <audio 
                      controls 
                      src={audioPreviewUrl} 
                      className="w-full h-8 rounded-lg bg-surface-container"
                      preload="metadata"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Action Button */}
            {audioFile && !audioAnalysisResult && (
              <button 
                onClick={analyzeCallRecording}
                disabled={uploadStage !== 'ready' || isAnalyzingAudio}
                className={`w-full py-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center space-x-2 ${
                  isAnalyzingAudio 
                    ? 'bg-error/50 text-on-surface cursor-wait' 
                    : uploadStage !== 'ready'
                      ? 'bg-surface-container text-on-surface-variant border border-outline-variant cursor-not-allowed opacity-60'
                      : 'bg-error text-on-error hover:bg-error/90 shadow-md active:scale-[0.98]'
                }`}
              >
                {isAnalyzingAudio ? (
                  <>
                    <Loader2 size={14} className="animate-spin mr-1" />
                    <span>{audioAnalysisStage || 'AI is transcribing & analyzing speech...'}</span>
                  </>
                ) : uploadStage !== 'ready' ? (
                  <>
                    <Loader2 size={12} className="animate-spin mr-1" />
                    <span>Preparing audio file ({uploadProgress}%)...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={14} />
                    <span>Extract Scope using Gemini AI</span>
                  </>
                )}
              </button>
            )}

            {audioError && (
              <div className="p-3 bg-error/20 text-error border border-error/30 rounded-xl text-[10px] font-bold flex items-start gap-2">
                <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                <span>{audioError}</span>
              </div>
            )}

            {audioAnalysisResult && (
              <div className="space-y-3">
                <label className="block text-xs uppercase font-bold text-on-surface tracking-wider">Visual Scope Analysis</label>
                <textarea 
                  value={audioAnalysisResult.scope || ''}
                  onChange={(e) => setAudioAnalysisResult({ ...audioAnalysisResult, scope: e.target.value })}
                  rows={6}
                  className="w-full p-4 bg-surface-container border border-error/30 rounded-xl text-xs text-on-surface font-mono focus:outline-none"
                />
                <button 
                  onClick={applyAudioAnalysisToScope}
                  className="w-full py-2.5 bg-secondary text-on-secondary hover:bg-secondary/80 rounded-xl font-bold text-xs transition-all active:scale-[0.98]"
                >
                  Confirm and Set as Job Scope
                </button>
              </div>
            )}
          </div>

          {/* 4. Job Requirements & Scope Details */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-on-surface uppercase tracking-widest flex items-center pb-2 border-b border-outline">
              <FileText size={14} className="mr-2 text-primary" />
              Job Requirements & Scope
            </h3>

            <div>
              <label className="block text-xs uppercase font-bold text-on-surface mb-1.5 tracking-wider">Scope Details</label>
              <textarea 
                name="jobScope"
                value={formData.jobScope}
                onChange={handleInputChange}
                rows={4}
                className="w-full p-4 bg-surface-container-highest/60 border border-outline rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="e.g. Dimensions, wrapping specifications, steel box bar grade..."
              />
            </div>

            <div>
              <label className="block text-xs uppercase font-bold text-on-surface mb-1.5 tracking-wider">Delivery Address / Logistics Info</label>
              <div className="relative">
                <MapPin size={14} className="absolute left-3.5 top-3 text-on-surface-variant" />
                <input 
                  type="text"
                  name="deliveryLocation"
                  value={formData.deliveryLocation}
                  onChange={handleInputChange}
                  className="w-full pl-9 pr-4 py-2.5 bg-surface-container-highest/60 border border-outline rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="Provide full location or delivery address"
                />
              </div>
            </div>
          </div>

          {/* 5. Quotation & Pricing Breakdown */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-on-surface uppercase tracking-widest flex items-center pb-2 border-b border-outline">
              <FileSpreadsheet size={16} className="mr-2 text-primary" />
              Quotation & Pricing Breakdown
            </h3>

            <div className="bg-surface-container p-5 rounded-2xl border border-outline-variant shadow-[0_4px_20px_rgba(0,218,243,0.05)] space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs uppercase font-bold text-on-surface mb-1.5 tracking-wider">Total Contract Value (LKR)</label>
                  <input 
                    type="number"
                    name="value"
                    value={formData.value}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 bg-surface-container-highest/60 border border-outline rounded-xl text-base font-extrabold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase font-bold text-on-surface mb-1.5 tracking-wider">Gross Volume (SqFt)</label>
                  <input 
                    type="number"
                    name="totalSqFt"
                    value={formData.totalSqFt}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 bg-surface-container-highest/60 border border-outline rounded-xl text-sm font-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Structured Quotation Builder */}
              <div className="pt-2 border-t border-outline">
                <QuotationBuilder
                  lead={{ ...lead, ...formData }}
                  allQuotations={allQuotations}
                  onSaveInvoice={onSaveInvoice}
                  currentUser={currentUser}
                  advanceInvoice={advanceInvoice}
                  finalInvoice={finalInvoice}
                />
              </div>
            </div>
          </div>

          {convertError && (
            <div className="p-3 bg-error/20 border border-error/30 text-error text-xs rounded-xl font-bold">
              {convertError}
            </div>
          )}

        </DetailModalContent>

        {/* ── RIGHT COLUMN (Previews, AI Drafts & Logistics Hub) ──────────────────────── */}
        <DetailModalSidebar className="space-y-6">
          
          {/* 1. Quotation Summary & Financial KPI Card */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-on-surface uppercase tracking-widest flex items-center pb-2 border-b border-outline">
              <FileSpreadsheet size={16} className="mr-2 text-primary" />
              Quotation Summary
            </h3>

            <div className="p-5 bg-surface-container/50 rounded-2xl border border-outline space-y-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 text-primary rounded-xl">
                  <FileSpreadsheet size={24} />
                </div>
                <div>
                  <p className="text-xs font-bold text-on-surface">Financial Split Overview</p>
                  <p className="text-[10px] text-on-surface-variant">75% Advance on commencement • 25% Balance on dispatch</p>
                </div>
              </div>

              {formData.value > 0 && (
                <div className="space-y-2 pt-2 border-t border-outline-variant/30">
                  <div className="p-3 bg-surface-container-low rounded-xl border border-outline flex justify-between items-center">
                    <span className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider">Total Contract Value</span>
                    <span className="text-sm font-black text-primary font-mono">
                      LKR {Number(formData.value).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-center">
                      <p className="text-[9px] font-bold text-amber-400 uppercase tracking-wider">75% Advance</p>
                      <p className="text-xs font-black text-amber-400 font-mono mt-0.5">
                        LKR {(Number(formData.value) * 0.75).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="p-2.5 bg-primary/10 border border-primary/20 rounded-xl text-center">
                      <p className="text-[9px] font-bold text-primary uppercase tracking-wider">25% Final</p>
                      <p className="text-xs font-black text-primary font-mono mt-0.5">
                        LKR {(Number(formData.value) * 0.25).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Direct Print Quick-Actions */}
              <div className="pt-2 border-t border-outline-variant/30 space-y-2">
                <p className="text-[9px] uppercase font-bold text-on-surface-variant tracking-wider text-left">Print Documents</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => printInvoice('Advance')}
                    className="w-full py-2 bg-surface-container-highest/60 border border-outline hover:border-amber-400/40 text-on-surface hover:text-amber-400 rounded-xl text-[10px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Printer size={11} /> 75% Advance
                  </button>
                  <button
                    type="button"
                    onClick={() => printInvoice('Final')}
                    className="w-full py-2 bg-surface-container-highest/60 border border-outline hover:border-emerald-400/40 text-on-surface hover:text-emerald-400 rounded-xl text-[10px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Printer size={11} /> 25% Final
                  </button>
                </div>
              </div>

              {/* Payment status — tied to the real invoice document created via
                  the Line-Item Quote panel's Accept & Convert flow, never to a
                  cached lead-level flag. */}
              <div className="pt-2 border-t border-outline-variant/30 space-y-2">
                <p className="text-[9px] uppercase font-bold text-on-surface-variant tracking-wider text-left">Payment Status</p>
                <div className="grid grid-cols-2 gap-2">
                  {advanceInvoice ? (
                    advanceInvoice.status === 'Paid' ? (
                      <div className="py-2 bg-emerald-500 text-white rounded-xl font-bold text-[10px] shadow-sm flex items-center justify-center gap-1">
                        <Check size={12} />
                        <span>Advance Paid</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onMarkInvoicePaid && onMarkInvoicePaid(lead.id, advanceInvoice._firestoreId || advanceInvoice.id)}
                        className="w-full py-2 bg-primary/10 text-primary hover:bg-primary/20 border border-primary/30 rounded-xl text-[10px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Check size={11} /> Mark Advance Paid
                      </button>
                    )
                  ) : (
                    <div className="py-2 bg-surface-container-high/50 text-on-surface-variant border border-outline-variant/40 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1 text-center px-1">
                      <Clock size={11} className="flex-shrink-0" />
                      <span>Not yet invoiced</span>
                    </div>
                  )}
                  {finalInvoice ? (
                    finalInvoice.status === 'Paid' ? (
                      <div className="py-2 bg-emerald-500 text-white rounded-xl font-bold text-[10px] shadow-sm flex items-center justify-center gap-1">
                        <Check size={12} />
                        <span>Final Paid</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onMarkInvoicePaid && onMarkInvoicePaid(lead.id, finalInvoice._firestoreId || finalInvoice.id)}
                        className="w-full py-2 bg-primary/10 text-primary hover:bg-primary/20 border border-primary/30 rounded-xl text-[10px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Check size={11} /> Mark Final Paid
                      </button>
                    )
                  ) : (
                    <div className="py-2 bg-surface-container-high/50 text-on-surface-variant border border-outline-variant/40 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1 text-center px-1">
                      <Clock size={11} className="flex-shrink-0" />
                      <span>Not yet invoiced</span>
                    </div>
                  )}
                </div>
                {(!advanceInvoice || !finalInvoice) && (
                  <p className="text-[9px] text-on-surface-variant/80 leading-snug pt-0.5">
                    Accept the quote and convert it to an invoice in the Line-Item Quote panel to enable payment tracking here.
                  </p>
                )}

                {/* Generate Receipt — only once the matching invoice is Paid.
                    Hard stop: once a receipt exists for an invoice, show a
                    static confirmation, never a re-clickable button — same
                    pattern used for invoice re-generation in QuotationBuilder. */}
                {(advanceInvoice?.status === 'Paid' || finalInvoice?.status === 'Paid') && (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    {advanceInvoice?.status === 'Paid' && (
                      advanceReceipt ? (
                        <button
                          type="button"
                          onClick={() => printReceipt(advanceReceipt)}
                          title="Print this receipt"
                          className="py-2 bg-surface-container-high/50 text-emerald-400 border border-emerald-400/30 hover:bg-emerald-400/10 rounded-xl text-[9px] font-bold flex items-center justify-center gap-1 text-center px-1 cursor-pointer transition-colors"
                        >
                          <Printer size={11} className="flex-shrink-0" />
                          <span>{advanceReceipt.id}</span>
                        </button>
                      ) : receiptFormFor === 'advance' ? (
                        <div className="col-span-1 p-2 bg-surface-container-high/60 border border-outline rounded-xl space-y-1.5">
                          <input
                            type="number"
                            value={receiptFormData.amountReceived}
                            onChange={(e) => setReceiptFormData(prev => ({ ...prev, amountReceived: e.target.value }))}
                            className="w-full px-2 py-1 bg-surface-container rounded-lg text-[10px] border border-outline-variant"
                            placeholder="Amount"
                          />
                          <select
                            value={receiptFormData.paymentMethod}
                            onChange={(e) => setReceiptFormData(prev => ({ ...prev, paymentMethod: e.target.value }))}
                            className="w-full px-2 py-1 bg-surface-container rounded-lg text-[10px] border border-outline-variant"
                          >
                            <option value="Cash">Cash</option>
                            <option value="Bank Transfer">Bank Transfer</option>
                            <option value="Cheque">Cheque</option>
                            <option value="Card">Card</option>
                          </select>
                          <input
                            type="date"
                            value={receiptFormData.date}
                            onChange={(e) => setReceiptFormData(prev => ({ ...prev, date: e.target.value }))}
                            className="w-full px-2 py-1 bg-surface-container rounded-lg text-[10px] border border-outline-variant"
                          />
                          <div className="flex gap-1">
                            <button type="button" disabled={isGeneratingReceipt} onClick={() => submitReceiptForm(advanceInvoice)} className="flex-1 py-1.5 bg-emerald-500 text-white rounded-lg text-[9px] font-bold cursor-pointer disabled:opacity-60">Confirm</button>
                            <button type="button" onClick={() => setReceiptFormFor(null)} className="flex-1 py-1.5 bg-surface-container text-on-surface-variant rounded-lg text-[9px] font-bold cursor-pointer">Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openReceiptForm('advance', advanceInvoice)}
                          className="w-full py-2 bg-surface-container-highest/60 border border-outline hover:border-emerald-400/40 text-on-surface hover:text-emerald-400 rounded-xl text-[10px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <Receipt size={11} /> Generate Receipt
                        </button>
                      )
                    )}
                    {finalInvoice?.status === 'Paid' && (
                      finalReceipt ? (
                        <button
                          type="button"
                          onClick={() => printReceipt(finalReceipt)}
                          title="Print this receipt"
                          className="py-2 bg-surface-container-high/50 text-emerald-400 border border-emerald-400/30 hover:bg-emerald-400/10 rounded-xl text-[9px] font-bold flex items-center justify-center gap-1 text-center px-1 cursor-pointer transition-colors"
                        >
                          <Printer size={11} className="flex-shrink-0" />
                          <span>{finalReceipt.id}</span>
                        </button>
                      ) : receiptFormFor === 'final' ? (
                        <div className="col-span-1 p-2 bg-surface-container-high/60 border border-outline rounded-xl space-y-1.5">
                          <input
                            type="number"
                            value={receiptFormData.amountReceived}
                            onChange={(e) => setReceiptFormData(prev => ({ ...prev, amountReceived: e.target.value }))}
                            className="w-full px-2 py-1 bg-surface-container rounded-lg text-[10px] border border-outline-variant"
                            placeholder="Amount"
                          />
                          <select
                            value={receiptFormData.paymentMethod}
                            onChange={(e) => setReceiptFormData(prev => ({ ...prev, paymentMethod: e.target.value }))}
                            className="w-full px-2 py-1 bg-surface-container rounded-lg text-[10px] border border-outline-variant"
                          >
                            <option value="Cash">Cash</option>
                            <option value="Bank Transfer">Bank Transfer</option>
                            <option value="Cheque">Cheque</option>
                            <option value="Card">Card</option>
                          </select>
                          <input
                            type="date"
                            value={receiptFormData.date}
                            onChange={(e) => setReceiptFormData(prev => ({ ...prev, date: e.target.value }))}
                            className="w-full px-2 py-1 bg-surface-container rounded-lg text-[10px] border border-outline-variant"
                          />
                          <div className="flex gap-1">
                            <button type="button" disabled={isGeneratingReceipt} onClick={() => submitReceiptForm(finalInvoice)} className="flex-1 py-1.5 bg-emerald-500 text-white rounded-lg text-[9px] font-bold cursor-pointer disabled:opacity-60">Confirm</button>
                            <button type="button" onClick={() => setReceiptFormFor(null)} className="flex-1 py-1.5 bg-surface-container text-on-surface-variant rounded-lg text-[9px] font-bold cursor-pointer">Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openReceiptForm('final', finalInvoice)}
                          className="w-full py-2 bg-surface-container-highest/60 border border-outline hover:border-emerald-400/40 text-on-surface hover:text-emerald-400 rounded-xl text-[10px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <Receipt size={11} /> Generate Receipt
                        </button>
                      )
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 4. Delivery Logistics Dispatch Card for Deals */}
          {(isDeal || lead.isDeal) && (
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-on-surface uppercase tracking-widest flex items-center pb-2 border-b border-outline">
                <Truck size={14} className="mr-2 text-primary" />
                Delivery Logistics
              </h3>

              <div className="p-5 bg-surface-container/50 rounded-2xl border border-outline space-y-3">
                {(() => {
                  const dealJob = (logisticsJobs || []).find(j => j.dealId === lead.id || relatedRecordIds.includes(j.leadId));
                  if (dealJob) {
                    return (
                      <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[9px] font-bold text-on-surface-variant">{dealJob.id}</span>
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                            dealJob.status === 'Completed' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' :
                            dealJob.status === 'In Transit' ? 'text-primary bg-primary/10 border-primary/30 animate-pulse' :
                            'text-amber-400 bg-amber-500/10 border-amber-500/30'
                          }`}>
                            {dealJob.status === 'Completed' ? 'Delivered' : dealJob.status}
                          </span>
                        </div>
                        <p className="text-xs text-on-surface truncate">📍 {dealJob.location || formData.deliveryLocation || 'Customer address'}</p>
                        {dealJob.driver && (
                          <p className="text-[10px] text-on-surface-variant font-medium">Driver: <strong className="text-on-surface">{dealJob.driver}</strong></p>
                        )}
                      </div>
                    );
                  }
                  return (
                    <div className="space-y-3">
                      <p className="text-xs text-on-surface-variant leading-relaxed">
                        Dispatch completed frames to: <strong className="text-on-surface">{formData.deliveryLocation || 'Destination TBD'}</strong>
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          if (onCreateLogistics) {
                            onCreateLogistics({ ...lead, ...formData });
                          }
                        }}
                        className="w-full py-2.5 bg-primary/10 hover:bg-primary text-primary hover:text-on-primary border border-primary/30 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-95 shadow-sm"
                      >
                        <Truck size={14} />
                        <span>Dispatch Delivery</span>
                      </button>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

        </DetailModalSidebar>

      </div>

      {/* Universal Footer */}
      <DetailModalFooter
        secondaryActions={
          !lead.isDeal && !isDeal && !lead.convertedToDeal ? (
            <button 
              type="button"
              onClick={handleConvertClick}
              className="px-4 py-2 bg-secondary text-on-secondary hover:bg-secondary/90 rounded-xl font-bold text-xs transition-all flex items-center space-x-1.5 shadow-sm active:scale-95"
            >
              <Check size={14} />
              <span>Convert to Deal</span>
            </button>
          ) : null
        }
        onClose={handleClose}
        closeText="Cancel"
        primaryActions={
          <button 
            type="button"
            onClick={() => {
              handleSaveLead(formData);
              onClose(); 
            }}
            className="px-6 py-2 bg-primary text-on-primary rounded-xl font-bold text-xs sm:text-sm hover:bg-primary/90 transition-all flex items-center space-x-1.5 shadow-[0_0_15px_rgba(0,218,243,0.2)] active:scale-95"
          >
            <Save size={14} />
            <span>{isDeal || lead.isDeal ? 'Save Deal Details' : 'Save Lead Details'}</span>
          </button>
        }
      />

    </DetailModalLayout>
  );
}

