import React from 'react';
import {
  Upload,
  CheckCircle2,
  AlertCircle,
  Maximize2,
  X,
  FileSpreadsheet,
  Folder,
  Loader2,
  ChevronUp,
} from 'lucide-react';
import { useScoreUpload } from '../context/ScoreUploadContext';

export function MinimizedScoreUploadWidget() {
  const {
    isMinimized,
    isUploading,
    progress,
    status,
    summary,
    restoreModal,
    dismissSummary,
  } = useScoreUpload();

  // Only show if minimized or if an upload is ongoing/recently finished with a summary
  if (!isMinimized && !summary) {
    return null;
  }

  // If not minimized and not uploading, do not show
  if (!isMinimized && !isUploading && status !== 'completed' && status !== 'error') {
    return null;
  }

  const isCompleted = status === 'completed';
  const isError = status === 'error';

  return (
    <aside
      aria-label="Background upload status"
      className="fixed bottom-4 right-4 z-[999999] max-w-sm sm:max-w-md w-[calc(100vw-2rem)] animate-in fade-in slide-in-from-bottom-5 duration-300 pointer-events-auto"
    >
      <div
        className={`rounded-2xl border bg-white/95 backdrop-blur-md shadow-2xl p-3.5 sm:p-4 transition-all ${
          isUploading
            ? 'border-teal-400/80 ring-4 ring-teal-500/10'
            : isCompleted
            ? 'border-emerald-300 ring-4 ring-emerald-500/10'
            : isError
            ? 'border-rose-300 ring-4 ring-rose-500/10'
            : 'border-slate-300'
        }`}
      >
        {/* Header Row */}
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                isUploading
                  ? 'bg-teal-100 text-teal-700'
                  : isCompleted
                  ? 'bg-emerald-100 text-emerald-700'
                  : isError
                  ? 'bg-rose-100 text-rose-700'
                  : 'bg-slate-100 text-slate-700'
              }`}
            >
              {isUploading ? (
                <Loader2 size={16} className="animate-spin text-teal-600" />
              ) : isCompleted ? (
                <CheckCircle2 size={16} className="text-emerald-600" />
              ) : isError ? (
                <AlertCircle size={16} className="text-rose-600" />
              ) : (
                <FileSpreadsheet size={16} className="text-slate-600" />
              )}
            </div>

            <div className="min-w-0">
              <h4 className="text-xs font-black text-slate-900 truncate flex items-center gap-1.5">
                {isUploading ? (
                  <span>Uploading in Background...</span>
                ) : isCompleted ? (
                  <span className="text-emerald-800">Score Import Complete!</span>
                ) : isError ? (
                  <span className="text-rose-800">Upload Errors Detected</span>
                ) : (
                  <span>Score Upload Staged</span>
                )}
                <span
                  className={`text-[9px] font-black uppercase px-1.5 py-0.2 rounded-full border ${
                    isUploading
                      ? 'bg-teal-50 text-teal-800 border-teal-200'
                      : isCompleted
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  {isUploading ? `${progress.percent}%` : isCompleted ? 'Success' : 'Ready'}
                </span>
              </h4>
              <p className="text-[10px] text-slate-500 font-medium truncate flex items-center gap-1 mt-0.5">
                <FileSpreadsheet size={10} className="shrink-0 text-slate-400" />
                <span className="truncate">{summary?.fileName || 'CSV File'}</span>
                <span>&bull;</span>
                <Folder size={10} className="shrink-0 text-slate-400" />
                <span className="truncate">{summary?.folderName || 'Main Folder'}</span>
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={restoreModal}
              className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Expand / Open full score upload dialog"
            >
              <Maximize2 size={14} />
            </button>
            {!isUploading && (
              <button
                type="button"
                onClick={dismissSummary}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                title="Dismiss notification"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Progress Bar Track */}
        <div className="space-y-1.5">
          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200/80">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                isUploading
                  ? 'bg-gradient-to-r from-teal-500 to-emerald-500 animate-pulse'
                  : isCompleted
                  ? 'bg-emerald-500'
                  : isError
                  ? 'bg-rose-500'
                  : 'bg-slate-300'
              }`}
              style={{ width: `${isUploading ? progress.percent : isCompleted ? 100 : 0}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[10px] font-bold text-slate-500">
            <span>
              {isUploading
                ? `Processed ${progress.current} of ${progress.total} reviewees`
                : isCompleted
                ? `${summary?.successCount || progress.total} records updated successfully`
                : 'Upload queued'}
            </span>
            <button
              type="button"
              onClick={restoreModal}
              className="text-teal-700 hover:text-teal-900 font-extrabold flex items-center gap-0.5 cursor-pointer"
            >
              <span>View Details</span>
              <ChevronUp size={11} />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
