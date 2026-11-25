import { useState } from 'react';
import {
  BookOpen,
  Check,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FileText,
  LayoutGrid,
  List,
  X,
} from 'lucide-react';
import { formatFileSize, type RoutePath } from '../lib/domain';
import type { StudyMaterial } from '../types';

interface MaterialListProps {
  materials: StudyMaterial[];
  totalLibraryCount: number;
  loading: boolean;
  emptyTitle: string;
  emptyDescription: string;
  query?: string;
  shareRoute?: RoutePath;
  previewItem: StudyMaterial | null;
  onOpenPreview: (item: StudyMaterial) => void;
  onClosePreview: () => void;
  hasActiveFilters?: boolean;
  onResetFilters?: () => void;
}

export function MaterialList({
  materials,
  totalLibraryCount,
  loading,
  emptyTitle,
  emptyDescription,
  query = '',
  shareRoute = '/study-hub',
  previewItem,
  onOpenPreview,
  onClosePreview,
  hasActiveFilters = false,
  onResetFilters,
}: MaterialListProps) {
  const [manualViewMode, setManualViewMode] = useState<'list' | 'grid' | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const effectiveViewMode: 'list' | 'grid' =
    manualViewMode ?? (query.trim().length > 0 ? 'list' : 'grid');

  const handleCopyMaterialLink = async (id: number) => {
    const shareUrl = `${window.location.origin}${shareRoute}?material=${id}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 2000);
    } catch {
      // ignore clipboard denial in headless contexts
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
        <div className="flex flex-wrap items-center gap-3">
          <span className="tabular-nums font-medium text-slate-600">
            Showing {materials.length} of {totalLibraryCount} academic resources
            {query.trim() ? ` for “${query.trim()}”` : ''}
          </span>
          {hasActiveFilters && onResetFilters && (
            <button
              type="button"
              onClick={onResetFilters}
              className="text-teal-700 font-semibold hover:underline cursor-pointer"
            >
              Reset filters
            </button>
          )}
        </div>

        <div className="inline-flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg border border-slate-200">
          <button
            type="button"
            onClick={() => setManualViewMode('list')}
            aria-label="Organized list view"
            className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md cursor-pointer ${
              effectiveViewMode === 'list'
                ? 'bg-white text-[#0F2442] shadow-sm'
                : 'text-slate-600 hover:text-[#0F2442]'
            }`}
          >
            <List className="h-3.5 w-3.5" />
            <span>List</span>
          </button>
          <button
            type="button"
            onClick={() => setManualViewMode('grid')}
            aria-label="Card grid view"
            className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md cursor-pointer ${
              effectiveViewMode === 'grid'
                ? 'bg-white text-[#0F2442] shadow-sm'
                : 'text-slate-600 hover:text-[#0F2442]'
            }`}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            <span>Cards</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-44 bg-white border border-slate-200 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : materials.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center space-y-2">
          <BookOpen className="h-8 w-8 text-slate-400 mx-auto" />
          <h3 className="font-display font-semibold text-lg text-[#0F2442]">{emptyTitle}</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">{emptyDescription}</p>
        </div>
      ) : effectiveViewMode === 'list' ? (
        <ul
          aria-label="Study Hub resources list"
          className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-200"
        >
          {materials.map((item) => (
            <li
              key={item.id}
              className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors"
            >
              <div className="space-y-1.5 min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="font-semibold text-teal-700">{item.program}</span>
                  <span aria-hidden="true">·</span>
                  <span>{item.semesterOrSpec}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-medium text-slate-700">{item.subject}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-semibold text-[#0F2442]">{item.materialType}</span>
                </div>
                <h2 className="font-display font-bold text-base sm:text-lg text-[#0F2442]">
                  <a
                    href={`${shareRoute}?material=${item.id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      onOpenPreview(item);
                    }}
                    className="hover:text-teal-700 hover:underline inline-flex items-center gap-1.5"
                  >
                    <span>{item.title}</span>
                    <ExternalLink className="h-3.5 w-3.5 shrink-0 text-teal-700" />
                  </a>
                </h2>
                <p className="text-sm text-slate-600 line-clamp-2">{item.description}</p>
                <div className="text-xs text-slate-500 flex flex-wrap items-center gap-3 tabular-nums pt-0.5">
                  <span className="inline-flex items-center gap-1">
                    <FileText className="h-3.5 w-3.5 text-slate-400" />
                    <span>{formatFileSize(item.fileSize)}</span>
                  </span>
                  <span>{item.downloads} downloads</span>
                  <span>Uploaded by {item.uploadedBy}</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => void handleCopyMaterialLink(item.id)}
                  aria-label={`Copy link to ${item.title}`}
                  className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  {copiedId === item.id ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-teal-700" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copy Link</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => onOpenPreview(item)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#0F2442] bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span>Preview PDF</span>
                </button>
                <a
                  href={`/api/materials/${item.id}/download`}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download</span>
                </a>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {materials.map((item) => (
            <article
              key={item.id}
              className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between gap-5"
            >
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="font-semibold text-teal-700">{item.program}</span>
                  <span aria-hidden="true">·</span>
                  <span>{item.semesterOrSpec}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-medium text-slate-700">{item.materialType}</span>
                </div>
                <h2 className="font-display font-bold text-lg text-[#0F2442] leading-snug">
                  <a
                    href={`${shareRoute}?material=${item.id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      onOpenPreview(item);
                    }}
                    className="hover:text-teal-700 hover:underline"
                  >
                    {item.title}
                  </a>
                </h2>
                <p className="text-xs font-medium text-slate-500">Subject: {item.subject}</p>
                <p className="text-sm text-slate-600 leading-relaxed">{item.description}</p>
              </div>

              <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-slate-500 flex items-center gap-2 tabular-nums">
                  <FileText className="h-3.5 w-3.5 text-slate-400" />
                  <span>{formatFileSize(item.fileSize)}</span>
                  <span aria-hidden="true">·</span>
                  <span>{item.downloads} downloads</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenPreview(item)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#0F2442] bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span>Preview PDF</span>
                  </button>
                  <a
                    href={`/api/materials/${item.id}/download`}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Download</span>
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {previewItem && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Preview ${previewItem.title}`}
        >
          <div className="bg-white rounded-xl border border-slate-200 w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <h3 className="font-display font-bold text-base text-[#0F2442] truncate">
                  {previewItem.title}
                </h3>
                <p className="text-xs text-slate-500 truncate">
                  {previewItem.program} · {previewItem.semesterOrSpec} · {previewItem.subject}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={`/api/materials/${previewItem.id}/download`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download PDF</span>
                </a>
                <button
                  type="button"
                  onClick={onClosePreview}
                  aria-label="Close PDF preview"
                  className="p-1.5 text-slate-500 hover:text-[#0F2442] rounded-lg hover:bg-slate-100 cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="px-5 py-2 bg-slate-50 border-b border-slate-200 text-xs text-slate-600 flex items-center justify-between gap-2">
              <span className="truncate">{previewItem.description}</span>
              <span className="text-slate-500 shrink-0 hidden sm:inline">
                Use Download PDF if your browser does not display embedded PDFs.
              </span>
            </div>
            <iframe
              src={previewItem.fileUrl}
              title={previewItem.title}
              className="w-full flex-1 bg-slate-100"
            />
          </div>
        </div>
      )}
    </div>
  );
}
