import React, { useState, useEffect } from 'react';
import { HardDrive, X, FileText, Image, Check, Search, ExternalLink, AlertCircle, RefreshCw } from 'lucide-react';
import { fetchUserDriveFiles } from '../../services/driveService';
import { ModalWrapper } from './ui';
import { toast } from '../../utils/toast';

export default function GoogleDrivePickerModal({ isOpen, onClose, onSelectFile }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);

  useEffect(() => {
    if (isOpen) {
      loadFiles();
    }
  }, [isOpen]);

  const loadFiles = async () => {
    setLoading(true);
    setError(null);
    try {
      const driveFiles = await fetchUserDriveFiles();
      setFiles(driveFiles);
    } catch (err) {
      setError(err.message || 'Failed to load Google Drive files. Please ensure Google Sign-In with Drive permissions is active.');
    } finally {
      setLoading(false);
    }
  };

  const filteredFiles = files.filter(f =>
    f.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <ModalWrapper
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="max-w-3xl"
      height="h-[95dvh] sm:h-[88vh] max-h-[860px]"
      ariaLabel="Google Drive File Picker"
    >
      {/* Header */}
      <div className="px-5 sm:px-6 py-4 border-b border-outline-variant bg-surface-container-low flex items-center justify-between flex-shrink-0">
        <div className="flex items-center space-x-3 min-w-0">
          <div className="p-2 bg-primary/10 text-primary rounded-xl border border-primary/20 flex-shrink-0">
            <HardDrive size={22} />
          </div>
          <div className="min-w-0">
            <h3 className="text-base sm:text-lg font-black text-on-surface truncate">
              Google Drive Integration
            </h3>
            <p className="text-[10px] sm:text-xs font-bold text-on-surface-variant uppercase tracking-widest mt-0.5 truncate">
              Attach Digital Art Files & CAD Proofs
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 text-on-surface-variant hover:text-on-surface bg-surface-container-high rounded-full border border-outline-variant/60 transition-colors cursor-pointer"
          title="Close Modal"
        >
          <X size={18} />
        </button>
      </div>

      {/* Search & Actions */}
      <div className="p-3 sm:p-4 bg-surface-container-low border-b border-outline-variant flex items-center gap-2 flex-shrink-0">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 text-on-surface-variant" size={16} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Google Drive files (CAD, PNG, PDF, TIFF)..."
            className="w-full bg-surface-container border border-outline-variant/60 rounded-xl pl-9 pr-4 py-2 text-xs sm:text-sm text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>
        <button
          onClick={loadFiles}
          disabled={loading}
          className="px-3.5 py-2 bg-surface-container-high hover:bg-surface-container-highest border border-outline-variant/60 text-on-surface text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {/* Content Body */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
        {loading ? (
          <div className="py-20 text-center text-on-surface-variant">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-3"></div>
            <p className="text-xs sm:text-sm font-medium">Connecting to Google Drive Workspace...</p>
          </div>
        ) : error ? (
          <div className="py-10 px-5 text-center bg-error/10 border border-error/30 rounded-2xl my-2">
            <AlertCircle className="text-error mx-auto mb-2" size={32} />
            <p className="text-sm font-bold text-error mb-1">Google Drive Access Required</p>
            <p className="text-xs text-on-surface-variant mb-4 max-w-md mx-auto">{error}</p>
            <button
              onClick={loadFiles}
              className="px-5 py-2.5 bg-primary text-on-primary text-xs font-bold rounded-xl hover:bg-primary/90 transition-all cursor-pointer"
            >
              Retry Connection
            </button>
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="py-20 text-center text-on-surface-variant">
            <HardDrive className="mx-auto mb-3 opacity-30" size={44} />
            <p className="text-sm font-bold">No files found in Google Drive.</p>
            <p className="text-xs text-on-surface-variant/70 mt-1">Upload CAD drawings or images to your Google Drive and hit Refresh.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {filteredFiles.map(file => {
              const isSelected = selectedFile?.id === file.id;
              const isImage = file.mimeType?.includes('image');
              return (
                <div
                  key={file.id}
                  onClick={() => setSelectedFile(file)}
                  className={`p-3 sm:p-3.5 rounded-xl border transition-all cursor-pointer flex items-center space-x-3 ${
                    isSelected
                      ? 'bg-primary/15 border-primary shadow-sm ring-1 ring-primary'
                      : 'bg-surface-container-low border-outline-variant/60 hover:bg-surface-container-high/60 text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  <div className="p-2.5 rounded-xl bg-surface-container-high border border-outline-variant/50 text-primary flex-shrink-0">
                    {isImage ? <Image size={18} /> : <FileText size={18} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-bold text-on-surface truncate">{file.name}</p>
                    <p className="text-[10px] text-on-surface-variant capitalize truncate mt-0.5">
                      {file.mimeType?.split('.').pop() || 'File'}
                    </p>
                  </div>
                  {isSelected && (
                    <div className="w-5 h-5 rounded-full bg-primary text-on-primary flex items-center justify-center flex-shrink-0">
                      <Check size={12} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 sm:px-6 py-4 border-t border-outline-variant flex flex-col sm:flex-row items-center justify-between gap-3 bg-surface-container-low flex-shrink-0">
        <div className="text-xs text-on-surface-variant truncate max-w-sm text-center sm:text-left">
          {selectedFile ? (
            <span>Selected: <strong className="text-primary">{selectedFile.name}</strong></span>
          ) : (
            'Select an engineering blueprint or art file to attach'
          )}
        </div>
        <div className="flex space-x-2.5 w-full sm:w-auto justify-end">
          <button
            onClick={onClose}
            className="flex-1 sm:flex-none px-4 py-2.5 border border-outline-variant/60 rounded-xl text-xs sm:text-sm font-bold text-on-surface hover:bg-surface-container-high transition-colors"
          >
            Cancel
          </button>
          <button
            disabled={!selectedFile}
            onClick={() => {
              if (selectedFile) {
                onSelectFile(selectedFile);
                onClose();
              }
            }}
            className="flex-1 sm:flex-none px-5 py-2.5 bg-primary text-on-primary font-bold text-xs sm:text-sm rounded-xl hover:bg-primary/90 transition-all shadow-sm active:scale-95 disabled:opacity-40 flex items-center justify-center space-x-1.5 cursor-pointer"
          >
            <Check size={14} />
            <span>Attach to Quote</span>
          </button>
        </div>
      </div>
    </ModalWrapper>
  );
}
