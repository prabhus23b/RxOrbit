import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, FlaskConical, Search, X } from 'lucide-react';
import { MaterialList } from '../components/MaterialList';
import { filterStudyMaterials, MATERIAL_TYPES, type RoutePath } from '../lib/domain';
import type { CurriculumUnit, MaterialType, StudyMaterial } from '../types';

interface MPharmPageProps {
  materials: StudyMaterial[];
  curriculumUnits: CurriculumUnit[];
  loading: boolean;
  initialSearch?: string;
  onNavigate: (path: RoutePath, search?: string) => void;
}

export function MPharmPage({
  materials,
  curriculumUnits,
  loading,
  initialSearch = '',
  onNavigate,
}: MPharmPageProps) {
  const [selectedSpec, setSelectedSpec] = useState<string>('All');
  const [selectedSubject, setSelectedSubject] = useState<string>('All');
  const [materialType, setMaterialType] = useState<MaterialType | 'All'>('All');
  const [query, setQuery] = useState<string>('');
  const [previewItem, setPreviewItem] = useState<StudyMaterial | null>(null);

  const mpharmMaterials = useMemo(
    () => materials.filter((m) => m.program === 'M.Pharm'),
    [materials]
  );

  const mpharmUnits = useMemo(
    () => curriculumUnits.filter((u) => u.program === 'M.Pharm'),
    [curriculumUnits]
  );

  const specializations = useMemo(() => {
    const unitNames = mpharmUnits.map((u) => u.name);
    const matSpecs = mpharmMaterials.map((m) => m.semesterOrSpec);
    return Array.from(new Set([...unitNames, ...matSpecs])).filter(Boolean);
  }, [mpharmUnits, mpharmMaterials]);

  useEffect(() => {
    if (!initialSearch) return;
    const params = new URLSearchParams(initialSearch);
    const specParam = params.get('spec');
    if (specParam) {
      setSelectedSpec(specParam);
    }
    const qParam = params.get('q');
    if (qParam !== null) {
      setQuery(qParam);
    }
    const matId = Number(params.get('material'));
    if (matId && mpharmMaterials.length > 0) {
      const found = mpharmMaterials.find((m) => m.id === matId);
      if (found) {
        setSelectedSpec(found.semesterOrSpec);
        setPreviewItem(found);
      }
    }
  }, [initialSearch, mpharmMaterials]);

  const subjectsForSpec = useMemo(() => {
    const configured = mpharmUnits
      .filter((u) => selectedSpec === 'All' || u.name === selectedSpec)
      .flatMap((u) => u.subjects.map((s) => s.name));
    const fromMaterials = mpharmMaterials
      .filter((m) => selectedSpec === 'All' || m.semesterOrSpec === selectedSpec)
      .map((m) => m.subject);
    return Array.from(new Set([...configured, ...fromMaterials]));
  }, [mpharmUnits, mpharmMaterials, selectedSpec]);

  const filtered = useMemo(
    () =>
      filterStudyMaterials(mpharmMaterials, {
        program: 'M.Pharm',
        semesterOrSpec: selectedSpec,
        subject: selectedSubject,
        materialType,
        query,
      }),
    [mpharmMaterials, selectedSpec, selectedSubject, materialType, query]
  );

  const openMaterialPreview = (item: StudyMaterial) => {
    setPreviewItem(item);
    onNavigate('/study-hub/mpharm', `?material=${item.id}`);
  };

  const closeMaterialPreview = () => {
    setPreviewItem(null);
    if (initialSearch.includes('material=')) {
      onNavigate('/study-hub/mpharm');
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
            onClick={() => onNavigate('/study-hub/bpharm')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0F2442] hover:text-teal-700 cursor-pointer"
          >
            <span>Switch to B.Pharm Study Hub</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="space-y-2 max-w-3xl">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-teal-700">
            <FlaskConical className="h-4 w-4" />
            <span>Master of Pharmacy (M.Pharm)</span>
          </div>
          <h1 className="text-3xl font-display font-bold text-[#0F2442]">
            M.Pharm Specialization Study Hub
          </h1>
          <p className="text-slate-600 text-sm sm:text-base">
            Explore postgraduate M.Pharmacy specializations, subjects, and reference PDFs added by
            RxOrbit administrators.
          </p>
        </div>
      </div>

      {/* Specializations Section */}
      <section aria-label="M.Pharm Specializations" className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display font-bold text-lg text-[#0F2442]">
            Available M.Pharm Specializations
          </h2>
          {specializations.length > 0 && selectedSpec !== 'All' && (
            <button
              type="button"
              onClick={() => {
                setSelectedSpec('All');
                setSelectedSubject('All');
              }}
              className="text-xs font-semibold text-teal-700 hover:underline cursor-pointer"
            >
              Show all specializations
            </button>
          )}
        </div>

        {specializations.length === 0 ? (
          <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl text-center space-y-1.5">
            <BookOpen className="h-7 w-7 text-slate-400 mx-auto" />
            <h3 className="font-display font-semibold text-base text-[#0F2442]">
              No M.Pharm specializations configured yet.
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 max-w-lg mx-auto">
              Specializations, subjects, and postgraduate study resources will appear here once
              added by the RxOrbit administrator.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedSpec('All');
                  setSelectedSubject('All');
                }}
                className={`px-3.5 py-2 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                  selectedSpec === 'All'
                    ? 'bg-[#0F2442] text-white border-[#0F2442]'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-teal-600'
                }`}
              >
                All Specializations ({mpharmMaterials.length})
              </button>
              {specializations.map((spec) => {
                const count = mpharmMaterials.filter((m) => m.semesterOrSpec === spec).length;
                const active = selectedSpec === spec;
                return (
                  <button
                    key={spec}
                    type="button"
                    onClick={() => {
                      setSelectedSpec(spec);
                      setSelectedSubject('All');
                    }}
                    className={`px-3.5 py-2 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                      active
                        ? 'bg-teal-700 text-white border-teal-700'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-teal-600'
                    }`}
                  >
                    {spec} ({count})
                  </button>
                );
              })}
            </div>

            {subjectsForSpec.length > 0 && (
              <div className="pt-3 border-t border-slate-100 space-y-2">
                <div className="text-xs font-semibold text-slate-500">
                  Configured Subjects
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedSubject('All')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border cursor-pointer ${
                      selectedSubject === 'All'
                        ? 'bg-teal-700 text-white border-teal-700'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    All Subjects
                  </button>
                  {subjectsForSpec.map((sub) => (
                    <button
                      key={sub}
                      type="button"
                      onClick={() => setSelectedSubject(selectedSubject === sub ? 'All' : sub)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg border cursor-pointer ${
                        selectedSubject === sub
                          ? 'bg-teal-700 text-white border-teal-700'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-teal-600'
                      }`}
                    >
                      {sub}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Search & Resource Type Filter */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="relative">
          <label htmlFor="mpharm-search" className="sr-only">
            Search M.Pharm study materials
          </label>
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="mpharm-search"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search M.Pharm titles, specializations, or reference PDFs..."
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
          <label htmlFor="mpharm-type-filter" className="sr-only">
            Filter by material type
          </label>
          <select
            id="mpharm-type-filter"
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
        totalLibraryCount={mpharmMaterials.length}
        loading={loading}
        query={query}
        shareRoute="/study-hub/mpharm"
        previewItem={previewItem}
        onOpenPreview={openMaterialPreview}
        onClosePreview={closeMaterialPreview}
        hasActiveFilters={
          selectedSpec !== 'All' ||
          selectedSubject !== 'All' ||
          materialType !== 'All' ||
          Boolean(query)
        }
        onResetFilters={() => {
          setSelectedSpec('All');
          setSelectedSubject('All');
          setMaterialType('All');
          setQuery('');
        }}
        emptyTitle="No study materials available yet."
        emptyDescription="Postgraduate M.Pharm notes and reference materials uploaded by RxOrbit administrators will appear here."
      />
    </div>
  );
}
