import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, GraduationCap, Search, X } from 'lucide-react';
import { MaterialList } from '../components/MaterialList';
import {
  BPHARM_SEMESTERS,
  filterStudyMaterials,
  MATERIAL_TYPES,
  type RoutePath,
} from '../lib/domain';
import type { CurriculumUnit, MaterialType, StudyMaterial } from '../types';

interface BPharmPageProps {
  materials: StudyMaterial[];
  curriculumUnits: CurriculumUnit[];
  loading: boolean;
  initialSearch?: string;
  onNavigate: (path: RoutePath, search?: string) => void;
}

export function BPharmPage({
  materials,
  curriculumUnits,
  loading,
  initialSearch = '',
  onNavigate,
}: BPharmPageProps) {
  const [selectedSemester, setSelectedSemester] = useState<string>('Semester 1');
  const [selectedSubject, setSelectedSubject] = useState<string>('All');
  const [materialType, setMaterialType] = useState<MaterialType | 'All'>('All');
  const [query, setQuery] = useState<string>('');
  const [previewItem, setPreviewItem] = useState<StudyMaterial | null>(null);

  const bpharmMaterials = useMemo(
    () => materials.filter((m) => m.program === 'B.Pharm'),
    [materials]
  );

  const bpharmUnits = useMemo(
    () => curriculumUnits.filter((u) => u.program === 'B.Pharm'),
    [curriculumUnits]
  );

  useEffect(() => {
    if (!initialSearch) return;
    const params = new URLSearchParams(initialSearch);
    const semParam = params.get('semester');
    if (semParam && (semParam === 'All' || BPHARM_SEMESTERS.includes(semParam))) {
      setSelectedSemester(semParam);
    }
    const qParam = params.get('q');
    if (qParam !== null) {
      setQuery(qParam);
    }
    const matId = Number(params.get('material'));
    if (matId && bpharmMaterials.length > 0) {
      const found = bpharmMaterials.find((m) => m.id === matId);
      if (found) {
        setSelectedSemester(found.semesterOrSpec);
        setPreviewItem(found);
      }
    }
  }, [initialSearch, bpharmMaterials]);

  const activeUnit = useMemo(
    () => bpharmUnits.find((u) => u.name === selectedSemester),
    [bpharmUnits, selectedSemester]
  );

  const subjectsForSemester = useMemo(() => {
    const configured = activeUnit?.subjects.map((s) => s.name) || [];
    const fromMaterials = bpharmMaterials
      .filter((m) => selectedSemester === 'All' || m.semesterOrSpec === selectedSemester)
      .map((m) => m.subject);
    return Array.from(new Set([...configured, ...fromMaterials]));
  }, [activeUnit, bpharmMaterials, selectedSemester]);

  const filtered = useMemo(
    () =>
      filterStudyMaterials(bpharmMaterials, {
        program: 'B.Pharm',
        semesterOrSpec: selectedSemester,
        subject: selectedSubject,
        materialType,
        query,
      }),
    [bpharmMaterials, selectedSemester, selectedSubject, materialType, query]
  );

  const handleSelectSemester = (sem: string) => {
    setSelectedSemester(sem);
    setSelectedSubject('All');
  };

  const openMaterialPreview = (item: StudyMaterial) => {
    setPreviewItem(item);
    onNavigate('/study-hub/bpharm', `?material=${item.id}`);
  };

  const closeMaterialPreview = () => {
    setPreviewItem(null);
    if (initialSearch.includes('material=')) {
      onNavigate('/study-hub/bpharm');
    }
  };

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-10 space-y-8">
      {/* Breadcrumb & Header */}
      <div className="space-y-4 border-b border-slate-200 pb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => onNavigate('/study-hub')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700 hover:underline cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Study Hub</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('/study-hub/mpharm')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0F2442] hover:text-teal-700 cursor-pointer"
          >
            <span>Switch to M.Pharm Study Hub</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="space-y-2 max-w-3xl">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-teal-700">
            <GraduationCap className="h-4 w-4" />
            <span>Bachelor of Pharmacy (B.Pharm)</span>
          </div>
          <h1 className="text-3xl font-display font-bold text-[#0F2442]">
            B.Pharm Semester-Wise Study Hub
          </h1>
          <p className="text-slate-600 text-sm sm:text-base">
            Select any semester from Semester 1 to Semester 8 below. Subjects and study materials
            appear here as configured and published by RxOrbit administrators.
          </p>
        </div>
      </div>

      {/* Eight Semester Selection Grid */}
      <section aria-label="B.Pharm Semester Selection" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-display font-bold text-[#0F2442]">
            Select Semester (Semesters 1–8)
          </h2>
          <button
            type="button"
            onClick={() => handleSelectSemester('All')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
              selectedSemester === 'All'
                ? 'bg-[#0F2442] text-white border-[#0F2442]'
                : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
            }`}
          >
            All 8 Semesters ({bpharmMaterials.length})
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
          {BPHARM_SEMESTERS.map((sem) => {
            const unit = bpharmUnits.find((u) => u.name === sem);
            const subjectCount = unit?.subjects.length ?? 0;
            const matCount = bpharmMaterials.filter((m) => m.semesterOrSpec === sem).length;
            const active = selectedSemester === sem;

            return (
              <button
                key={sem}
                type="button"
                onClick={() => handleSelectSemester(sem)}
                aria-pressed={active}
                className={`p-3 rounded-xl border text-left transition-colors cursor-pointer space-y-1 ${
                  active
                    ? 'bg-[#0F2442] text-white border-[#0F2442]'
                    : 'bg-white text-[#0F2442] border-slate-200 hover:border-teal-600'
                }`}
              >
                <div className="font-display font-bold text-sm">{sem}</div>
                <div
                  className={`text-[11px] tabular-nums ${
                    active ? 'text-teal-200' : 'text-slate-500'
                  }`}
                >
                  {subjectCount} {subjectCount === 1 ? 'subject' : 'subjects'} · {matCount}{' '}
                  {matCount === 1 ? 'file' : 'files'}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Configured Subjects for Selected Semester */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display font-bold text-base text-[#0F2442]">
            {selectedSemester === 'All'
              ? 'Configured B.Pharm Subjects'
              : `${selectedSemester} — Configured Subjects`}
          </h2>
          {selectedSubject !== 'All' && (
            <button
              type="button"
              onClick={() => setSelectedSubject('All')}
              className="text-xs font-semibold text-teal-700 hover:underline cursor-pointer"
            >
              Show all subjects
            </button>
          )}
        </div>

        {subjectsForSemester.length === 0 ? (
          <div className="py-4 px-4 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm text-slate-600 flex items-center gap-2.5">
            <BookOpen className="h-4 w-4 text-slate-400 shrink-0" />
            <span>
              No subjects configured for {selectedSemester === 'All' ? 'B.Pharm' : selectedSemester}{' '}
              yet. Administrators can configure semester subjects from the Admin Console.
            </span>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSelectedSubject('All')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                selectedSubject === 'All'
                  ? 'bg-teal-700 text-white border-teal-700'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-teal-600'
              }`}
            >
              All Subjects
            </button>
            {subjectsForSemester.map((sub) => {
              const unitSubject = activeUnit?.subjects.find((s) => s.name === sub);
              const active = selectedSubject === sub;
              return (
                <button
                  key={sub}
                  type="button"
                  onClick={() => setSelectedSubject(active ? 'All' : sub)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                    active
                      ? 'bg-teal-700 text-white border-teal-700'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-teal-600'
                  }`}
                >
                  {unitSubject?.code ? `${unitSubject.code} · ${sub}` : sub}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Search & Resource Type Filter */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="relative">
          <label htmlFor="bpharm-search" className="sr-only">
            Search B.Pharm study materials
          </label>
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="bpharm-search"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search B.Pharm titles, subjects, notes, or papers..."
            className="w-full pl-9 pr-8 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search query"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#0F2442] cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div>
          <label htmlFor="bpharm-type-filter" className="sr-only">
            Filter by material type
          </label>
          <select
            id="bpharm-type-filter"
            value={materialType}
            onChange={(e) => setMaterialType(e.target.value as MaterialType | 'All')}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-teal-600"
          >
            <option value="All">All Resource Types</option>
            {MATERIAL_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Materials Display */}
      <MaterialList
        materials={filtered}
        totalLibraryCount={bpharmMaterials.length}
        loading={loading}
        query={query}
        shareRoute="/study-hub/bpharm"
        previewItem={previewItem}
        onOpenPreview={openMaterialPreview}
        onClosePreview={closeMaterialPreview}
        hasActiveFilters={selectedSubject !== 'All' || materialType !== 'All' || Boolean(query)}
        onResetFilters={() => {
          setSelectedSubject('All');
          setMaterialType('All');
          setQuery('');
        }}
        emptyTitle={
          bpharmMaterials.length === 0
            ? 'No study materials available yet.'
            : `No study materials available for ${selectedSemester} yet.`
        }
        emptyDescription={
          bpharmMaterials.length === 0
            ? 'Study notes, PDF materials, and previous question papers uploaded by RxOrbit administrators will appear here.'
            : 'Select another B.Pharm semester or reset your active filters.'
        }
      />
    </div>
  );
}
