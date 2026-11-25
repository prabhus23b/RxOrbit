import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, FlaskConical, GraduationCap, Search, X } from 'lucide-react';
import { MaterialList } from '../components/MaterialList';
import {
  BPHARM_SEMESTERS,
  filterStudyMaterials,
  MATERIAL_TYPES,
  type RoutePath,
} from '../lib/domain';
import type { CurriculumUnit, MaterialType, ProgramType, StudyMaterial } from '../types';

interface StudyHubPageProps {
  materials: StudyMaterial[];
  curriculumUnits: CurriculumUnit[];
  loading: boolean;
  initialProgram?: ProgramType | 'All';
  initialSearch?: string;
  onNavigate: (path: RoutePath, search?: string) => void;
}

const QUICK_SEARCH_PRESETS = [
  { label: 'Study Notes', query: 'notes' },
  { label: 'Question Papers', query: 'papers' },
  { label: 'Important Questions', query: 'important' },
  { label: 'Reference Material', query: 'reference' },
];

export function StudyHubPage({
  materials,
  curriculumUnits,
  loading,
  initialProgram = 'All',
  initialSearch = '',
  onNavigate,
}: StudyHubPageProps) {
  const [program, setProgram] = useState<ProgramType | 'All'>(initialProgram);
  const [semesterOrSpec, setSemesterOrSpec] = useState<string>('All');
  const [subject, setSubject] = useState<string>('All');
  const [materialType, setMaterialType] = useState<MaterialType | 'All'>('All');
  const [query, setQuery] = useState<string>(() => {
    const params = new URLSearchParams(initialSearch);
    return params.get('q') || '';
  });
  const [previewItem, setPreviewItem] = useState<StudyMaterial | null>(null);

  useEffect(() => {
    if (!initialSearch) return;
    const params = new URLSearchParams(initialSearch);
    const qParam = params.get('q');
    if (qParam !== null) {
      setQuery(qParam);
    }
    const matId = Number(params.get('material'));
    if (matId && materials.length > 0) {
      const found = materials.find((m) => m.id === matId);
      if (found) {
        setPreviewItem(found);
      }
    }
  }, [initialSearch, materials]);

  const bpharmMaterialCount = useMemo(
    () => materials.filter((m) => m.program === 'B.Pharm').length,
    [materials]
  );
  const mpharmMaterialCount = useMemo(
    () => materials.filter((m) => m.program === 'M.Pharm').length,
    [materials]
  );
  const bpharmSubjectCount = useMemo(
    () =>
      curriculumUnits
        .filter((u) => u.program === 'B.Pharm')
        .reduce((acc, u) => acc + u.subjects.length, 0),
    [curriculumUnits]
  );
  const mpharmSpecCount = useMemo(
    () => curriculumUnits.filter((u) => u.program === 'M.Pharm').length,
    [curriculumUnits]
  );

  const semesterOrSpecOptions = useMemo(() => {
    const mpharmSpecs = Array.from(
      new Set([
        ...curriculumUnits.filter((u) => u.program === 'M.Pharm').map((u) => u.name),
        ...materials.filter((m) => m.program === 'M.Pharm').map((m) => m.semesterOrSpec),
      ])
    ).filter(Boolean);

    if (program === 'B.Pharm') return [...BPHARM_SEMESTERS];
    if (program === 'M.Pharm') return mpharmSpecs;
    return [...BPHARM_SEMESTERS, ...mpharmSpecs];
  }, [program, curriculumUnits, materials]);

  const subjectOptions = useMemo(() => {
    const unitSubjects = curriculumUnits
      .filter((u) => program === 'All' || u.program === program)
      .filter((u) => semesterOrSpec === 'All' || u.name === semesterOrSpec)
      .flatMap((u) => u.subjects.map((s) => s.name));

    const materialSubjects = materials
      .filter((m) => program === 'All' || m.program === program)
      .filter((m) => semesterOrSpec === 'All' || m.semesterOrSpec === semesterOrSpec)
      .map((m) => m.subject);

    return Array.from(new Set([...unitSubjects, ...materialSubjects])).filter(Boolean);
  }, [program, semesterOrSpec, curriculumUnits, materials]);

  const filtered = useMemo(
    () =>
      filterStudyMaterials(materials, {
        program,
        semesterOrSpec,
        subject,
        materialType,
        query,
      }),
    [materials, program, semesterOrSpec, subject, materialType, query]
  );

  const handleProgramChange = (next: ProgramType | 'All') => {
    setProgram(next);
    setSemesterOrSpec('All');
    setSubject('All');
  };

  const openMaterialPreview = (item: StudyMaterial) => {
    setPreviewItem(item);
    onNavigate('/study-hub', `?material=${item.id}`);
  };

  const closeMaterialPreview = () => {
    setPreviewItem(null);
    if (initialSearch.includes('material=')) {
      onNavigate('/study-hub');
    }
  };

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-10 space-y-8">
      {/* Header */}
      <div className="space-y-3 border-b border-slate-200 pb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-teal-700">
          Academic Study Hub
        </p>
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div className="space-y-2 max-w-2xl">
            <h1 className="text-3xl font-display font-bold text-[#0F2442]">
              B.Pharm &amp; M.Pharm Resource Library
            </h1>
            <p className="text-slate-600 text-sm sm:text-base">
              Choose B.Pharm or M.Pharm below, or search across all published study notes, PDF
              materials, previous question papers, and reference resources.
            </p>
          </div>
          <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start">
            {(['All', 'B.Pharm', 'M.Pharm'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => handleProgramChange(tab)}
                className={`px-4 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  program === tab
                    ? 'bg-white text-[#0F2442] shadow-sm'
                    : 'text-slate-600 hover:text-[#0F2442]'
                }`}
              >
                {tab === 'All' ? 'All Programs' : tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Two Selectable Program Sections: B.Pharm & M.Pharm */}
      <section aria-label="Pharmacy Degree Programs" className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between gap-5 hover:border-teal-600 transition-colors">
          <div className="space-y-2.5">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-teal-700">
              <GraduationCap className="h-4 w-4" />
              <span>Undergraduate Program</span>
            </div>
            <h2 className="text-2xl font-display font-bold text-[#0F2442]">
              B.Pharm (Bachelor of Pharmacy)
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Organized across Semesters 1–8 with administrator-configured subjects, study notes,
              question papers, and reference PDFs.
            </p>
            <div className="text-xs text-slate-500 tabular-nums pt-1">
              8 Semesters · {bpharmSubjectCount} configured subjects · {bpharmMaterialCount}{' '}
              {bpharmMaterialCount === 1 ? 'resource' : 'resources'}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate('/study-hub/bpharm')}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-[#0F2442] hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              <span>Open B.Pharm Semesters</span>
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => handleProgramChange(program === 'B.Pharm' ? 'All' : 'B.Pharm')}
              className="px-3.5 py-2.5 text-xs font-semibold text-[#0F2442] bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              {program === 'B.Pharm' ? 'Showing B.Pharm Below' : 'Filter Below'}
            </button>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between gap-5 hover:border-teal-600 transition-colors">
          <div className="space-y-2.5">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-teal-700">
              <FlaskConical className="h-4 w-4" />
              <span>Postgraduate Program</span>
            </div>
            <h2 className="text-2xl font-display font-bold text-[#0F2442]">
              M.Pharm (Master of Pharmacy)
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Organized by postgraduate pharmacy specializations and research subjects configured by
              RxOrbit administrators.
            </p>
            <div className="text-xs text-slate-500 tabular-nums pt-1">
              {mpharmSpecCount} configured specializations · {mpharmMaterialCount}{' '}
              {mpharmMaterialCount === 1 ? 'resource' : 'resources'}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate('/study-hub/mpharm')}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors cursor-pointer"
            >
              <span>Open M.Pharm Specializations</span>
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => handleProgramChange(program === 'M.Pharm' ? 'All' : 'M.Pharm')}
              className="px-3.5 py-2.5 text-xs font-semibold text-[#0F2442] bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              {program === 'M.Pharm' ? 'Showing M.Pharm Below' : 'Filter Below'}
            </button>
          </div>
        </div>
      </section>

      {/* Quick Semester / Specialization Strip */}
      {program !== 'All' && (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-500">
            {program === 'B.Pharm' ? 'Select B.Pharm Semester' : 'Select M.Pharm Specialization'}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setSemesterOrSpec('All');
                setSubject('All');
              }}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                semesterOrSpec === 'All'
                  ? 'bg-[#0F2442] text-white border-[#0F2442]'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
              }`}
            >
              All {program === 'B.Pharm' ? 'Semesters' : 'Specializations'}
            </button>
            {semesterOrSpecOptions.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  setSemesterOrSpec(opt);
                  setSubject('All');
                }}
                className={`px-3.5 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                  semesterOrSpec === opt
                    ? 'bg-teal-700 text-white border-teal-700'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search & Filter Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <label htmlFor="study-search" className="sr-only">
              Search study materials by keyword, subject, or type
            </label>
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="study-search"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search keywords, subjects, notes, papers..."
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
            <label htmlFor="study-sem-filter" className="sr-only">
              Filter by Semester or Specialization
            </label>
            <select
              id="study-sem-filter"
              value={semesterOrSpec}
              onChange={(e) => {
                setSemesterOrSpec(e.target.value);
                setSubject('All');
              }}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-teal-600"
            >
              <option value="All">All Semesters / Specializations</option>
              {semesterOrSpecOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="study-subject-filter" className="sr-only">
              Filter by Subject
            </label>
            <select
              id="study-subject-filter"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-teal-600"
            >
              <option value="All">All Subjects</option>
              {subjectOptions.map((sub) => (
                <option key={sub} value={sub}>
                  {sub}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="study-type-filter" className="sr-only">
              Filter by Material Type
            </label>
            <select
              id="study-type-filter"
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

        {/* Quick Search Shortcuts */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Quick Search:
          </span>
          {QUICK_SEARCH_PRESETS.map((preset) => {
            const active = query.trim().toLowerCase() === preset.query;
            return (
              <button
                key={preset.query}
                type="button"
                onClick={() => setQuery(active ? '' : preset.query)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-colors cursor-pointer ${
                  active
                    ? 'bg-teal-700 text-white border-teal-700'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-teal-600 hover:text-teal-700'
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Materials Display */}
      <MaterialList
        materials={filtered}
        totalLibraryCount={materials.length}
        loading={loading}
        query={query}
        shareRoute="/study-hub"
        previewItem={previewItem}
        onOpenPreview={openMaterialPreview}
        onClosePreview={closeMaterialPreview}
        hasActiveFilters={
          program !== 'All' ||
          semesterOrSpec !== 'All' ||
          subject !== 'All' ||
          materialType !== 'All' ||
          Boolean(query)
        }
        onResetFilters={() => {
          setProgram('All');
          setSemesterOrSpec('All');
          setSubject('All');
          setMaterialType('All');
          setQuery('');
        }}
        emptyTitle={
          materials.length === 0
            ? 'No study materials available yet.'
            : 'No study materials match your current filter'
        }
        emptyDescription={
          materials.length === 0
            ? 'Study materials uploaded by RxOrbit administrators will appear here.'
            : 'Try clearing your search query or switching semesters/specializations.'
        }
      />
    </div>
  );
}
