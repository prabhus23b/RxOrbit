import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, FolderOpen, Image as ImageIcon, X } from 'lucide-react';
import { SafeImage } from '../components/SafeImage';
import { GALLERY_CATEGORIES } from '../lib/domain';
import type { GalleryAlbum, GalleryPhoto } from '../types';

interface GalleryPageProps {
  albums: GalleryAlbum[];
  photos: GalleryPhoto[];
  loading: boolean;
}

export function GalleryPage({ albums, photos, loading }: GalleryPageProps) {
  const [selectedAlbumId, setSelectedAlbumId] = useState<number | 'all'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const visiblePhotos = useMemo(() => {
    return photos.filter((p) => {
      if (selectedAlbumId !== 'all' && p.albumId !== selectedAlbumId) return false;
      if (selectedCategory !== 'All' && p.category !== selectedCategory) return false;
      return true;
    });
  }, [photos, selectedAlbumId, selectedCategory]);

  useEffect(() => {
    if (lightboxIndex === null) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxIndex(null);
      if (e.key === 'ArrowRight') {
        setLightboxIndex((prev) =>
          prev === null ? null : (prev + 1) % visiblePhotos.length
        );
      }
      if (e.key === 'ArrowLeft') {
        setLightboxIndex((prev) =>
          prev === null ? null : (prev - 1 + visiblePhotos.length) % visiblePhotos.length
        );
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [lightboxIndex, visiblePhotos.length]);

  const activePhoto =
    lightboxIndex !== null && visiblePhotos[lightboxIndex]
      ? visiblePhotos[lightboxIndex]
      : null;

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-10 space-y-10">
      <div className="space-y-2 border-b border-slate-200 pb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-teal-700">
          Community Gallery
        </p>
        <h1 className="text-3xl font-display font-bold text-[#0F2442]">
          Albums &amp; Event Highlights
        </h1>
        <p className="text-slate-600 text-sm sm:text-base max-w-2xl">
          Visual archives from RxOrbit webinars, formulation workshops, seminars, conferences, and
          student coordinator initiatives.
        </p>
      </div>

      {/* Album Selector */}
      {albums.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#0F2442] flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-teal-700" />
              <span>Albums</span>
            </h2>
            {selectedAlbumId !== 'all' && (
              <button
                type="button"
                onClick={() => setSelectedAlbumId('all')}
                className="text-xs font-semibold text-teal-700 hover:underline cursor-pointer"
              >
                Show all albums
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {albums.map((alb) => {
              const active = selectedAlbumId === alb.id;
              return (
                <button
                  key={alb.id}
                  type="button"
                  onClick={() => setSelectedAlbumId(active ? 'all' : alb.id)}
                  className={`text-left rounded-xl border overflow-hidden transition-colors cursor-pointer ${
                    active
                      ? 'border-teal-700 ring-2 ring-teal-700/20 bg-white'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="aspect-[16/9] bg-slate-100 overflow-hidden">
                    <SafeImage
                      src={alb.coverUrl}
                      alt={alb.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-4 space-y-1">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span className="font-semibold text-teal-700">{alb.category}</span>
                      <span className="font-mono tabular-nums">{alb.eventDate}</span>
                    </div>
                    <h3 className="font-display font-bold text-base text-[#0F2442]">{alb.title}</h3>
                    <p className="text-xs text-slate-600 line-clamp-2">{alb.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Category Filter Bar */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setSelectedCategory('All')}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
            selectedCategory === 'All'
              ? 'bg-[#0F2442] text-white border-[#0F2442]'
              : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
          }`}
        >
          All Categories
        </button>
        {GALLERY_CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setSelectedCategory(cat)}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
              selectedCategory === cat
                ? 'bg-teal-700 text-white border-teal-700'
                : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Responsive Photo Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 bg-white border border-slate-200 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : visiblePhotos.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center space-y-2">
          <ImageIcon className="h-8 w-8 text-slate-400 mx-auto" />
          <h3 className="font-display font-semibold text-lg text-[#0F2442]">
            {photos.length === 0
              ? 'Gallery updates coming soon.'
              : 'No photographs in this selection'}
          </h3>
          {photos.length > 0 && (
            <p className="text-sm text-slate-500">
              Select another album or category to browse community event memories.
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {visiblePhotos.map((photo, index) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => setLightboxIndex(index)}
              className="group text-left bg-white border border-slate-200 rounded-xl overflow-hidden cursor-pointer focus-visible:outline-2 focus-visible:outline-teal-700"
            >
              <div className="aspect-[4/3] bg-slate-100 overflow-hidden">
                <SafeImage
                  src={photo.imageUrl}
                  alt={photo.caption}
                  className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-200"
                />
              </div>
              <div className="p-4 space-y-1">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="font-medium text-teal-700">{photo.category}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">{photo.eventDate}</span>
                </div>
                <p className="text-sm font-medium text-[#0F2442]">{photo.caption}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Lightbox Modal */}
      {activePhoto && lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/85 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={activePhoto.caption}
        >
          <div className="w-full max-w-4xl bg-white rounded-xl overflow-hidden border border-slate-700">
            <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between gap-4">
              <div className="text-xs text-slate-500">
                <span className="font-semibold text-teal-700">{activePhoto.category}</span>
                <span className="mx-2">·</span>
                <span className="font-mono tabular-nums">{activePhoto.eventDate}</span>
                {activePhoto.albumTitle ? (
                  <>
                    <span className="mx-2">·</span>
                    <span>{activePhoto.albumTitle}</span>
                  </>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setLightboxIndex(null)}
                aria-label="Close lightbox"
                className="p-1.5 text-slate-500 hover:text-[#0F2442] rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="relative bg-slate-950 aspect-[16/10] flex items-center justify-center">
              <SafeImage
                src={activePhoto.imageUrl}
                alt={activePhoto.caption}
                className="max-h-full max-w-full object-contain"
                lazy={false}
              />
              {visiblePhotos.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setLightboxIndex(
                        (lightboxIndex - 1 + visiblePhotos.length) % visiblePhotos.length
                      )
                    }
                    aria-label="Previous photograph"
                    className="absolute left-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-white/90 text-[#0F2442] hover:bg-white cursor-pointer"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setLightboxIndex((lightboxIndex + 1) % visiblePhotos.length)
                    }
                    aria-label="Next photograph"
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-white/90 text-[#0F2442] hover:bg-white cursor-pointer"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </>
              )}
            </div>
            <div className="px-6 py-4 bg-white flex items-center justify-between gap-4">
              <p className="text-sm font-medium text-[#0F2442]">{activePhoto.caption}</p>
              <span className="text-xs font-mono text-slate-500 tabular-nums shrink-0">
                {lightboxIndex + 1} / {visiblePhotos.length}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
